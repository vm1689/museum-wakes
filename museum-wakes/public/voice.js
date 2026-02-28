// voice.js — Gemini Native Audio generation via WebSocket
// Primary method: generateAndSpeak() — sends prompts to Gemini, gets native audio + transcript
// Falls back to text-only generation via /api/gemini if WebSocket fails

const VOICE = {
  playbackCtx: null,
  speaking: false,
  _playQueue: [],
  _isPlaying: false,
  _currentSource: null,
  _speakId: 0,       // monotonic ID to detect superseded calls

  init() {
    // Playback context at 24kHz (Gemini native audio output rate)
    try {
      this.playbackCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
    } catch {}
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PRIMARY METHOD: Generate response as native audio + transcript
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Send system + user prompt to Gemini via WebSocket for native audio generation.
   * Returns the spoken transcript text for display.
   *
   * @param {string} systemPrompt - Full character/narrative system prompt
   * @param {string} userPrompt - The user-facing prompt
   * @param {Object} options
   * @param {string} options.voice - Gemini voice name (e.g. 'Aoede', 'Charon')
   * @param {function} options.onText - Progressive text callback: onText(partialText)
   * @param {string} options.historyKey - Key for conversation history in CLAUDE.histories
   * @returns {Promise<string>} Full transcript of what Gemini spoke
   */
  async generateAndSpeak(systemPrompt, userPrompt, { voice = 'Charon', onText, historyKey } = {}) {
    this.stop();
    this.speaking = true;
    const id = ++this._speakId;

    try {
      const transcript = await this._wsGenerateAndSpeak(systemPrompt, userPrompt, voice, onText, id);

      // Store in CLAUDE history if key provided
      if (historyKey && transcript) {
        if (!CLAUDE.histories[historyKey]) CLAUDE.histories[historyKey] = [];
        CLAUDE.histories[historyKey].push({ role: 'user', content: userPrompt });
        CLAUDE.histories[historyKey].push({ role: 'assistant', content: transcript });
      }

      if (this._speakId === id) this.speaking = false;
      return transcript;
    } catch (err) {
      console.warn('[VOICE] WebSocket generation failed, falling back to text API:', err.message);
      if (this._speakId !== id) return '';

      // Fallback: generate text via REST API, no audio
      return this._fallbackGenerate(systemPrompt, userPrompt, historyKey);
    }
  },

  // ── WebSocket-based generation ────────────────────────────────────────

  _wsGenerateAndSpeak(systemPrompt, userPrompt, voiceName, onText, speakId) {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws/voice`);
      let transcriptParts = [];
      let setupDone = false;

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket timeout'));
        try { ws.close(); } catch {}
      }, 30000);

      ws.onopen = () => {
        // Send setup with full system prompt and voice
        ws.send(JSON.stringify({
          type: 'setup',
          systemInstruction: systemPrompt,
          voice: voiceName
        }));
      };

      ws.onmessage = (event) => {
        if (this._speakId !== speakId) {
          // Superseded — close and resolve with whatever we have
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve(transcriptParts.join(''));
          return;
        }

        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === 'ready') {
          setupDone = true;
          // Now send the user prompt as client content
          ws.send(JSON.stringify({ type: 'text', text: userPrompt }));
          return;
        }

        if (msg.type === 'error') {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          if (!setupDone) {
            reject(new Error(msg.message));
          } else {
            resolve(transcriptParts.join(''));
          }
          return;
        }

        if (msg.type === 'response' && msg.data) {
          const sc = msg.data.serverContent;
          if (!sc) return;

          // Interruption
          if (sc.interrupted) {
            this._stopPlayback();
            return;
          }

          // Output transcription — text of what Gemini is speaking
          if (sc.outputTranscription && sc.outputTranscription.text) {
            transcriptParts.push(sc.outputTranscription.text);
            if (onText) onText(transcriptParts.join(''));
          }

          // Audio chunks from model
          const parts = sc.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
              this._queueAudio(part.inlineData.data);
            }
          }

          // Turn complete — done
          if (sc.turnComplete) {
            clearTimeout(timeout);
            this._flushAudio();
            // Give a small delay for final audio to queue, then close
            setTimeout(() => {
              try { ws.close(); } catch {}
            }, 500);
            resolve(transcriptParts.join(''));
          }
        }

        if (msg.type === 'closed') {
          clearTimeout(timeout);
          resolve(transcriptParts.join(''));
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        // If we haven't resolved yet, resolve with whatever transcript we have
        resolve(transcriptParts.join(''));
      };
    });
  },

  // ── Fallback: text-only generation via REST API ────────────────────────

  async _fallbackGenerate(systemPrompt, userPrompt, historyKey) {
    try {
      const text = await CLAUDE.generate(systemPrompt, userPrompt, {
        maxTokens: 800,
        temperature: 0.9,
        historyKey
      });
      this.speaking = false;
      return text || '';
    } catch (e) {
      console.error('[VOICE] Fallback generation also failed:', e);
      this.speaking = false;
      return '';
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STOP / SUPPORT
  // ══════════════════════════════════════════════════════════════════════════

  stop() {
    this._speakId++;
    this._stopPlayback();
    this.speaking = false;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  },

  supported() {
    return !!(window.WebSocket);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIO PLAYBACK (24kHz PCM) — shared by generateAndSpeak
  // ══════════════════════════════════════════════════════════════════════════

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
  }
};
