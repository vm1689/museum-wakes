// gemini-voice.js — Gemini Live voice mode via WebSocket
// Bidirectional audio: mic → Gemini → speaker

const GEMINI_VOICE = {
  ws: null,
  audioContext: null,
  mediaStream: null,
  processorNode: null,
  isActive: false,
  isReady: false,
  playQueue: [],
  isPlaying: false,
  onStateChange: null,  // callback(state: 'connecting'|'ready'|'listening'|'speaking'|'error'|'closed')
  onTranscript: null,   // callback(text, role) — for showing text alongside voice

  // ── Voice profiles per god/guide ───────────────────────────────────────
  voiceProfiles: {
    isis:   'Aoede',
    thoth:  'Charon',
    osiris: 'Charon',
    kha:    'Charon',
    default: 'Aoede'
  },

  getVoiceForPath(pathId) {
    const guides = {
      search: 'isis',
      trial: 'thoth',
      letters: 'kha',
      memory: 'thoth',
      awakening: 'thoth'
    };
    const guide = guides[pathId] || 'default';
    return this.voiceProfiles[guide] || this.voiceProfiles.default;
  },

  // ── Start voice session ───────────────────────────────────────────────
  async start(systemInstruction, pathId) {
    if (this.isActive) this.stop();

    this._setState('connecting');

    try {
      // Request microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Set up audio context for capture
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Connect to server WebSocket proxy
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}/ws/voice`);

      this.ws.onopen = () => {
        // Send setup with system instruction and voice selection
        const voice = this.getVoiceForPath(pathId);
        this.ws.send(JSON.stringify({
          type: 'setup',
          systemInstruction: systemInstruction || '',
          voice
        }));
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this._setState('closed');
        this.isActive = false;
        this.isReady = false;
      };

      this.ws.onerror = () => {
        this._setState('error');
        this.stop();
      };

      this.isActive = true;

    } catch (err) {
      console.error('Voice start error:', err);
      this._setState('error');
      this.stop();
      return false;
    }

    return true;
  },

  // ── Stop voice session ────────────────────────────────────────────────
  stop() {
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'end' }));
      } catch {}
      this.ws.close();
      this.ws = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.isActive = false;
    this.isReady = false;
    this.playQueue = [];
    this.isPlaying = false;
    this._setState('closed');
  },

  // ── Send text message (instead of voice) ─────────────────────────────
  sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'text', text }));
  },

  // ── Start streaming mic audio ─────────────────────────────────────────
  _startMicStream() {
    if (!this.audioContext || !this.mediaStream) return;

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessor for wider compatibility (AudioWorklet needs HTTPS)
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert float32 → int16 PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Encode as base64
      const bytes = new Uint8Array(pcm16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      this.ws.send(JSON.stringify({
        type: 'audio',
        data: base64
      }));
    };

    source.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    this._setState('listening');
  },

  // ── Handle messages from server ───────────────────────────────────────
  _handleMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.type === 'ready') {
      this.isReady = true;
      this._setState('ready');
      this._startMicStream();
      return;
    }

    if (msg.type === 'error') {
      console.error('Voice error:', msg.message);
      this._setState('error');
      return;
    }

    if (msg.type === 'closed') {
      this._setState('closed');
      return;
    }

    if (msg.type === 'response' && msg.data) {
      this._processGeminiResponse(msg.data);
    }
  },

  // ── Process Gemini Live response ──────────────────────────────────────
  _processGeminiResponse(response) {
    // Handle setup complete
    if (response.setupComplete) {
      return;
    }

    // Handle server content (audio/text)
    const serverContent = response.serverContent;
    if (!serverContent) return;

    const parts = serverContent.modelTurn?.parts || [];

    for (const part of parts) {
      // Text part — show as transcript
      if (part.text && this.onTranscript) {
        this.onTranscript(part.text, 'model');
      }

      // Audio part — queue for playback
      if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
        this._queueAudio(part.inlineData.data, part.inlineData.mimeType);
        this._setState('speaking');
      }
    }

    // If turn complete, resume listening
    if (serverContent.turnComplete) {
      this._playQueuedAudio().then(() => {
        if (this.isActive) this._setState('listening');
      });
    }
  },

  // ── Audio playback ────────────────────────────────────────────────────
  _queueAudio(base64Data, mimeType) {
    this.playQueue.push({ data: base64Data, mimeType });
    if (!this.isPlaying) {
      this._playQueuedAudio();
    }
  },

  async _playQueuedAudio() {
    if (this.isPlaying || this.playQueue.length === 0) return;
    this.isPlaying = true;

    while (this.playQueue.length > 0) {
      const { data, mimeType } = this.playQueue.shift();
      await this._playAudioChunk(data, mimeType);
    }

    this.isPlaying = false;
  },

  async _playAudioChunk(base64Data, mimeType) {
    return new Promise((resolve) => {
      try {
        const playCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Decode base64 to ArrayBuffer
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // If PCM, manually create audio buffer
        if (mimeType.includes('pcm')) {
          const sampleRate = 24000; // Gemini typically outputs 24kHz
          const int16 = new Int16Array(bytes.buffer);
          const audioBuffer = playCtx.createBuffer(1, int16.length, sampleRate);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < int16.length; i++) {
            channelData[i] = int16[i] / 0x7FFF;
          }

          const source = playCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(playCtx.destination);
          source.onended = () => {
            playCtx.close().catch(() => {});
            resolve();
          };
          source.start();
        } else {
          // Try decoding as encoded audio format
          playCtx.decodeAudioData(bytes.buffer, (audioBuffer) => {
            const source = playCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playCtx.destination);
            source.onended = () => {
              playCtx.close().catch(() => {});
              resolve();
            };
            source.start();
          }, () => {
            playCtx.close().catch(() => {});
            resolve();
          });
        }
      } catch {
        resolve();
      }
    });
  },

  // ── State management ──────────────────────────────────────────────────
  _setState(state) {
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  },

  // ── Feature detection ─────────────────────────────────────────────────
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket);
  }
};
