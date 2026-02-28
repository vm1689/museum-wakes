// voice.js — Web Speech API wrapper (swap for Google TTS when key is ready)

const VOICE = {
  synth: window.speechSynthesis,
  speaking: false,
  maleVoice: null,
  femaleVoice: null,

  init() {
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this._pickVoices();
    }
    this._pickVoices();
  },

  _pickVoices() {
    const voices = this.synth.getVoices();
    const eng = voices.filter(v => v.lang.startsWith('en'));

    // Male: deep/dramatic English voice
    const malePreferred = ['Google UK English Male', 'Daniel', 'Alex', 'Fred', 'Google US English'];
    for (const name of malePreferred) {
      const v = eng.find(v => v.name === name);
      if (v) { this.maleVoice = v; break; }
    }
    if (!this.maleVoice) this.maleVoice = eng[0] || voices[0] || null;

    // Female: warm/wise English voice
    const femalePreferred = ['Google UK English Female', 'Samantha', 'Karen', 'Victoria', 'Moira', 'Fiona'];
    for (const name of femalePreferred) {
      const v = eng.find(v => v.name === name);
      if (v) { this.femaleVoice = v; break; }
    }
    // Fallback: any voice that isn't the male voice
    if (!this.femaleVoice) {
      this.femaleVoice = eng.find(v => v !== this.maleVoice) || this.maleVoice;
    }
  },

  // gender: 'male' | 'female'
  speakLines(lines, { gender = 'male', pitch, rate = 0.88, volume = 1 } = {}) {
    this.synth.cancel();
    this.speaking = true;

    const voice = gender === 'female' ? this.femaleVoice : this.maleVoice;
    // Female voice: slightly higher pitch and slower for gravitas
    const resolvedPitch = pitch ?? (gender === 'female' ? 1.1 : 0.85);

    let i = 0;
    const speakNext = () => {
      if (i >= lines.length) { this.speaking = false; return; }
      const utt = new SpeechSynthesisUtterance(lines[i++]);
      if (voice) utt.voice = voice;
      utt.pitch = resolvedPitch;
      utt.rate = rate;
      utt.volume = volume;
      utt.onend = speakNext;
      utt.onerror = speakNext;
      this.synth.speak(utt);
    };

    speakNext();
  },

  // Speak a single string (convenience wrapper around speakLines)
  speak(text, opts = {}) {
    this.speakLines([text], opts);
  },

  stop() {
    this.synth.cancel();
    this.speaking = false;
  },

  supported() {
    return 'speechSynthesis' in window;
  }
};
