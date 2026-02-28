// narrative-engine.js — Dramatic arc logic for Museum Wakes
// Encapsulates act transitions, beat classification, guide emotional states,
// clue chain generation, convergence readiness, and prompt context building.

const NARRATIVE = {

  // ── Act definitions ─────────────────────────────────────────────────────
  acts: {
    1: { name: 'THE CALL',    scanRange: [1, 2], tensionBase: 15,  temperature: 0.85, maxTokens: 350 },
    2: { name: 'THE DESCENT', scanRange: [3, 5], tensionBase: 40,  temperature: 0.90, maxTokens: 400 },
    3: { name: 'THE CRISIS',  scanRange: [6, 7], tensionBase: 75,  temperature: 0.95, maxTokens: 500 },
    4: { name: 'THE RETURN',  scanRange: [8, 99], tensionBase: 90, temperature: 0.92, maxTokens: 450 }
  },

  // ── Guide emotional states per path per act ────────────────────────────
  guideStates: {
    search:    { 1: 'composed',   2: 'fractured',    3: 'desperate',     4: 'at peace' },
    trial:     { 1: 'scholarly',  2: 'troubled',     3: 'confessional',  4: 'transcendent' },
    letters:   { 1: 'formal',    2: 'warm',          3: 'guarded',       4: 'released' },
    memory:    { 1: 'delighted', 2: 'melancholic',   3: 'grieving',      4: 'hopeful' },
    awakening: { 1: 'friendly',  2: 'curious',       3: 'conflicted',    4: 'unified' }
  },

  // ── Act directive templates ────────────────────────────────────────────
  actDirectives: {
    1: `ACT I — THE CALL: This is the beginning. Establish the mystery. Introduce yourself with warmth and intrigue. Plant the first seeds of the story. The player is new — draw them in gently but irresistibly. Each response should feel like an invitation deeper.`,

    2: `ACT II — THE DESCENT: The story deepens. Tension rises. Complications emerge. Reference what came before — call back to earlier discoveries by name. Your emotional state is shifting. The stakes are becoming personal. Each artifact reveals something that complicates the simple story the player thought they knew.`,

    3: `ACT III — THE CRISIS: This is the turning point. Something hidden must be revealed. Your composure breaks. A confession, a secret, a terrible truth emerges. This is the most emotionally raw moment of the journey. The player should feel the weight of what they've uncovered. Reference the full arc of discoveries. This changes everything.`,

    4: `ACT IV — THE RETURN: Resolution approaches. The raw emotion of the crisis gives way to hard-won wisdom. Reference the entire journey — every discovery, every revelation. The tone shifts toward acceptance and earned understanding. The convergence awaits. Guide the player toward the Hall of Two Truths with reverence.`
  },

  // ── Path-specific crisis revelations ───────────────────────────────────
  crisisRevelations: {
    search: `CRISIS REVELATION: Isis must confess the terrible truth — the 14th piece, the phallus of Osiris, was never found. It was swallowed by the oxyrhynchus fish in the Nile. She had to craft a replacement from gold. This is the wound that never fully healed. The reassembly was imperfect. Osiris rules the dead because he could never fully return to the living. Let the grief pour out.`,

    trial: `CRISIS REVELATION: Thoth must confess his bias. He is not the neutral recorder he has pretended to be. He healed the Eye of Horus after Set gouged it out. He has already taken a side. The "impartial" judge is compromised. Every piece of evidence he presented was subtly weighted. Ask the player: knowing this, does the verdict change? Can justice exist when even the recorder is biased?`,

    letters: `CRISIS REVELATION: Kha must confess. He was unfaithful to Merit. There was someone else — a priestess at the temple of Hathor. The guilt consumed him. His heart is heavy not from the missing possessions but from the betrayal. He cannot forgive himself. The possessions the player has found — they belonged to both lives. Ask: can a flawed heart still be weighed fairly?`,

    memory: `CRISIS REVELATION: Thoth must show the worst vision — the moment an artifact was forgotten. Not broken, not stolen — simply forgotten. The last person who knew what it meant died, and no one cared to ask. Show the artifact sitting in darkness, its story dissolving into silence. This is the death that matters most: the death of memory. The player is the first person to see it in centuries.`,

    awakening: `CRISIS REVELATION: The characters the player has met begin to contradict each other. The pharaoh claims the craftsman was a slave; the craftsman says he was free and proud. The priest says the ceremony was sacred; the musician says it was political theater. Someone is lying — or memory itself is unreliable. The player must decide which version of history to believe.`
  },

  // ── Beat type classification ───────────────────────────────────────────

  classifyBeat(act, isTarget, scanIndex, crisisDelivered) {
    if (act === 3 && !crisisDelivered) return 'crisis';
    if (act === 4) return 'resolution';
    if (isTarget && act >= 2) return 'revelation';
    if (!isTarget && act >= 2) return 'complication';
    return 'discovery';
  },

  narrativeWeight(act, isTarget, beatType) {
    const baseWeights = { 1: 0.2, 2: 0.4, 3: 0.8, 4: 0.6 };
    let weight = baseWeights[act] || 0.3;
    if (isTarget) weight += 0.15;
    if (beatType === 'crisis') weight = 1.0;
    if (beatType === 'revelation') weight += 0.1;
    return Math.min(1.0, weight);
  },

  // ── Act transition evaluation ──────────────────────────────────────────

  evaluateActTransition(state) {
    const totalScans = state.artifactsScanned.length;
    const currentAct = state.act.current;
    const beatsInAct = state.act.beatsInAct;

    if (currentAct >= 4) return null;

    // Composite conditions for each transition
    switch (currentAct) {
      case 1:
        // Act I -> II: after 2+ scans, at least 1 beat in act
        if (totalScans >= 2 && beatsInAct >= 2) return 2;
        break;
      case 2:
        // Act II -> III: after 5+ scans, at least 2 beats in act, tension rising
        if (totalScans >= 5 && beatsInAct >= 2) return 3;
        break;
      case 3:
        // Act III -> IV: after crisis delivered and 7+ scans
        if (totalScans >= 7 && state.act.crisisDelivered && beatsInAct >= 1) return 4;
        break;
    }

    return null;
  },

  // ── Convergence readiness (path-specific, not counter-based) ───────────

  evaluateConvergence(state, pathId) {
    const scans = state.artifactsScanned.length;
    const act = state.act.current;
    const path = STORY.paths[pathId];
    if (!path) return false;

    // Must be in act 4 or late act 3 with crisis delivered
    if (act < 3) return false;
    if (act === 3 && !state.act.crisisDelivered) return false;

    // Must have minimum scans
    if (scans < path.minArtifacts) return false;

    // Path-specific conditions
    switch (pathId) {
      case 'search':
        return state.search.piecesFound >= 3;
      case 'trial':
        return state.trial.horusEvidence.length >= 2 && state.trial.setEvidence.length >= 2;
      case 'letters':
        return state.letters.possessionsFound.length >= 3;
      case 'memory':
        return state.memory.visionsUnlocked.length >= 3;
      case 'awakening':
        return state.awakening.charactersMetIds.length >= 3;
      default:
        return scans >= path.minArtifacts;
    }
  },

  // ── Clue chain generation ──────────────────────────────────────────────

  generateClueChain(pathId, targets) {
    if (!targets || targets.length === 0) return { links: [], currentLink: 0 };

    const links = [];
    const templates = this._clueTemplates(pathId);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const nextTarget = targets[i + 1] || null;
      const template = templates[i % templates.length];

      links.push({
        targetId: target.artifact.object_id,
        targetTitle: target.artifact.title,
        targetGallery: target.artifact.gallery_number,
        targetMedium: target.artifact.medium,
        clueStyle: template.style,
        clueFrame: template.frame,
        nextTargetId: nextTarget ? nextTarget.artifact.object_id : null,
        nextTargetTitle: nextTarget ? nextTarget.artifact.title : null,
        found: false
      });
    }

    return { links, currentLink: 0 };
  },

  _clueTemplates(pathId) {
    const templates = {
      search: [
        { style: 'memory',   frame: 'Isis remembers touching this part of Osiris — the warmth that lingered' },
        { style: 'sensory',  frame: 'She can still feel where it was severed — the phantom pain guides her' },
        { style: 'grief',    frame: 'She wept when she found this piece — the tears became the Nile flood' },
        { style: 'magic',    frame: 'Her magic pulls toward it — the fragments call to each other' },
        { style: 'urgency',  frame: 'Set\'s agents are near — she can feel their darkness closing in' },
        { style: 'hope',     frame: 'With each piece found, his voice grows clearer in her dreams' }
      ],
      trial: [
        { style: 'testimony',   frame: 'A witness steps forward with new evidence — examine it carefully' },
        { style: 'argument',    frame: 'Horus presents his case — but Set objects, pointing to another artifact' },
        { style: 'precedent',   frame: 'Thoth recalls a similar case from the archives — the evidence awaits' },
        { style: 'doubt',       frame: 'The Ennead murmurs — something doesn\'t add up. More evidence is needed' },
        { style: 'revelation',  frame: 'A sealed chamber is opened — crucial evidence has been hidden' }
      ],
      letters: [
        { style: 'nostalgia',   frame: 'Kha writes: "I used to hold this every morning before dawn prayers"' },
        { style: 'confession',  frame: 'Kha writes: "Merit gave this to me on our wedding day. I don\'t deserve it"' },
        { style: 'fear',        frame: 'Kha writes: "The assessors are asking about this object. They know"' },
        { style: 'tenderness',  frame: 'Kha writes: "My daughter played with something like this. She had my eyes"' },
        { style: 'desperation', frame: 'Kha writes: "Please hurry — the gates are closing. Find what remains of me"' }
      ],
      memory: [
        { style: 'glory',      frame: 'The vision shows this artifact in its prime — gleaming, revered, alive' },
        { style: 'ceremony',   frame: 'A great ritual surrounds it — priests chanting, incense thick in torchlight' },
        { style: 'intimacy',   frame: 'A private moment — someone touching this artifact with trembling hands' },
        { style: 'decay',      frame: 'Time accelerates — watch as centuries strip away the paint, the gold, the meaning' },
        { style: 'forgetting', frame: 'The last person who knew its name is dying — and no one asks' }
      ],
      awakening: [
        { style: 'greeting',   frame: 'A new voice calls out — someone has been waiting to be heard' },
        { style: 'gossip',     frame: 'A character whispers about another artifact\'s inhabitant — intrigue builds' },
        { style: 'quest',      frame: 'A favor is asked — find something that connects two stories' },
        { style: 'conflict',   frame: 'Two characters disagree — the player must seek the truth elsewhere' },
        { style: 'reunion',    frame: 'Someone recognizes the player — or claims to. Trust is complicated' }
      ]
    };

    return templates[pathId] || templates.search;
  },

  // ── Prompt context builder ─────────────────────────────────────────────

  buildPromptContext(state, pathId) {
    const beats = state.beats || [];
    const act = state.act || { current: 1 };
    const clueChain = state.clueChain || { links: [], currentLink: 0 };

    return {
      actNumber: act.current,
      actName: this.acts[act.current]?.name || 'THE CALL',
      actDirective: this.actDirectives[act.current] || '',
      guideState: this.getGuideState(pathId, act.current),
      tensionLevel: act.tensionLevel || 0,
      temperature: this.acts[act.current]?.temperature || 0.9,
      maxTokens: this.acts[act.current]?.maxTokens || 400,
      crisisReady: act.current === 3 && !act.crisisDelivered,
      crisisRevelation: this.crisisRevelations[pathId] || '',

      // Beat history for AI context
      beatHistory: this._formatBeatHistory(beats),
      beatCount: beats.length,
      recentBeats: beats.slice(-3),

      // Current clue chain link
      currentClue: clueChain.links[clueChain.currentLink] || null,
      nextClue: clueChain.links[clueChain.currentLink + 1] || null,
      cluesRemaining: clueChain.links.length - clueChain.currentLink,

      // Convergence status
      convergenceReady: this.evaluateConvergence(state, pathId)
    };
  },

  _formatBeatHistory(beats) {
    if (beats.length === 0) return 'No discoveries yet — this is the beginning of the journey.';

    return beats.map((b, i) => {
      let line = `Beat ${i + 1} [Act ${b.act}, ${b.beatType}]: "${b.artifactTitle}"`;
      if (b.summary) line += ` — ${b.summary}`;
      if (b.clueGiven) line += ` [Clue planted: ${b.clueGiven}]`;
      if (b.turningPoint) line += ' *TURNING POINT*';
      return line;
    }).join('\n');
  },

  getGuideState(pathId, act) {
    const states = this.guideStates[pathId];
    return states ? (states[act] || 'composed') : 'composed';
  },

  // ── Beat creation helper ───────────────────────────────────────────────

  createBeat(artifact, act, isTarget, beatType, options = {}) {
    return {
      id: `beat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      act,
      artifactId: artifact?.object_id || 'unknown',
      artifactTitle: artifact?.title || 'Unknown artifact',
      isTarget,
      beatType,
      narrativeWeight: this.narrativeWeight(act, isTarget, beatType),
      summary: options.summary || '',
      clueGiven: options.clueGiven || '',
      referencedBeats: options.referencedBeats || [],
      turningPoint: beatType === 'crisis' || beatType === 'revelation',
      timestamp: Date.now()
    };
  },

  // ── Tension calculation ────────────────────────────────────────────────

  calculateTension(state) {
    const act = state.act?.current || 1;
    const base = this.acts[act]?.tensionBase || 15;
    const beatBonus = (state.act?.beatsInAct || 0) * 5;
    const targetBonus = (state.beats || []).filter(b => b.isTarget).length * 3;
    const crisisBonus = state.act?.crisisDelivered ? 20 : 0;

    return Math.min(100, base + beatBonus + targetBonus + crisisBonus);
  }
};
