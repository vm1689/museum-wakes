// voice.js — Gemini Native Audio TTS via WebSocket
// Replaces browser speechSynthesis with Gemini 2.5 Flash Native Audio
// Falls back to speechSynthesis if WebSocket connection fails

const VOICE = {
  ws: null,
  playbackCtx: null,
  speaking: false,
  _currentVoice: null,
  _playQueue: [],
  _isPlaying: false,
  _currentSource: null,
  _pendingText: null,
  _speakId: 0,       // monotonic ID to detect superseded speak() calls
  _connectPromise: null,

  init() {
    // Playback context at 24kHz (Gemini native audio output rate)
    try {
      this.playbackCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
    } catch {}
  },

  speak(text, { gender = 'male', rate, pitch, volume } = {}) {
    if (!text) return;
    this.stop();

    const voiceName = gender === 'female' ? 'Aoede' : 'Charon';
    this.speaking = true;
    this._pendingText = text;
    const id = ++this._speakId;

    this._ensureConnection(voiceName).then(() => {
      if (this._speakId !== id) return; // superseded by new speak() call
      this._sendText(text);
    }).catch(() => {
      if (this._speakId !== id) return;
      // Fallback to browser speechSynthesis
      this._fallbackSpeak(text, gender, rate, pitch, volume);
    });
  },

  stop() {
    this._speakId++;
    this._stopPlayback();
    this.speaking = false;
    this._pendingText = null;
    // Also stop any speechSynthesis fallback
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  },

  supported() {
    return !!(window.WebSocket || ('speechSynthesis' in window));
  },

  // ── Connection management ───────────────────────────────────────────────
  _ensureConnection(voiceName) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this._currentVoice === voiceName) {
      return Promise.resolve();
    }
    // If already connecting with the right voice, reuse that promise
    if (this._connectPromise && this._connectingVoice === voiceName) {
      return this._connectPromise;
    }
    this._connectPromise = this._connect(voiceName);
    this._connectingVoice = voiceName;
    return this._connectPromise;
  },

  _connect(voiceName) {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (this.ws) {
        try { this.ws.close(); } catch {}
        this.ws = null;
        this._currentVoice = null;
      }

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}/ws/voice`);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        try { this.ws.close(); } catch {}
      }, 8000);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'setup',
          systemInstruction: [
            'You are a dramatic voice narrator for an Egyptian mystery game at the Metropolitan Museum of Art.',
            'When you receive text, PERFORM it as a dramatic reading — speak every word EXACTLY as written.',
            'Do NOT respond to the text. Do NOT add your own words. Do NOT paraphrase.',
            'Simply read the given text aloud with:',
            '- Rich emotional delivery matched to the content',
            '- Dramatic pauses at key moments',
            '- Varied intonation — whisper when mysterious, intensify when urgent, soften when tender',
            '- Reverent, powerful tone for mythology and gods',
            '- A sense of atmosphere — you are the voice of ancient Egypt speaking in a darkened museum'
          ].join('\n'),
          voice: voiceName
        }));
      };

      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === 'ready') {
          clearTimeout(timeout);
          this._currentVoice = voiceName;
          this._connectPromise = null;
          resolve();
          return;
        }

        if (msg.type === 'error') {
          clearTimeout(timeout);
          this._connectPromise = null;
          reject(new Error(msg.message));
          return;
        }

        if (msg.type === 'response' && msg.data) {
          this._handleAudioResponse(msg.data);
        }

        if (msg.type === 'closed') {
          this._currentVoice = null;
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        this._connectPromise = null;
        this._currentVoice = null;
        reject(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        this._currentVoice = null;
        this._connectPromise = null;
      };
    });
  },

  // ── Send text for TTS ──────────────────────────────────────────────────
  _sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'text', text }));
  },

  // ── Handle Gemini audio response ───────────────────────────────────────
  _handleAudioResponse(response) {
    const sc = response.serverContent;
    if (!sc) return;

    // Barge-in / interruption
    if (sc.interrupted) {
      this._stopPlayback();
      this.speaking = false;
      return;
    }

    // Audio chunks from model
    const parts = sc.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
        this._queueAudio(part.inlineData.data);
      }
    }

    // Turn complete — flush remaining audio
    if (sc.turnComplete) {
      this._flushAudio();
    }
  },

  // ── Audio playback (24kHz PCM) ─────────────────────────────────────────
  _stopPlayback() {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
      this._currentSource = null;
    }
    this._playQueue = [];
    this._isPlaying = false;
  },

  _queueAudio(base64Data) {
    this._playQueue.push(base64Data);
    if (!this._isPlaying) {
      this._playQueuedAudio();
    }
  },

  _flushAudio() {
    // Ensure any remaining queued audio gets played
    if (!this._isPlaying && this._playQueue.length > 0) {
      this._playQueuedAudio();
    }
  },

  async _playQueuedAudio() {
    if (this._isPlaying || this._playQueue.length === 0) return;
    this._isPlaying = true;
    const id = this._speakId;

    while (this._playQueue.length > 0 && this._speakId === id) {
      const data = this._playQueue.shift();
      await this._playPCMChunk(data);
    }

    this._isPlaying = false;
    // If no more audio and turn is complete, mark as done
    if (this._playQueue.length === 0 && this._speakId === id) {
      this.speaking = false;
    }
  },

  _playPCMChunk(base64Data) {
    return new Promise((resolve) => {
      try {
        if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
          resolve();
          return;
        }

        // Resume if suspended (mobile browsers)
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

  // ── Fallback: browser speechSynthesis ──────────────────────────────────
  _fallbackSpeak(text, gender, rate, pitch, volume) {
    const synth = window.speechSynthesis;
    if (!synth) {
      this.speaking = false;
      return;
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate || 0.88;
    utt.pitch = pitch ?? (gender === 'female' ? 1.1 : 0.85);
    utt.volume = volume || 1;

    // Try to pick a voice
    const voices = synth.getVoices();
    if (voices.length > 0) {
      const eng = voices.filter(v => v.lang.startsWith('en'));
      if (gender === 'female') {
        const fem = eng.find(v => /samantha|karen|victoria|fiona|zira/i.test(v.name));
        if (fem) utt.voice = fem;
      } else {
        const mal = eng.find(v => /daniel|alex|david|aaron|fred/i.test(v.name));
        if (mal) utt.voice = mal;
      }
    }

    utt.onend = () => { this.speaking = false; };
    utt.onerror = () => { this.speaking = false; };
    synth.speak(utt);
  }
};
