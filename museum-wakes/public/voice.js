// voice.js — Web Speech API wrapper for TTS
// Handles Chrome long-speech bug, mobile voice loading, and pause/resume quirks

const VOICE = {
  synth: window.speechSynthesis,
  speaking: false,
  maleVoice: null,
  femaleVoice: null,
  _voicesReady: false,
  _resumeInterval: null,

  init() {
    // Voices load asynchronously on most browsers
    const loadVoices = () => {
      this._pickVoices();
      if (this.maleVoice || this.femaleVoice) {
        this._voicesReady = true;
      }
    };

    loadVoices();

    if (this.synth && this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }

    // Some browsers need a retry
    if (!this._voicesReady) {
      setTimeout(loadVoices, 100);
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1000);
    }
  },

  _pickVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return;

    const eng = voices.filter(v => v.lang.startsWith('en'));

    const malePreferred = [
      'Google UK English Male', 'Daniel', 'Alex', 'Fred',
      'Google US English', 'Microsoft David', 'Aaron'
    ];
    for (const name of malePreferred) {
      const v = eng.find(v => v.name.includes(name));
      if (v) { this.maleVoice = v; break; }
    }
    if (!this.maleVoice) this.maleVoice = eng[0] || voices[0] || null;

    const femalePreferred = [
      'Google UK English Female', 'Samantha', 'Karen', 'Victoria',
      'Moira', 'Fiona', 'Microsoft Zira'
    ];
    for (const name of femalePreferred) {
      const v = eng.find(v => v.name.includes(name));
      if (v) { this.femaleVoice = v; break; }
    }
    if (!this.femaleVoice) {
      this.femaleVoice = eng.find(v => v !== this.maleVoice) || this.maleVoice;
    }
  },

  speak(text, { gender = 'male', pitch, rate = 0.88, volume = 1 } = {}) {
    if (!this.synth || !this.supported()) return;

    this.stop();

    // Re-pick voices if not ready yet (handles late-loading on mobile)
    if (!this._voicesReady) this._pickVoices();

    const voice = gender === 'female' ? this.femaleVoice : this.maleVoice;
    const resolvedPitch = pitch ?? (gender === 'female' ? 1.1 : 0.85);

    // Chrome bug: speechSynthesis stops after ~15s on long text.
    // Fix: split into chunks at sentence boundaries.
    const chunks = this._splitText(text, 200);

    this.speaking = true;
    this._speakChunks(chunks, voice, resolvedPitch, rate, volume);
  },

  _speakChunks(chunks, voice, pitch, rate, volume) {
    if (chunks.length === 0) {
      this.speaking = false;
      this._stopResumeHack();
      return;
    }

    const chunk = chunks.shift();
    const utt = new SpeechSynthesisUtterance(chunk);
    if (voice) utt.voice = voice;
    utt.pitch = pitch;
    utt.rate = rate;
    utt.volume = volume;

    utt.onend = () => {
      this._speakChunks(chunks, voice, pitch, rate, volume);
    };
    utt.onerror = (e) => {
      // 'interrupted' is normal when we call stop()
      if (e.error !== 'interrupted') {
        console.warn('Voice error:', e.error);
      }
      this.speaking = false;
      this._stopResumeHack();
    };

    this.synth.speak(utt);

    // Chrome desktop bug: synth pauses randomly. Resume hack keeps it going.
    this._startResumeHack();
  },

  // Split text into chunks at sentence boundaries, respecting max length
  _splitText(text, maxLen) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Find the last sentence boundary within maxLen
      let splitAt = -1;
      for (const sep of ['. ', '! ', '? ', '.\n', '!\n', '?\n']) {
        const idx = remaining.lastIndexOf(sep, maxLen);
        if (idx > splitAt) splitAt = idx + sep.length;
      }

      // Fallback: split at last space
      if (splitAt <= 0) {
        splitAt = remaining.lastIndexOf(' ', maxLen);
      }
      // Last resort: hard cut
      if (splitAt <= 0) {
        splitAt = maxLen;
      }

      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }

    return chunks.filter(c => c.length > 0);
  },

  // Chrome pause bug workaround: periodically call resume()
  _startResumeHack() {
    this._stopResumeHack();
    this._resumeInterval = setInterval(() => {
      if (this.synth && this.speaking && this.synth.paused) {
        this.synth.resume();
      }
    }, 5000);
  },

  _stopResumeHack() {
    if (this._resumeInterval) {
      clearInterval(this._resumeInterval);
      this._resumeInterval = null;
    }
  },

  stop() {
    if (this.synth) this.synth.cancel();
    this.speaking = false;
    this._stopResumeHack();
  },

  supported() {
    return 'speechSynthesis' in window && !!this.synth;
  }
};
