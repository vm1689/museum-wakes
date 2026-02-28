// story-engine.js — Multi-path state machine for Museum Wakes
// Now with act system, story beats, and clue chains

const STORY = {
  state: {
    phase: 'prologue',        // prologue | path-select | playing | convergence | epilogue
    register: 'adult',        // kid | teen | adult | family
    pathId: null,              // search | trial | letters | memory | awakening
    artifactsScanned: [],      // Array of artifact objects scanned during play
    cluesCollected: [],
    chatHistory: [],
    pathProgress: 0,           // 0-100 percentage
    convergenceReady: false,
    epilogueDone: false,

    // NEW: Act system
    act: {
      current: 1,              // 1-4
      beatsInAct: 0,
      tensionLevel: 0,         // 0-100
      guideEmotionalState: 'composed',
      transitionPending: false,
      crisisDelivered: false
    },

    // NEW: Beat system
    beats: [],                 // StoryBeat objects

    // NEW: Clue chain
    clueChain: { links: [], currentLink: 0 },

    // Path-specific state (enriched)
    search: {
      piecesFound: 0,
      targetArtifacts: [],
      currentClue: null,
      isisState: 'composed'
    },
    trial: {
      horusEvidence: [],
      setEvidence: [],
      witnessesHeard: [],
      verdict: null,
      thothBias: 'hidden'
    },
    letters: {
      lettersReceived: [],
      possessionsFound: [],
      ritesPerformed: 0,
      secretRevealed: false
    },
    memory: {
      visionsUnlocked: [],
      dynastyPattern: null,
      hiddenNarrative: [],
      connectionsFound: []
    },
    awakening: {
      charactersMetIds: [],
      charactersMet: [],
      questsGiven: [],
      questsCompleted: [],
      relationships: {},
      conflicts: [],
      reconciled: false
    }
  },

  // Path definitions
  paths: {
    search: {
      id: 'search',
      name: 'The Search',
      subtitle: 'Find the 14 Pieces of Osiris',
      icon: '\uD83D\uDD0D',
      iconUrl: '/icons/path-search.png',
      tone: 'Adventure, discovery, wonder',
      bestFor: 'Families, younger players, first-time visitors',
      description: 'Osiris was torn into 14 pieces and scattered across the museum. Scan artifacts to find each fragment.',
      guide: 'Isis',
      color: '#4B7EC8',
      minArtifacts: 7,
      targetArtifacts: 14,
      registerContent: {
        kid: {
          subtitle: 'Find the Hidden Treasure Pieces!',
          description: 'Osiris needs your help! His magic was shattered into 14 secret pieces hidden in the museum. Use your phone to scan artifacts and find them all before time runs out!',
          tone: 'Adventure, treasure hunt, teamwork'
        },
        teen: {
          subtitle: 'Piece Together the Mystery',
          description: 'Something ancient was broken apart and scattered. 14 fragments — hidden in plain sight. Scan artifacts, decode the pattern, reconstruct what was lost.',
          tone: 'Mystery, puzzle-solving, discovery'
        },
        adult: {
          subtitle: 'Find the 14 Pieces of Osiris',
          description: 'The Osiris myth — dismemberment and resurrection — comes alive as you trace 14 artifacts through the galleries. Each scan reveals another fragment of the oldest story ever told.',
          tone: 'Archaeological discovery, literary depth'
        },
        family: {
          subtitle: 'A Treasure Hunt for Everyone!',
          description: 'Work together to find 14 hidden pieces scattered across the Egyptian Wing. Each artifact you scan reveals part of an ancient mystery. Can your family solve it?',
          tone: 'Cooperative, fun, educational'
        }
      }
    },
    trial: {
      id: 'trial',
      name: 'The Trial',
      subtitle: 'Judge the Contendings of Horus and Set',
      icon: '\u2696\uFE0F',
      iconUrl: '/icons/path-trial.png',
      tone: 'Moral complexity, critical thinking, drama',
      bestFor: 'Teens, adults, narrative lovers',
      description: 'The trial of Horus and Set has reopened. You are the judge. Scan artifacts to hear testimony and deliver your verdict.',
      guide: 'Thoth',
      color: '#C8A84B',
      minArtifacts: 5,
      targetArtifacts: 10,
      registerContent: {
        kid: {
          subtitle: 'Be the Judge!',
          description: 'Two powerful gods are fighting and YOU get to decide who wins! Scan artifacts to collect clues, hear both sides, and deliver the ultimate verdict!',
          tone: 'Exciting, fair play, detective'
        },
        teen: {
          subtitle: 'Nothing Is What It Seems',
          description: 'The gods\' trial has been rigged for millennia. Gather evidence, question witnesses, expose the truth — if you can handle what you find.',
          tone: 'Conspiracy, moral ambiguity, edge'
        },
        adult: {
          subtitle: 'Judge the Contendings of Horus and Set',
          description: 'A mythological trial 80 years in the making reopens. Weigh testimony from gods, examine artifacts as evidence, and render a verdict that shapes the cosmos.',
          tone: 'Moral complexity, critical thinking, drama'
        },
        family: {
          subtitle: 'A Mystery to Solve Together!',
          description: 'Two gods need your family to settle their argument! Explore the galleries, gather evidence together, and vote on the verdict. Who will your family side with?',
          tone: 'Collaborative, debate, family decision'
        }
      }
    },
    letters: {
      id: 'letters',
      name: 'The Letters',
      subtitle: 'Free a Scribe\'s Soul',
      icon: '\uD83D\uDCDC',
      iconUrl: '/icons/path-letters.png',
      tone: 'Intimate, emotional, literary',
      bestFor: 'Adults, readers, story lovers',
      description: 'A scribe named Kha died 3,000 years ago and is trapped in the underworld. Find his possessions to free his soul.',
      guide: 'Kha',
      color: '#7A4BC8',
      minArtifacts: 5,
      targetArtifacts: 10,
      registerContent: {
        kid: {
          subtitle: 'Help a Friendly Ghost!',
          description: 'A ghost named Kha is stuck and needs your help! Find his lost things hidden in the museum so he can finally go home. He\'ll send you magical letters as clues!',
          tone: 'Spooky-fun, helpful, letters'
        },
        teen: {
          subtitle: 'A Dead Man Is Writing to You',
          description: 'Kha died 3,000 years ago. He shouldn\'t be able to write. But his letters keep appearing — desperate, personal, running out of time. Find what he lost before silence takes him.',
          tone: 'Haunting, personal, urgent'
        },
        adult: {
          subtitle: 'Free a Scribe\'s Soul',
          description: 'The scribe Kha failed his weighing of the heart. Through intimate letters from the underworld, he guides you to his scattered possessions — each one a fragment of a life lived and lost.',
          tone: 'Intimate, emotional, literary'
        },
        family: {
          subtitle: 'Letters from the Past!',
          description: 'A friendly ancient scribe needs your family\'s help! He\'s sending letters with clues about his lost belongings. Work together to find them all and set his spirit free!',
          tone: 'Cooperative, story-driven, warm'
        }
      }
    },
    memory: {
      id: 'memory',
      name: 'The Memory',
      subtitle: 'See Through Time',
      icon: '\uD83D\uDC41\uFE0F',
      iconUrl: '/icons/path-memory.png',
      tone: 'Awe, beauty, time-travel wonder',
      bestFor: 'Visual learners, all ages',
      description: 'Thoth grants you divine sight. Scan any artifact to see it as it was 3,000 years ago \u2014 vivid, alive, and whole.',
      guide: 'Thoth',
      color: '#4BC8A8',
      minArtifacts: 5,
      targetArtifacts: 10,
      registerContent: {
        kid: {
          subtitle: 'Magic Time-Travel Vision!',
          description: 'You\'ve been given magic eyes! Point your phone at any old artifact and see what it looked like when it was brand new — bright colors, shining gold, and ancient secrets!',
          tone: 'Wonder, magic, time travel'
        },
        teen: {
          subtitle: 'See What No One Else Can',
          description: 'You can see through time. Every artifact hides a memory — scan it and the veil lifts. 3,000 years dissolve. What was broken becomes whole. What was silent speaks.',
          tone: 'Surreal, powerful, unique'
        },
        adult: {
          subtitle: 'See Through Time',
          description: 'Thoth grants divine sight. Each artifact you scan reveals its original context — the temple it adorned, the ceremony it witnessed, the hands that made it. Memory as resurrection.',
          tone: 'Awe, beauty, time-travel wonder'
        },
        family: {
          subtitle: 'Travel Back in Time Together!',
          description: 'Your whole family gets time-travel vision! Scan artifacts together and watch them transform — see ancient Egypt come alive with color, sound, and story!',
          tone: 'Shared wonder, visual, educational'
        }
      }
    },
    awakening: {
      id: 'awakening',
      name: 'The Awakening',
      subtitle: 'Talk to the Artifacts',
      icon: '\uD83D\uDCAC',
      iconUrl: '/icons/path-awakening.png',
      tone: 'Conversational, surprising, relationship-driven',
      bestFor: 'Social players, curious minds',
      description: 'Every artifact has a voice \u2014 gods, craftsmen, priestesses, soldiers. They remember you and give you quests.',
      guide: 'Various characters',
      color: '#C8784B',
      minArtifacts: 5,
      targetArtifacts: 10,
      registerContent: {
        kid: {
          subtitle: 'Make Friends with Ancient Things!',
          description: 'The artifacts are alive and want to be your friend! Each one has a personality, a story, and a quest just for you. Scan them and start a conversation!',
          tone: 'Friendly, fun, social'
        },
        teen: {
          subtitle: 'They\'ve Been Waiting to Talk',
          description: 'Every artifact remembers being alive. Scan them and they\'ll speak — with opinions, grudges, and secrets. Some might even ask you for help. Will you listen?',
          tone: 'Surprising, witty, character-driven'
        },
        adult: {
          subtitle: 'Talk to the Artifacts',
          description: 'Gods, craftsmen, priestesses, soldiers — every artifact has a voice and a story. They remember you between scans. They give quests, form relationships, and have conflicts only you can resolve.',
          tone: 'Conversational, surprising, relationship-driven'
        },
        family: {
          subtitle: 'The Museum Is Alive!',
          description: 'Tonight the artifacts can talk! Meet ancient characters together — each family member can chat with different gods and craftsmen. They have quests for your whole family!',
          tone: 'Social, inclusive, character-driven'
        }
      }
    }
  },

  // ── Lifecycle ────────────────────────────────────────────────────────────

  init() {
    this.load();
  },

  setRegister(register) {
    this.state.register = register;
    this.save();
  },

  selectPath(pathId) {
    if (!this.paths[pathId]) return false;
    this.state.pathId = pathId;
    this.state.phase = 'playing';
    this.state.pathProgress = 0;

    // Reset act system
    this.state.act = {
      current: 1,
      beatsInAct: 0,
      tensionLevel: 0,
      guideEmotionalState: NARRATIVE.getGuideState(pathId, 1),
      transitionPending: false,
      crisisDelivered: false
    };
    this.state.beats = [];

    CLAUDE.resetHistory();

    // Sample session targets from the artifact pool
    if (CATALOG.loaded) {
      const count = this.paths[pathId].targetArtifacts;
      PATH_DATA.sampleTargets(pathId, CATALOG, count);

      // Generate clue chain
      this.state.clueChain = NARRATIVE.generateClueChain(pathId, PATH_DATA.sessionTargets);
      console.log(`[STORY] Clue chain generated: ${this.state.clueChain.links.length} links`);
    }

    this.save();
    return true;
  },

  // ── Beat recording (replaces flat recordScan) ─────────────────────────

  recordBeat(artifact, aiResponse, isTarget, targetData) {
    if (!artifact) return null;

    // Don't record duplicates
    if (this.state.artifactsScanned.find(a => a.object_id === artifact.object_id)) {
      return { duplicate: true, artifact };
    }

    // Record the scan
    this.state.artifactsScanned.push({
      object_id: artifact.object_id,
      title: artifact.title,
      gallery_number: artifact.gallery_number,
      date: artifact.date,
      medium: artifact.medium,
      period: artifact.period,
      dynasty: artifact.dynasty,
      timestamp: Date.now()
    });

    // Update path-specific state
    this._updatePathState(artifact, isTarget, targetData);

    // Classify the beat
    const beatType = NARRATIVE.classifyBeat(
      this.state.act.current,
      isTarget,
      this.state.artifactsScanned.length,
      this.state.act.crisisDelivered
    );

    // Create the story beat
    const beat = NARRATIVE.createBeat(artifact, this.state.act.current, isTarget, beatType, {
      summary: this._extractSummary(aiResponse),
      clueGiven: this._extractClue(aiResponse),
      referencedBeats: this._findReferencedBeats(aiResponse)
    });

    this.state.beats.push(beat);
    this.state.act.beatsInAct++;

    // Mark crisis as delivered if this was a crisis beat
    if (beatType === 'crisis') {
      this.state.act.crisisDelivered = true;
    }

    // Update tension
    this.state.act.tensionLevel = NARRATIVE.calculateTension(this.state);

    // Advance clue chain if target was found
    if (isTarget) {
      this.advanceClueChain(artifact.object_id);
    }

    // Update progress
    this._updateProgress();

    // Check for act transition
    const nextAct = NARRATIVE.evaluateActTransition(this.state);
    if (nextAct) {
      this.state.act.transitionPending = true;
      this._pendingActTransition = nextAct;
    }

    // Check convergence readiness
    this.state.convergenceReady = NARRATIVE.evaluateConvergence(this.state, this.state.pathId);

    this.save();
    return { duplicate: false, artifact, beat, actTransition: nextAct };
  },

  // ── Act transition ────────────────────────────────────────────────────

  advanceAct(nextAct) {
    const pathId = this.state.pathId;
    this.state.act.current = nextAct;
    this.state.act.beatsInAct = 0;
    this.state.act.transitionPending = false;
    this.state.act.guideEmotionalState = NARRATIVE.getGuideState(pathId, nextAct);

    // Update path-specific guide state
    if (pathId === 'search') this.state.search.isisState = this.state.act.guideEmotionalState;
    if (pathId === 'trial') {
      if (nextAct === 3) this.state.trial.thothBias = 'revealed';
    }
    if (pathId === 'letters') {
      if (nextAct === 3) this.state.letters.secretRevealed = true;
    }

    console.log(`[STORY] Act transition: ${nextAct} — ${NARRATIVE.acts[nextAct]?.name} — Guide: ${this.state.act.guideEmotionalState}`);
    this.save();
  },

  // ── Clue chain ────────────────────────────────────────────────────────

  advanceClueChain(foundObjectId) {
    const chain = this.state.clueChain;
    if (!chain || !chain.links) return;

    // Mark found link
    const link = chain.links.find(l => l.targetId === foundObjectId);
    if (link) link.found = true;

    // Advance current link to next unfound
    for (let i = 0; i < chain.links.length; i++) {
      if (!chain.links[i].found) {
        chain.currentLink = i;
        return;
      }
    }
    // All found
    chain.currentLink = chain.links.length;
  },

  getCurrentClueLink() {
    const chain = this.state.clueChain;
    if (!chain || !chain.links) return null;
    return chain.links[chain.currentLink] || null;
  },

  // ── Path state updates ────────────────────────────────────────────────

  _updatePathState(artifact, isTarget, targetData) {
    const pathId = this.state.pathId;
    if (!pathId) return;

    if (isTarget) {
      PATH_DATA.markScanned(artifact.object_id);
    }

    switch (pathId) {
      case 'search':
        if (isTarget) {
          this.state.search.piecesFound = PATH_DATA.getScannedTargetCount();
        }
        break;
      case 'trial':
        if (isTarget && targetData) {
          if (targetData.side === 'horus') {
            this.state.trial.horusEvidence.push(artifact.title);
          } else {
            this.state.trial.setEvidence.push(artifact.title);
          }
        } else if (this.state.artifactsScanned.length % 2 === 1) {
          this.state.trial.horusEvidence.push(artifact.title);
        } else {
          this.state.trial.setEvidence.push(artifact.title);
        }
        break;
      case 'letters':
        this.state.letters.possessionsFound.push(artifact.title);
        break;
      case 'memory':
        this.state.memory.visionsUnlocked.push({
          title: artifact.title,
          period: artifact.period,
          dynasty: artifact.dynasty
        });
        break;
      case 'awakening':
        if (!this.state.awakening.charactersMetIds.includes(artifact.object_id)) {
          this.state.awakening.charactersMetIds.push(artifact.object_id);
        }
        break;
    }
  },

  _updateProgress() {
    const path = this.paths[this.state.pathId];
    if (!path) return;
    const scanned = this.state.artifactsScanned.length;
    this.state.pathProgress = Math.min(100, Math.round((scanned / path.targetArtifacts) * 100));
  },

  // ── Beat helpers ──────────────────────────────────────────────────────

  _extractSummary(aiResponse) {
    if (!aiResponse) return '';
    // Take the first sentence as a summary
    const firstSentence = aiResponse.match(/^[^.!?]+[.!?]/);
    return firstSentence ? firstSentence[0].substring(0, 120) : aiResponse.substring(0, 80);
  },

  _extractClue(aiResponse) {
    if (!aiResponse) return '';
    // Look for gallery references or directional language
    const galleryMatch = aiResponse.match(/[Gg]allery\s*\d+/);
    if (galleryMatch) return galleryMatch[0];
    const seekMatch = aiResponse.match(/[Ss]eek|[Ff]ind|[Ll]ook for[^.]{5,40}/);
    if (seekMatch) return seekMatch[0].substring(0, 60);
    return '';
  },

  _findReferencedBeats(aiResponse) {
    if (!aiResponse) return [];
    const referenced = [];
    for (const beat of this.state.beats) {
      if (aiResponse.toLowerCase().includes(beat.artifactTitle.toLowerCase().split(',')[0])) {
        referenced.push(beat.id);
      }
    }
    return referenced;
  },

  // ── Progress queries ─────────────────────────────────────────────────

  getProgress() {
    const path = this.paths[this.state.pathId];
    return {
      pathId: this.state.pathId,
      pathName: path ? path.name : '',
      scanned: this.state.artifactsScanned.length,
      target: path ? path.targetArtifacts : 0,
      min: path ? path.minArtifacts : 0,
      percentage: this.state.pathProgress,
      convergenceReady: this.state.convergenceReady,
      phase: this.state.phase,
      act: this.state.act.current,
      actName: NARRATIVE.acts[this.state.act.current]?.name || '',
      guideState: this.state.act.guideEmotionalState,
      tensionLevel: this.state.act.tensionLevel,
      beatCount: this.state.beats.length
    };
  },

  getJourneySummary() {
    const artifacts = this.state.artifactsScanned.map(a => a.title).join(', ');
    const path = this.paths[this.state.pathId];
    const pathSpecific = this._getPathSummary();
    const act = this.state.act;

    return `Path: ${path ? path.name : 'Unknown'}. Act ${act.current} (${NARRATIVE.acts[act.current]?.name || ''}). Guide state: ${act.guideEmotionalState}. Tension: ${act.tensionLevel}/100. Artifacts discovered: ${artifacts}. ${pathSpecific}`;
  },

  _getPathSummary() {
    switch (this.state.pathId) {
      case 'search':
        return `Pieces of Osiris found: ${this.state.search.piecesFound} of 14. Isis is ${this.state.search.isisState}.`;
      case 'trial':
        return `Evidence for Horus: ${this.state.trial.horusEvidence.length}. Evidence for Set: ${this.state.trial.setEvidence.length}. Thoth's bias: ${this.state.trial.thothBias}. Verdict: ${this.state.trial.verdict || 'pending'}.`;
      case 'letters':
        return `Letters from Kha: ${this.state.letters.lettersReceived.length}. Possessions found: ${this.state.letters.possessionsFound.length}. Secret: ${this.state.letters.secretRevealed ? 'revealed' : 'hidden'}.`;
      case 'memory':
        return `Time visions unlocked: ${this.state.memory.visionsUnlocked.length}. Connections found: ${this.state.memory.connectionsFound.length}.`;
      case 'awakening':
        return `Characters met: ${this.state.awakening.charactersMet.length}. Conflicts: ${this.state.awakening.conflicts.length}. Reconciled: ${this.state.awakening.reconciled}.`;
      default:
        return '';
    }
  },

  addClue(clue) {
    this.state.cluesCollected.push({ text: clue, timestamp: Date.now() });
    this.save();
  },

  addChatMoment(summary) {
    this.state.chatHistory.push({ text: summary, timestamp: Date.now() });
    if (this.state.chatHistory.length > 20) {
      this.state.chatHistory = this.state.chatHistory.slice(-20);
    }
    this.save();
  },

  // Trial-specific
  setVerdict(verdict) {
    this.state.trial.verdict = verdict;
    this.save();
  },

  // Letters-specific
  addLetter(letter) {
    this.state.letters.lettersReceived.push(letter);
    this.save();
  },

  // Awakening-specific
  addCharacter(characterSummary) {
    this.state.awakening.charactersMet.push(characterSummary);
    this.save();
  },

  addQuest(quest) {
    this.state.awakening.questsGiven.push(quest);
    this.save();
  },

  // ── Phase transitions ────────────────────────────────────────────────

  startConvergence() {
    this.state.phase = 'convergence';
    this.save();
  },

  startEpilogue() {
    this.state.phase = 'epilogue';
    this.state.epilogueDone = true;
    this.save();
  },

  // ── Persistence ──────────────────────────────────────────────────────

  save() {
    try {
      const serializable = JSON.parse(JSON.stringify(this.state));
      localStorage.setItem('museum_wakes_v2', JSON.stringify(serializable));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem('museum_wakes_v2');
      if (saved) {
        const data = JSON.parse(saved);
        this.state = this._deepMerge(this._defaultState(), data);
      }
    } catch (e) {
      console.warn('Load failed:', e);
    }
  },

  reset() {
    this.state = this._defaultState();
    CLAUDE.resetHistory();
    try { localStorage.removeItem('museum_wakes_v2'); } catch (e) {}
  },

  _defaultState() {
    return {
      phase: 'prologue',
      register: 'adult',
      pathId: null,
      artifactsScanned: [],
      cluesCollected: [],
      chatHistory: [],
      pathProgress: 0,
      convergenceReady: false,
      epilogueDone: false,
      act: {
        current: 1,
        beatsInAct: 0,
        tensionLevel: 0,
        guideEmotionalState: 'composed',
        transitionPending: false,
        crisisDelivered: false
      },
      beats: [],
      clueChain: { links: [], currentLink: 0 },
      search: { piecesFound: 0, targetArtifacts: [], currentClue: null, isisState: 'composed' },
      trial: { horusEvidence: [], setEvidence: [], witnessesHeard: [], verdict: null, thothBias: 'hidden' },
      letters: { lettersReceived: [], possessionsFound: [], ritesPerformed: 0, secretRevealed: false },
      memory: { visionsUnlocked: [], dynastyPattern: null, hiddenNarrative: [], connectionsFound: [] },
      awakening: { charactersMetIds: [], charactersMet: [], questsGiven: [], questsCompleted: [], relationships: {}, conflicts: [], reconciled: false }
    };
  },

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
};
