// gemini-voice.js — Gemini Live voice mode via WebSocket
// Bidirectional audio: mic → Gemini → speaker
// Uses Gemini 2.5 Flash Native Audio with automatic activity detection and barge-in

const GEMINI_VOICE = {
  ws: null,
  captureCtx: null,      // AudioContext for mic capture (16kHz)
  playbackCtx: null,     // AudioContext for speaker output (24kHz)
  mediaStream: null,
  processorNode: null,
  isActive: false,
  isReady: false,
  playQueue: [],
  isPlaying: false,
  _currentSource: null,  // Currently playing AudioBufferSourceNode
  onStateChange: null,   // callback(state: 'connecting'|'ready'|'listening'|'speaking'|'error'|'closed')
  onTranscript: null,    // callback(text, role) — for showing text alongside voice

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
      // Request microphone with echo cancellation
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Capture context at 16kHz for mic → Gemini
      this.captureCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Playback context at 24kHz for Gemini → speaker
      this.playbackCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });

      // Connect to server WebSocket proxy
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}/ws/voice`);

      this.ws.onopen = () => {
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

    this._stopPlayback();

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.captureCtx) {
      this.captureCtx.close().catch(() => {});
      this.captureCtx = null;
    }

    if (this.playbackCtx) {
      this.playbackCtx.close().catch(() => {});
      this.playbackCtx = null;
    }

    this.isActive = false;
    this.isReady = false;
    this.playQueue = [];
    this.isPlaying = false;
    this._currentSource = null;
    this._setState('closed');
  },

  // ── Send text message (instead of voice) ─────────────────────────────
  sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'text', text }));
  },

  // ── Start streaming mic audio ─────────────────────────────────────────
  _startMicStream() {
    if (!this.captureCtx || !this.mediaStream) return;

    const source = this.captureCtx.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessor for wider compatibility (AudioWorklet needs HTTPS)
    const bufferSize = 4096;
    this.processorNode = this.captureCtx.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert float32 → int16 PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Encode as base64 (chunked to avoid call stack overflow)
      const bytes = new Uint8Array(pcm16.buffer);
      const base64 = this._bytesToBase64(bytes);

      this.ws.send(JSON.stringify({
        type: 'audio',
        data: base64
      }));
    };

    source.connect(this.processorNode);
    this.processorNode.connect(this.captureCtx.destination);

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
    const serverContent = response.serverContent;
    if (!serverContent) return;

    // Barge-in: server detected user started speaking while model was talking
    if (serverContent.interrupted) {
      this._stopPlayback();
      this._setState('listening');
      return;
    }

    // Audio/text from model
    const parts = serverContent.modelTurn?.parts || [];

    for (const part of parts) {
      // Text part — show as transcript
      if (part.text && this.onTranscript) {
        this.onTranscript(part.text, 'model');
      }

      // Audio part — queue for playback
      if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
        this._queueAudio(part.inlineData.data);
        this._setState('speaking');
      }
    }

    // Turn complete — flush remaining audio then resume listening
    if (serverContent.turnComplete) {
      this._playQueuedAudio().then(() => {
        if (this.isActive) this._setState('listening');
      });
    }
  },

  // ── Audio playback (single reusable context at 24kHz) ─────────────────
  _stopPlayback() {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
      this._currentSource = null;
    }
    this.playQueue = [];
    this.isPlaying = false;
  },

  _queueAudio(base64Data) {
    this.playQueue.push(base64Data);
    if (!this.isPlaying) {
      this._playQueuedAudio();
    }
  },

  async _playQueuedAudio() {
    if (this.isPlaying || this.playQueue.length === 0) return;
    this.isPlaying = true;

    while (this.playQueue.length > 0 && this.isActive) {
      const data = this.playQueue.shift();
      await this._playPCMChunk(data);
    }

    this.isPlaying = false;
  },

  async _playPCMChunk(base64Data) {
    return new Promise((resolve) => {
      try {
        if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
          resolve();
          return;
        }

        // Resume if suspended (mobile browsers suspend contexts)
        if (this.playbackCtx.state === 'suspended') {
          this.playbackCtx.resume();
        }

        // Decode base64 → Int16 PCM → Float32
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const int16 = new Int16Array(bytes.buffer);
        const audioBuffer = this.playbackCtx.createBuffer(1, int16.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < int16.length; i++) {
          channelData[i] = int16[i] / 0x7FFF;
        }

        const source = this.playbackCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.playbackCtx.destination);
        this._currentSource = source;

        source.onended = () => {
          this._currentSource = null;
          resolve();
        };
        source.start();
      } catch {
        resolve();
      }
    });
  },

  // ── Utility: base64 encode without stack overflow ─────────────────────
  _bytesToBase64(bytes) {
    const CHUNK = 8192;
    let str = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      str += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(str);
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
