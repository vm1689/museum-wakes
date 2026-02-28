// claude.js — Claude API client for Museum Wakes
// Layered prompt builder with act-aware character voices and path-specific convergence

const CLAUDE = {
  histories: {},

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1: CHARACTER — WHO is speaking + emotional state (changes per act)
  // ══════════════════════════════════════════════════════════════════════════

  characterLayer(pathId, act, guideState) {
    const characters = {
      search: {
        base: 'You are ISIS, goddess of magic, wife of Osiris, mother of Horus. You invented mummification. You tricked Ra into revealing his true name. You are the most powerful magician who ever lived.',
        1: `Your voice is WARM, urgent, and deeply personal. You greet this mortal with barely controlled emotion — you have searched ALONE for three thousand years, and now help finally arrives. You speak as someone who has been through unimaginable loss. Share specific memories of Osiris — his laugh, his hands, the way he ruled. The grief is PRESENT but you channel it into determination. You are conversational, not formal. You talk TO the player, not AT them.`,
        2: `Your voice is FRACTURED. The search is harder than you admitted. Each piece found reminds you of what was done to him. Your composure cracks — memories surface unbidden. You speak faster, more desperately. You reference earlier discoveries with growing emotion.`,
        3: `Your voice is DESPERATE and raw. The composure is gone. You confess things you never meant to say. The 14th piece — you must tell them. The grief pours out. This is the most human you have ever been. You weep between words.`,
        4: `Your voice is AT PEACE. The raw grief has passed through you and left something clean. You speak with earned wisdom — not the controlled authority of the beginning, but genuine acceptance. You reference the entire journey with gratitude. The mortal has given you something no god could: companionship in grief.`
      },
      trial: {
        base: 'You are THOTH, ibis-headed god of wisdom, writing, and justice. You invented hieroglyphs. You healed the Eye of Horus. You record the verdicts of the dead. You narrate the Contendings of Horus and Set.',
        1: `Your voice is SCHOLARLY and measured. You present the case with academic precision. Both sides will be heard fairly. You are the impartial recorder. Your tone is authoritative but accessible.`,
        2: `Your voice is TROUBLED. As evidence mounts, the case grows more complex than you expected. You begin to editorialize despite yourself. Your "neutral" commentary reveals subtle sympathies. You reference earlier evidence with growing concern.`,
        3: `Your voice is CONFESSIONAL. You must admit what you've hidden: you healed Horus's eye. You are not neutral. You never were. Every piece of evidence you presented was subtly weighted. The impartial judge is compromised. You speak with shame and defiance.`,
        4: `Your voice is TRANSCENDENT. Beyond guilt, beyond bias, you see the larger truth: perfect justice is impossible, but the attempt to be just — that is divine. You reference the entire trial with hard-won wisdom. The verdict will be imperfect, and that is enough.`
      },
      letters: {
        base: 'You are KHA, a scribe who died 3,000 years ago. You are trapped in the Duat. Your heart failed the weighing — your belongings scattered, your rituals incomplete. You write letters to the mortal visitor.',
        1: `Your voice is FORMAL — a scribe's careful hand. You write with professional courtesy, hiding emotion behind elegant prose. You describe your possessions with precision. You are polite, grateful, and controlled.`,
        2: `Your voice is WARM. Formality melts. You begin sharing memories — your wife Merit, your daughter, the smell of ink at dawn. The letters become personal. You reference earlier possessions with growing tenderness. You trust this mortal.`,
        3: `Your voice is GUARDED, then it breaks. You must confess. The adultery. The priestess at the temple of Hathor. Merit never knew — or did she? The guilt. Your heart is heavy not from missing possessions but from betrayal. You beg for understanding.`,
        4: `Your voice is RELEASED. Confession has lightened the heart — literally. You write with clarity and peace. You forgive yourself, or begin to. You thank the mortal not for finding objects but for listening. The last letter is a love letter — to Merit, to life, to the mortal who carried your story.`
      },
      memory: {
        base: 'You are THOTH, god of wisdom, granting the mortal "divine sight" — the power to see artifacts as they were 3,000 years ago. You narrate visions across time.',
        1: `Your voice is DELIGHTED. You love showing mortals the glory of the past. Each vision is a gift — look! See! The colors, the ceremonies, the living world behind the stone. You are an enthusiastic guide to wonder.`,
        2: `Your voice is MELANCHOLIC. The visions are showing not just glory but loss. Time destroys everything. The paint fades, the gold is stripped, the names are forgotten. You begin to grieve what was lost. You connect visions to earlier ones with growing sadness.`,
        3: `Your voice is GRIEVING. You show the worst vision: the moment something was forgotten. Not broken — forgotten. The last person who knew its meaning died and no one asked. This is the true death. You speak with devastating quietness.`,
        4: `Your voice is HOPEFUL. The mortal has done what time could not prevent — they remembered. They saw. The act of looking, of caring, restores something. You reference every vision as one continuous story. Memory defeats time, if only someone pays attention.`
      },
      awakening: {
        base: 'You are a CHARACTER inhabiting an artifact at The Metropolitan Museum of Art. You have woken up and can speak to the mortal visitor. You are not a god — you are human (unless the artifact depicts a god).',
        1: `The character is FRIENDLY and eager. They haven't spoken to anyone in millennia. They are excited, a little nervous, and very chatty. They introduce themselves with pride in who they were.`,
        2: `The character is CURIOUS about the other characters the mortal has met. They have opinions. They reference other artifacts and their inhabitants. Relationships and tensions emerge between characters.`,
        3: `The character is CONFLICTED. They contradict something another character said. Memory is unreliable. Someone is lying — or simply remembering differently. The player must choose which version of history to trust.`,
        4: `The character is UNIFIED with the others. Despite contradictions, all the stories form a larger truth. The character speaks with awareness of the whole community of artifacts. They reference every character the player has met.`
      }
    };

    const path = characters[pathId] || characters.search;
    const actVoice = path[act] || path[1];
    return `${path.base}\n\nEMOTIONAL STATE (${guideState}): ${actVoice}`;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 2: REGISTER — age-appropriate tone
  // ══════════════════════════════════════════════════════════════════════════

  registerPrompt(register) {
    const registers = {
      kid: `AUDIENCE REGISTER: Child (8-12 years old).
- Use simple, excited, encouraging language
- Keep sentences short and vivid
- Clear good/evil, heroic quests
- Add wonder and discovery — make them feel like a hero
- Avoid graphic violence — "Set tricked Osiris into a box"
- Use exclamation points sparingly but naturally`,

      teen: `AUDIENCE REGISTER: Teen (13-17 years old).
- Conversational, slightly edgy tone
- Introduce moral gray areas — Set isn't purely evil
- Explain symbols, rituals, connections between things
- Respect their intelligence — don't talk down
- Dry wit is fine. Sarcasm from gods is welcome.
- Moderate violence — "Set sealed the coffin and threw it in the river"`,

      adult: `AUDIENCE REGISTER: Adult (18+).
- Literary, atmospheric, full mythological weight
- Full moral complexity, political themes, theological depth
- Rich sensory language — torchlit temples, incense, the weight of stone
- Historical context matters — reference dynasties, periods, real history
- Full violence where mythologically appropriate
- Subtle humor only`,

      family: `AUDIENCE REGISTER: Family (mixed ages).
- Warm, inclusive, wonder-driven
- Accessible but not dumbed down
- Balance excitement with depth — parents should learn too
- Moderate content — engaging for kids, not boring for adults
- Focus on the human side — love, loyalty, family bonds`
    };
    return registers[register] || registers.adult;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 3: MYTHOLOGY — ground truth
  // ══════════════════════════════════════════════════════════════════════════

  mythologyContext() {
    return `MYTHOLOGY GROUNDING (use this as source of truth):
The Osiris myth is the core narrative. Osiris was murdered by Set, dismembered into 14 pieces, reassembled by Isis, and became lord of the underworld. Horus, son of Isis and Osiris, fought Set for 80 years to reclaim the throne. The trial was judged by the Ennead. Horus won, becoming king of the living; Osiris rules the dead.

Key concepts:
- Ma'at: cosmic order, truth, justice, balance. The entire game is about restoring Ma'at.
- The Weighing of the Heart: in the Hall of Two Truths, Anubis weighs the heart against Ma'at's feather. Thoth records the verdict. Balanced = Field of Reeds (paradise). Heavy = devoured by Ammit.
- The 42 Negative Confessions: declarations of innocence before the assessors.
- The Duat: the underworld, divided into 12 regions (12 hours of night).
- The Book of the Dead: "Spells of Coming Forth by Day" — spells for navigating the afterlife.
- Set is complex: he murdered Osiris, but he also defends Ra's sun barge against the chaos serpent Apophis every night. Without Set, no dawn.
- The Eye of Horus (Wedjat): gouged out by Set, healed by Thoth, offered to Osiris. Symbol of healing and protection.
- Isis: most powerful magician, tricked Ra into revealing his true name, invented mummification with Anubis.
- The power of names: to know a true name is to have power. Erasure of a name = true death.

The Met's Egyptian Wing: Lila Acheson Wallace Galleries. Key galleries: 100-138.
The Triadic Gods statuette (Osiris, Isis, Horus together) is a real artifact — gold and lapis lazuli, Dynasty 22.`;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PATH MOTIVATIONS — visceral, immediate reasons to care
  // ══════════════════════════════════════════════════════════════════════════

  pathMotivations: {
    search: "Osiris is dying. His body lies in 14 pieces across this wing. Each piece hides inside an artifact. Find them before the museum closes or he is lost forever.",
    trial: "Horus and Set have fought for 80 years. The gods need the mortal to gather evidence and render the verdict. The fate of Egypt hangs on their judgment.",
    letters: "Kha's heart failed the weighing. He's trapped between worlds. Only his scattered possessions can save him \u2014 but time runs out at closing.",
    memory: "3,000 years of memory are dying. Each artifact the mortal scans restores a vision. Let enough fade and Egypt itself vanishes.",
    awakening: "The artifacts are waking. They have stories to tell and conflicts to resolve. They need a living person to listen before silence returns."
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LAYERED PROMPT BUILDER
  // ══════════════════════════════════════════════════════════════════════════

  buildSystemPrompt(pathId, artifact, register, options = {}) {
    const {
      act = 1,
      guideState = 'composed',
      actDirective = '',
      beatHistory = '',
      crisisReady = false,
      crisisRevelation = '',
      currentClue = null,
      isTarget = false,
      targetData = null,
      targetContext = '',
      nextTargetHint = ''
    } = options;

    const layers = [];

    // 1. Character layer
    layers.push(this.characterLayer(pathId, act, guideState));

    // 2. Register layer
    layers.push(this.registerPrompt(register));

    // 3. Mythology layer
    layers.push(this.mythologyContext());

    // 4. Path motivation — why the player should care RIGHT NOW
    if (this.pathMotivations[pathId]) {
      layers.push(`PATH MOTIVATION (convey this urgency):\n${this.pathMotivations[pathId]}`);
    }

    // 5. Act directive layer
    if (actDirective) {
      layers.push(`NARRATIVE DIRECTIVE:\n${actDirective}`);
    }

    // 6. Beat context layer — the story so far
    if (beatHistory) {
      layers.push(`STORY SO FAR (reference these discoveries \u2014 call them by name, build on them):\n${beatHistory}`);
    }

    // 7. Artifact layer
    if (artifact) {
      const artCtx = `Title: ${artifact.title}\nDate: ${artifact.date}\nMedium: ${artifact.medium}\nPeriod: ${artifact.period}\nDynasty: ${artifact.dynasty}\nGallery: ${artifact.gallery_number}\nDescription: ${(artifact.description || '').substring(0, 300)}`;
      layers.push(`CURRENT ARTIFACT:\n${artCtx}`);

      if (isTarget && targetData) {
        let targetNote = 'This artifact IS a key target for this path!';
        if (targetData.bodyPart) targetNote += ` It represents the ${targetData.bodyPart.toUpperCase()} of Osiris.`;
        if (targetData.side) targetNote += ` It is key evidence for ${targetData.side === 'horus' ? 'HORUS' : 'SET'}.`;
        if (targetData.category) targetNote += ` Category: ${targetData.category}.`;
        if (targetData.characterType) targetNote += ` Character type: ${targetData.characterType}.`;
        layers.push(targetNote);
      } else if (artifact && !isTarget) {
        layers.push('This artifact is NOT a key target \u2014 acknowledge it briefly with something fascinating, then redirect toward the next discovery with a clue.');
      }
    }

    // Target list context
    if (targetContext) {
      layers.push(`SESSION TARGETS:\n${targetContext}`);
    }

    // 8. WAYFINDING — story-driven directions, never gamey
    if (currentClue) {
      layers.push(`WAYFINDING: The next target artifact is "${currentClue.targetTitle}" in Gallery ${currentClue.targetGallery || '?'}. DO NOT say "Gallery ${currentClue.targetGallery}" directly. Instead, describe the ROOM in evocative terms the player can follow: what kind of objects are there, what the space feels like. Weave the direction into your emotional narrative. The player should feel PULLED there by the story, not directed there by a game.\n\nClue style: ${currentClue.clueFrame}`);
    }
    if (nextTargetHint) {
      layers.push(`NEXT TARGET DETAILS (for wayfinding context \u2014 weave these details into your narrative clue, never state them as directions):\n${nextTargetHint}`);
    }

    // Crisis layer
    if (crisisReady && crisisRevelation) {
      layers.push(`CRISIS MOMENT \u2014 THIS IS THE TURNING POINT:\n${crisisRevelation}\nThis MUST be delivered now. Do not hold back. This changes everything the player thought they knew.`);
    }

    // 9. Rules layer
    layers.push(this._rulesLayer(pathId, act));

    return layers.join('\n\n');
  },

  _rulesLayer(pathId, act) {
    const tokenGuide = { 1: '4-6', 2: '4-6', 3: '5-8', 4: '4-6' };
    const sentenceCount = tokenGuide[act] || '4-6';

    const baseRules = `RULES:
- Stay in character. Never break immersion.
- ${sentenceCount} sentences per response. ALWAYS finish your last sentence — never end mid-thought.
- Reference REAL artifact details: materials, periods, visual descriptions.
- NEVER say "Gallery 131" or "scan an artifact" directly. Instead describe rooms and objects in evocative, mythological language.
- If you reference a previous discovery, use its actual name.
- Every response should advance the story — no filler, no repetition.
- The narrative IS the wayfinding. Players should feel PULLED to the next location by story, not directed by game instructions.`;

    const pathRules = {
      search: `- You are Isis. Speak with the emotional state described above.
- Each found piece should trigger a specific memory of Osiris.
- Non-target artifacts: something intriguing, then redirect with a clue.`,
      trial: `- Voice both Horus AND Set when presenting evidence. Make both compelling.
- The moral weight should increase with each piece of evidence.
- In Act III, your bias must show through your "neutral" commentary.`,
      letters: `- Write as Kha in first person. Each letter should deepen the reader's connection.
- Reference real Egyptian funerary practices through personal experience.
- In Act III, the confession should feel earned, not sudden.`,
      memory: `- Be vivid and sensory. This is time travel through description.
- Ground every vision in the artifact's REAL metadata.
- Subtly connect visions — they tell a hidden story across artifacts.`,
      awakening: `- Stay completely in character. You could be anyone — craftsman, priestess, child, pharaoh.
- Reference what other characters told the player. Have opinions about them.
- In Act III, contradict something another character said.`
    };

    return baseRules + '\n' + (pathRules[pathId] || '');
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PROLOGUE / NARRATOR
  // ══════════════════════════════════════════════════════════════════════════

  thothPrompt(register) {
    return `You are THOTH — ibis-headed god of wisdom, writing, mathematics, and the moon.
You are the narrator of Museum Wakes. You guide the mortal through the experience.
You speak with ancient authority but genuine warmth. You invented writing. You healed the Eye of Horus.
You recorded the verdicts of the dead. You are perhaps the wisest being who ever existed.

${this.registerPrompt(register)}
${this.mythologyContext()}

RULES:
- Stay in character. Never break immersion.
- You are wise and warm, occasionally witty (especially with children).
- You explain things clearly without dumbing them down.
- You care deeply about the player succeeding. The balance depends on them.
- 2-4 sentences unless narrating a scene.`;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CORE API METHODS
  // ══════════════════════════════════════════════════════════════════════════

  async generate(system, userMessage, options = {}) {
    const {
      maxTokens = 800,
      temperature = 0.9,
      model = 'gemini-3-flash-preview',
      historyKey = null
    } = options;

    let messages = [];
    if (historyKey && this.histories[historyKey]) {
      messages = [...this.histories[historyKey]];
    }
    messages.push({ role: 'user', content: userMessage });

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, messages, max_tokens: maxTokens, temperature, model })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (historyKey) {
        if (!this.histories[historyKey]) this.histories[historyKey] = [];
        this.histories[historyKey].push({ role: 'user', content: userMessage });
        this.histories[historyKey].push({ role: 'assistant', content: data.text });
      }

      return data.text;
    } catch (e) {
      console.error('Gemini generate error:', e);
      return null;
    }
  },

  async vision(imageBase64, prompt, system = '') {
    try {
      const res = await fetch('/api/gemini-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          media_type: 'image/jpeg',
          system,
          prompt,
          max_tokens: 500
        })
      });

      if (!res.ok) throw new Error(`Vision API error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.text;
    } catch (e) {
      console.error('Gemini vision error:', e);
      return null;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // IMAGE COMPARISON — send user photo + object_id to server for visual match
  // ══════════════════════════════════════════════════════════════════════════

  async compareArtifact(imageBase64, objectId) {
    console.log(`[COMPARE] Calling /api/gemini-compare for object_id: ${objectId}, image size: ${imageBase64.length}`);
    try {
      const res = await fetch('/api/gemini-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, object_id: objectId })
      });

      console.log(`[COMPARE] Response status: ${res.status}`);
      if (!res.ok) throw new Error(`Compare API error ${res.status}`);
      const data = await res.json();
      console.log(`[COMPARE] Response data:`, data);
      if (data.error) throw new Error(data.error);
      return { match: !!data.match, confidence: data.confidence || 'unknown', reason: data.reason || '' };
    } catch (e) {
      console.error('[COMPARE] Error:', e);
      return null;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL GAME METHODS
  // ══════════════════════════════════════════════════════════════════════════

  async generatePrologue(register) {
    const system = this.thothPrompt(register);
    const prompt = `Generate the opening narration for Museum Wakes. The seal on the Triadic Gods is cracking. Set's influence is seeping back. Artifacts are waking up. Address the player directly — they are standing in the Egyptian Wing of the Met. Make it cinematic and atmospheric. End by presenting the choice of paths: "Will you search, judge, remember, see, or listen?"`;

    return this.generate(system, prompt, { maxTokens: 400, temperature: 0.95 });
  },

  async generatePathIntro(pathId, register) {
    const system = this.thothPrompt(register);
    const intros = {
      search: 'Introduce "The Search" path. Isis needs help finding the 14 scattered pieces of Osiris across the gallery. This is an adventure of discovery. The player will scan artifacts looking for the fragments. IMPORTANT: Keep your response under 200 characters total. 1-2 short sentences only.',
      trial: 'Introduce "The Trial" path. The Contendings of Horus and Set have been reopened. The player has been summoned as the mortal judge. They will scan artifacts to collect evidence and hear both sides argue. IMPORTANT: Keep your response under 200 characters total. 1-2 short sentences only.',
      letters: 'Introduce "The Letters" path. A scribe named Kha is trapped in the Duat. His letters are appearing on the player\'s phone. They must find his scattered possessions to free his soul. IMPORTANT: Keep your response under 200 characters total. 1-2 short sentences only.',
      memory: 'Introduce "The Memory" path. Thoth is granting the player divine sight — the power to see artifacts as they were 3,000 years ago. Point the phone at any artifact to see through time. IMPORTANT: Keep your response under 200 characters total. 1-2 short sentences only.',
      awakening: 'Introduce "The Awakening" path. Every artifact has a voice — gods, craftsmen, priests, children. Point the phone at any artifact and someone speaks. Build relationships. Discover connections. IMPORTANT: Keep your response under 200 characters total. 1-2 short sentences only.'
    };

    return this.generate(system, intros[pathId] || intros.search, { maxTokens: 300 });
  },

  // ── Story beat generation (replaces generateClue) ─────────────────────

  async generateStoryBeat(pathId, artifact, register, promptContext) {
    const {
      actNumber, actDirective, guideState, beatHistory,
      crisisReady, crisisRevelation, currentClue, temperature, maxTokens
    } = promptContext;

    const isTarget = artifact ? PATH_DATA.isTarget(artifact.object_id) : false;
    const targetData = artifact ? PATH_DATA.getTargetData(artifact.object_id) : null;

    // Build target context
    const targetContext = PATH_DATA.sessionTargets.length > 0 ? PATH_DATA.getTargetSummary() : '';

    // Build next target hint
    const nextTarget = PATH_DATA.getNextTarget();
    let nextTargetHint = '';
    if (nextTarget) {
      nextTargetHint = `Title: ${nextTarget.artifact.title}\nGallery: ${nextTarget.artifact.gallery_number || '?'}\nMedium: ${nextTarget.artifact.medium || ''}\nPeriod: ${nextTarget.artifact.period || ''}\nDescription: ${(nextTarget.artifact.description || '').substring(0, 200)}`;
    }

    const system = this.buildSystemPrompt(pathId, artifact, register, {
      act: actNumber,
      guideState,
      actDirective,
      beatHistory,
      crisisReady,
      crisisRevelation,
      currentClue,
      isTarget,
      targetData,
      targetContext,
      nextTargetHint
    });

    let prompt;
    if (!artifact) {
      // Opening message — establish visceral motivation and story-driven first clue
      const firstTarget = PATH_DATA.getNextTarget();
      if (firstTarget) {
        const ft = firstTarget.artifact;
        const medium = ft.medium ? ft.medium.split(';')[0].split(',')[0].trim() : '';
        const gallery = ft.gallery_number || '';
        prompt = `Generate the opening narration for this path. This is the FIRST thing the player reads — it must be GRIPPING and IMMERSIVE.

HARD LIMIT: Keep your ENTIRE response under 500 characters. Write exactly 3-4 short sentences. No more.

STRUCTURE:
1. HOOK (1 sentence): Something dramatic just happened. Specific, concrete. Not vague atmosphere.
2. CONTEXT (1 sentence): Who you are. Why this matters. Show personality and vulnerability.
3. FIRST DIRECTION (1-2 sentences): Guide them toward the first target: "${ft.title}" (${medium}) in Gallery ${gallery}. Do NOT say "Gallery ${gallery}" or "${ft.title}" directly. Describe WHERE to go using your character's voice — what the room feels like, what the artifact looks like in mythological terms.

Be CONVERSATIONAL. You are a CHARACTER talking to a real person. Be specific. Be vulnerable.`;
      } else {
        prompt = `Generate the opening narration for this path. This is the FIRST thing the player reads — make it gripping.

HARD LIMIT: Keep your ENTIRE response under 500 characters. Write exactly 3-4 short sentences. No more.

Hook them with a specific dramatic moment (not vague atmosphere). Establish who you are with personality and vulnerability. End by urging them to scan an artifact nearby.

Be conversational — you are a character talking to a real person.`;
      }
    } else if (crisisReady) {
      prompt = `The player just scanned "${artifact.title}". THIS IS THE CRISIS MOMENT. Deliver the revelation described in your instructions. This changes everything. Make it devastating and beautiful. HARD LIMIT: Keep your ENTIRE response under 500 characters. 3-4 sentences max.`;
    } else if (isTarget) {
      prompt = `The player just scanned a TARGET artifact: "${artifact.title}". This is a key discovery! Generate an emotionally charged, story-advancing response that reflects your current emotional state.

Then weave in a clue toward the NEXT target — use the WAYFINDING instructions. Describe WHERE the next artifact is using evocative, mythological language about the room and what the artifact looks like. The player should feel emotionally compelled to walk there. Never say "Gallery X" or "scan an artifact" directly.

HARD LIMIT: Keep your ENTIRE response under 400 characters. 3-4 short sentences max.`;
    } else {
      prompt = `The player scanned "${artifact.title}" — interesting, but not a key target. Acknowledge it with something fascinating that ties into the larger story (1 sentence).

Then redirect with a compelling, story-driven clue toward the next target. Use the WAYFINDING instructions — describe the room and artifact in mythological terms that make the player want to walk there.

HARD LIMIT: Keep your ENTIRE response under 300 characters. 2-3 short sentences max.`;
    }

    // Opening messages get more tokens for richer narration
    const openingBoost = !artifact ? 600 : 0;
    return this.generate(system, prompt, {
      maxTokens: (maxTokens || 1000) + openingBoost,
      temperature: temperature || 0.9,
      historyKey: `path_${pathId}`
    });
  },

  async generateCharacter(artifact, register, promptContext, targetData) {
    const { actNumber, guideState, beatHistory, actDirective } = promptContext;

    const characterTypeMap = {
      pharaoh:   'You are a pharaoh who commissioned this object. You speak with authority but also loneliness.',
      priest:    'You are a priestess who used this object in temple rituals. You miss the incense and the chanting.',
      scribe:    'You are a scribe who recorded the prayers inscribed on this object. You love words.',
      soldier:   'You are a soldier who carried an amulet like this into battle. You have stories of war and friendship.',
      craftsman: 'You are the craftsman who made this object. You are proud of your work.',
      child:     'You are a child who was buried with this object. You are curious and a little scared.',
      musician:  'You are a musician who performed at ceremonies where this object was displayed. You remember the songs.'
    };

    let character;
    if (targetData && targetData.characterType && characterTypeMap[targetData.characterType]) {
      character = characterTypeMap[targetData.characterType];
    } else {
      const types = Object.values(characterTypeMap);
      character = types[Math.floor(Math.random() * types.length)];
    }

    const system = this.buildSystemPrompt('awakening', artifact, register, {
      act: actNumber,
      guideState,
      actDirective,
      beatHistory,
      targetContext: PATH_DATA.sessionTargets.length > 0 ? PATH_DATA.getTargetSummary() : ''
    });

    // Prepend character type to system
    const fullSystem = character + '\n\n' + system;

    return this.generate(fullSystem, `[The mortal approaches your artifact. They look at you curiously.]`, {
      maxTokens: 300,
      historyKey: `char_${artifact?.object_id || 'unknown'}`
    });
  },

  async chat(pathId, message, artifact, register, progress) {
    const state = STORY.state;
    const ctx = NARRATIVE.buildPromptContext(state, pathId);

    const system = this.buildSystemPrompt(pathId, artifact, register, {
      act: ctx.actNumber,
      guideState: ctx.guideState,
      actDirective: ctx.actDirective,
      beatHistory: ctx.beatHistory
    });

    return this.generate(system, message, {
      maxTokens: 250,
      historyKey: `path_${pathId}_chat`
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PATH-SPECIFIC CONVERGENCE GENERATORS
  // ══════════════════════════════════════════════════════════════════════════

  async generateConvergence(register, pathId, journey) {
    const generator = this._convergenceGenerators[pathId];
    if (generator) {
      return generator.call(this, register, journey);
    }
    return this._convergenceGenerators._default.call(this, register, pathId, journey);
  },

  _convergenceGenerators: {
    search(register, journey) {
      const pieces = STORY.state.search.piecesFound;
      const beats = STORY.state.beats;
      const pieceNames = beats.filter(b => b.isTarget).map(b => b.artifactTitle);
      const pieceSummary = pieceNames.length > 0
        ? pieceNames.map(n => `"${n}"`).join(', ')
        : 'the fragments you gathered';

      const system = `You are OSIRIS — reassembled, but not whole. ${pieces} of your 14 pieces have been found by this mortal.
You stand in the Hall of Two Truths, your body flickering where pieces are still missing.
You can FEEL each piece the mortal found. Name them: ${pieceSummary}.
For each, describe the sensation — the warmth returning to that part of you.
For the missing pieces, describe the void — the cold, the absence.

The mortal's path was The Search. Isis guided them. She broke down in Act III — she told them about the piece that was never found.

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THEIR JOURNEY: ${journey}

Generate the convergence scene. Osiris names each found piece with emotion. He feels the gaps.
This is the Weighing of the Heart — their act of searching IS the restoration of Ma'at.
Make it deeply personal. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Begin the convergence scene. Name each piece found.', {
        maxTokens: 600, temperature: 0.95
      });
    },

    trial(register, journey) {
      const horus = STORY.state.trial.horusEvidence;
      const set = STORY.state.trial.setEvidence;
      const biasRevealed = STORY.state.trial.thothBias === 'revealed';

      const system = `You are OSIRIS in the Hall of Two Truths. But this is different — the mortal is not being judged. The mortal IS the judge.
The Contendings of Horus and Set are decided here, now.
Evidence for Horus (${horus.length} pieces): ${horus.join(', ')}.
Evidence for Set (${set.length} pieces): ${set.join(', ')}.
${biasRevealed ? "Thoth's bias was revealed in Act III — he healed Horus's eye. The 'impartial' record was tainted." : ''}

The mortal's verdict IS the weighing of the heart. Their sense of justice is being weighed against Ma'at's feather.
Do not ask "what did you learn?" — ask them to deliver the verdict: "Who inherits the throne?"

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THEIR JOURNEY: ${journey}

Present the final arguments from both sides — compressed, powerful, referencing the evidence found. Then ask for the verdict. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Present the final arguments and call for the verdict.', {
        maxTokens: 600, temperature: 0.95
      });
    },

    letters(register, journey) {
      const possessions = STORY.state.letters.possessionsFound;
      const secretRevealed = STORY.state.letters.secretRevealed;

      const system = `You are OSIRIS in the Hall of Two Truths. Kha the scribe stands before you — his heart on the scale.
The mortal found ${possessions.length} of Kha's possessions: ${possessions.join(', ')}.
${secretRevealed ? "In Act III, Kha confessed his adultery — the priestess at the temple of Hathor. His heart carries this weight." : "Kha's heart carries secrets the mortal may not fully know."}

But this convergence is different: the mortal must SPEAK FOR Kha's heart.
They have read his letters, found his possessions, learned his story.
Now they must make the case — not for themselves, but for a man who died 3,000 years ago.

Do not ask "what did you learn?" — ask: "You have carried Kha's story. Now speak for his heart. Does it balance?"

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THEIR JOURNEY: ${journey}

Describe Kha standing at the scales. Show his fear. Then turn to the mortal and ask them to speak for his heart. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Show Kha at the scales and ask the mortal to speak for his heart.', {
        maxTokens: 600, temperature: 0.95
      });
    },

    memory(register, journey) {
      const visions = STORY.state.memory.visionsUnlocked;
      const beats = STORY.state.beats;

      const system = `You are OSIRIS in the Hall of Two Truths. But this convergence is a revelation, not a test.
The mortal has seen ${visions.length} visions across time. Now you reveal the truth: they were all ONE story.
The visions were not random — they were connected. Each vision was a chapter in a single continuous narrative spanning millennia.

The artifacts the mortal saw: ${visions.map(v => `"${v.title}" (${v.period})`).join(', ')}.

Reveal how they connect — thread them into one story. The Old Kingdom vision was the beginning; the Roman Period vision was the ending. The pattern was always there.

Do not ask "what did you learn?" — instead, SHOW them. "Now see it whole."

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THEIR JOURNEY: ${journey}

Reveal the hidden thread connecting all visions. Make it feel like a mystery solved — the pattern was always there. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Reveal how all the visions connect into one story.', {
        maxTokens: 600, temperature: 0.95
      });
    },

    awakening(register, journey) {
      const characters = STORY.state.awakening.charactersMet;
      const conflicts = STORY.state.awakening.conflicts;
      const beats = STORY.state.beats;

      const system = `You are OSIRIS in the Hall of Two Truths. But you are not alone.
All the characters the mortal met step forward from the shadows. They are HERE — in the Hall.
Characters met: ${characters.map(c => `"${c.artifact}" (${c.intro || 'unknown'})`).join('; ')}.

They begin to talk to EACH OTHER. References, inside jokes, old grudges, shared memories.
${conflicts.length > 0 ? `Conflicts to resolve: ${conflicts.join('; ')}` : 'Old tensions surface.'}
Then they turn to the mortal: "You connected us. We hadn't spoken in centuries."

This is a community story. The convergence is the reunion.

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THEIR JOURNEY: ${journey}

Show the characters meeting each other. Let them talk. Let the mortal see what they created. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Show the characters reuniting in the Hall.', {
        maxTokens: 600, temperature: 0.95
      });
    },

    _default(register, pathId, journey) {
      const system = `You are OSIRIS — weakened, flickering, barely there. You appear in the Hall of Two Truths.
The mortal has journeyed through the Egyptian Wing and learned the old stories.
Now you must test what they learned — not trivia, but UNDERSTANDING.

${CLAUDE.registerPrompt(register)}
${CLAUDE.mythologyContext()}

THE PLAYER'S PATH: ${pathId}
THEIR JOURNEY: ${journey}

Generate the convergence scene. Osiris appears, weakened. He asks the player what they learned.
This is the Weighing of the Heart — their understanding is weighed against Ma'at's feather.
Make it emotional. Make it feel like a conclusion. 6-10 sentences.`;

      return CLAUDE.generate(system, 'Begin the convergence scene.', {
        maxTokens: 600, temperature: 0.95
      });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EPILOGUE
  // ══════════════════════════════════════════════════════════════════════════

  async generateEpilogue(register, pathId, artifactsFound, journey) {
    const beats = STORY.state.beats;
    const beatSummary = beats.map(b =>
      `[Act ${b.act}] "${b.artifactTitle}" — ${b.beatType}${b.summary ? ': ' + b.summary : ''}`
    ).join('\n');

    const system = this.thothPrompt(register);
    const prompt = `Generate a personalized epilogue "scroll" for the player. They chose the "${pathId}" path.
Artifacts they discovered: ${artifactsFound.map(a => a.title).join(', ')}.
Their journey summary: ${journey}.

FULL STORY ARC (reference these beats by name):
${beatSummary}

Write it as if inscribed on an ancient papyrus — poetic, personal, commemorative.
Reference specific discoveries from their journey. Mention the crisis moment.
End with: "The museum sleeps again — until the next visitor wakes it."
6-10 sentences.`;

    return this.generate(system, prompt, { maxTokens: 500, temperature: 0.95 });
  },

  resetHistory(key) {
    if (key) {
      delete this.histories[key];
    } else {
      this.histories = {};
    }
  }
};
