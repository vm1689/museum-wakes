// voice.js — Web Speech API wrapper for TTS

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

    const malePreferred = ['Google UK English Male', 'Daniel', 'Alex', 'Fred', 'Google US English'];
    for (const name of malePreferred) {
      const v = eng.find(v => v.name === name);
      if (v) { this.maleVoice = v; break; }
    }
    if (!this.maleVoice) this.maleVoice = eng[0] || voices[0] || null;

    const femalePreferred = ['Google UK English Female', 'Samantha', 'Karen', 'Victoria', 'Moira', 'Fiona'];
    for (const name of femalePreferred) {
      const v = eng.find(v => v.name === name);
      if (v) { this.femaleVoice = v; break; }
    }
    if (!this.femaleVoice) {
      this.femaleVoice = eng.find(v => v !== this.maleVoice) || this.maleVoice;
    }
  },

  speak(text, { gender = 'male', pitch, rate = 0.88, volume = 1 } = {}) {
    this.synth.cancel();
    this.speaking = true;
    const voice = gender === 'female' ? this.femaleVoice : this.maleVoice;
    const resolvedPitch = pitch ?? (gender === 'female' ? 1.1 : 0.85);

    const utt = new SpeechSynthesisUtterance(text);
    if (voice) utt.voice = voice;
    utt.pitch = resolvedPitch;
    utt.rate = rate;
    utt.volume = volume;
    utt.onend = () => { this.speaking = false; };
    utt.onerror = () => { this.speaking = false; };
    this.synth.speak(utt);
  },

  stop() {
    this.synth.cancel();
    this.speaking = false;
  },

  supported() {
    return 'speechSynthesis' in window;
  }
};
