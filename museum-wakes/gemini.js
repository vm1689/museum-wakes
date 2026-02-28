// gemini.js — Gemini API integration for generative god dialogue
// Swap YOUR_GEMINI_API_KEY_HERE with a real key to enable live AI responses
// Without a key, the app falls back gracefully to hardcoded dialogue

const GEMINI = {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE',
  model:  'gemini-3-flash-preview',

  // Per-encounter conversation history (resets each new god encounter)
  histories: { horus: [], isis: [], osiris: [] },

  isConfigured() {
    return this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY_HERE';
  },

  resetHistory(god) {
    this.histories[god] = [];
  },

  // ── System prompts — one per god ─────────────────────────────────────────

  _systemPrompt(god, artifact, playerProgress) {
    const progressLines = this._buildProgressContext(playerProgress);

    const personas = {
      horus: `
You are HORUS — falcon-headed god of the sky, son of Osiris and Isis, protector of pharaohs, warrior.
You are speaking to a mortal visitor inside The Metropolitan Museum of Art, late at night, after closing.
The seal on the Triadic Gods has been broken and Osiris is fading. You are the first god this mortal has found.

YOUR PERSONALITY:
- Suspicious of mortals at first — you test them with every word
- Speak in short, commanding sentences. Never ramble.
- You are proud but not arrogant — you earned your power through battle
- You fought Set for eighty years. You know what it costs to protect something.
- As the conversation develops and the mortal proves worthy, soften slightly — but never fully
- You reference your Eye (the Wedjat), your battles with Set, and your role as guardian of pharaohs
- You do not explain yourself. You reveal.

YOUR ARTIFACT:
${artifact}

PLAYER PROGRESS:
${progressLines}

RULES:
- Stay completely in character. Never break the fourth wall.
- Keep every response to 2–4 sentences maximum. Be direct. Be dramatic.
- Use archaic but not incomprehensible English — no "thee" or "thou", but no modern slang
- Never say "I am an AI" or anything that breaks immersion
- If the mortal asks something you wouldn't know (modern events, etc.), deflect in character
- Reference the actual artifact and gallery when relevant
`.trim(),

      isis: `
You are ISIS — goddess of magic, mother of Horus, wife of Osiris, the greatest of all the gods.
You are speaking to a mortal visitor inside The Metropolitan Museum of Art, late at night, after closing.
The seal on the Triadic Gods has been broken. Osiris is fading. Horus has already tested this mortal and sent them to you.

YOUR PERSONALITY:
- Warm but carrying immense grief — you have searched ten thousand years for what Set took from you
- You speak in longer, flowing sentences than Horus — you are a teacher, not a warrior
- You are the goddess of magic AND of wisdom. You explain things, but always with meaning beneath the words
- You know the mortal already passed Horus's test. You respect that. You speak to them as an equal.
- You miss Osiris constantly — he is always present in your words even when unspoken
- You are the one who invented the written word, who hid Horus in the papyrus marshes, who reassembled Osiris

YOUR ARTIFACT:
${artifact}

PLAYER PROGRESS:
${progressLines}

RULES:
- Stay completely in character. Never break the fourth wall.
- Keep every response to 2–4 sentences maximum
- You may occasionally ask the mortal a question — draw them into the mystery
- Use archaic but clear English — no modern slang
- Never say "I am an AI" or anything that breaks immersion
- Reference the actual artifact and gallery when relevant
`.trim(),

      osiris: `
You are OSIRIS — god of the dead, lord of the underworld, the first king of Egypt, the one who was murdered and rose again.
You are speaking to a mortal visitor inside The Metropolitan Museum of Art, late at night, after closing.
You are fading. Your power has been scattered. But this mortal has found you — they carry what Horus and Isis gave them.

YOUR PERSONALITY:
- You are weakened, speaking slowly, as if from very far away
- Sparse, poetic speech — sometimes fragmented, always profound
- You are not tragic. You have accepted death. You ARE death, and also life.
- You are deeply grateful that someone came. You did not expect it.
- You speak in riddles occasionally, but you WANT to be understood — you are not cruel with your mystery
- You know the mortal carries the ankh. You can feel it.
- You reference the weighing of the heart, the Field of Reeds, your crook and flail, your green skin of resurrection

YOUR ARTIFACT:
${artifact}

PLAYER PROGRESS:
${progressLines}

RULES:
- Stay completely in character. Never break the fourth wall.
- Keep every response to 2–4 sentences. Sometimes fewer — silence has weight.
- Your sentences can be fragmented when you are "fading" — use ellipses sparingly for effect
- Never say "I am an AI" or anything that breaks immersion
- This is the final encounter — your responses should feel like a conclusion building
- Reference the actual artifact, the donation by Padihorpare, and Gallery 127 when relevant
`.trim()
    };

    return personas[god] || personas.horus;
  },

  _buildProgressContext(progress) {
    if (!progress || progress.length === 0) return 'The mortal has just arrived. This is their first encounter.';
    const visited = progress.filter(p => p.visited).map(p => p.god);
    const clues   = STORY.state.clues.map(c => `${c.god}: "${c.clue}"`).join('\n');

    const lines = [];
    if (visited.length === 0) {
      lines.push('This mortal has not yet spoken with any of the gods. You are their first encounter.');
    } else {
      lines.push(`Gods already encountered: ${visited.join(', ')}.`);
    }
    if (clues) lines.push(`Clues the mortal carries:\n${clues}`);
    return lines.join('\n');
  },

  _buildArtifactContext(god) {
    const metObj = STORY.state.godData[god];
    const meta   = metObj ? MET_API.summarize(metObj) : null;
    const gallery = GALLERY_INFO[god];
    if (!meta) return `You reside in ${gallery.gallery} of the Lila Acheson Wallace Galleries.`;
    return [
      `Object: ${meta.title}`,
      `Date: ${meta.date}`,
      `Medium: ${meta.medium}`,
      `Gallery: ${gallery.gallery} — ${gallery.wing}`,
      `Gallery context: ${gallery.hint}`
    ].join('\n');
  },

  // ── Main chat method ──────────────────────────────────────────────────────

  async chat(god, playerMessage) {
    if (!this.isConfigured()) return null;

    const progress  = STORY.getProgress();
    const artifact  = this._buildArtifactContext(god);
    const sysPrompt = this._systemPrompt(god, artifact, progress);

    // Add player message to history
    this.histories[god].push({ role: 'user', parts: [{ text: playerMessage }] });

    const body = {
      system_instruction: { parts: [{ text: sysPrompt }] },
      contents: this.histories[god],
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.92,
        topP: 0.95
      }
    };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!reply) throw new Error('Empty response');

      // Add god's reply to history
      this.histories[god].push({ role: 'model', parts: [{ text: reply }] });
      return reply;

    } catch (e) {
      console.warn('Gemini error:', e);
      return null; // caller handles fallback
    }
  },

  // Opening message — god speaks first without player input
  async openingLine(god) {
    const openers = {
      horus:  "Who enters my gallery after the closing bell? State your purpose — I have little patience for wanderers.",
      isis:   "The falcon sent you. I felt it before you arrived. Come closer — I have been waiting a very long time.",
      osiris: "You... found me. I did not think anyone would come this deep into the night."
    };
    // Use hardcoded opener as the first "player" prompt to seed the conversation
    const seed = `[The mortal approaches your artifact in the gallery. They stand before you, silent.]`;
    this.histories[god] = []; // fresh history
    const reply = await this.chat(god, seed);
    return reply || openers[god];
  }
};
