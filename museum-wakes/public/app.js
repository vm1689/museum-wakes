// app.js — Main application controller for Museum Wakes v2
// Story-driven wayfinding, cinematic scroll entries, hint cards

const APP = {
  voiceEnabled: true,
  voiceModeActive: false,
  currentArtifact: null,
  demoSearchTimeout: null,

  // ── Boot ─────────────────────────────────────────────────────────────────
  async boot() {
    VOICE.init();
    STORY.init();
    CAMERA.init(null, 'camera-canvas');

    // Load catalog before anything else to prevent race conditions
    await CATALOG.load();
    this._populateDemoGalleries();

    // Resume from saved state
    if (STORY.state.phase !== 'prologue') {
      this._resumeFromState();
    } else {
      this._startPrologue();
    }
  },

  // ── Screen management ───────────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  // ── Prologue ────────────────────────────────────────────────────────────
  _startPrologue() {
    this.showScreen('screen-prologue');
    // Reset video state for fresh start
    const wrap = document.getElementById('prologue-video-wrap');
    if (wrap) wrap.classList.add('hidden');
    const content = document.getElementById('prologue-content');
    if (content) content.style.display = '';
  },

  // "Begin the Quest" → play intro video → then age select
  beginQuest() {
    const wrap = document.getElementById('prologue-video-wrap');
    const video = document.getElementById('prologue-video');
    const content = document.getElementById('prologue-content');

    if (!wrap || !video) {
      // No video element — go straight to age select
      this.showAgeSelect();
      return;
    }

    // Hide prologue content, show video
    if (content) content.style.display = 'none';
    wrap.classList.remove('hidden');

    video.currentTime = 0;
    video.play().catch(() => {
      // Autoplay blocked — skip to age select
      this.showAgeSelect();
    });

    video.onended = () => this._onIntroVideoEnd();
  },

  _onIntroVideoEnd() {
    const wrap = document.getElementById('prologue-video-wrap');
    if (wrap) wrap.classList.add('hidden');
    this.showAgeSelect();
  },

  skipIntroVideo() {
    const video = document.getElementById('prologue-video');
    if (video) { video.pause(); video.onended = null; }
    const wrap = document.getElementById('prologue-video-wrap');
    if (wrap) wrap.classList.add('hidden');
    this.showAgeSelect();
  },

  // ── Age Selection ───────────────────────────────────────────────────────
  showAgeSelect() {
    VOICE.stop();
    this.showScreen('screen-age');
  },

  setAge(register) {
    STORY.setRegister(register);
    this._showPathSelect();
  },

  // ── Home — return to path select from any screen ─────────────────────
  goHome() {
    VOICE.stop();
    this._showPathSelect();
  },

  // ── Path Selection ──────────────────────────────────────────────────────
  _showPathSelect() {
    this.showScreen('screen-paths');
    const grid = document.getElementById('paths-grid');
    grid.innerHTML = '';

    const register = STORY.state.register;

    // Inject register-specific background image
    const bgUrl = `/icons/bg-paths-${register}.png`;
    const pathsScreen = document.getElementById('screen-paths');
    let bgEl = pathsScreen.querySelector('.paths-bg');
    if (!bgEl) {
      bgEl = document.createElement('div');
      bgEl.className = 'paths-bg';
      pathsScreen.insertBefore(bgEl, pathsScreen.firstChild);
    }
    bgEl.style.backgroundImage = `url('${bgUrl}')`;

    console.log('[PATH SELECT] register =', register, '| registerContent exists:', !!STORY.paths.search.registerContent);

    for (const [id, path] of Object.entries(STORY.paths)) {
      const card = document.createElement('button');
      card.className = 'path-card';
      card.style.setProperty('--card-color', path.color);
      card.onclick = () => this._selectPath(id);

      // Register-specific content with fallbacks
      const rc = path.registerContent?.[register] || {};
      const subtitle = rc.subtitle || path.subtitle;
      const description = rc.description || path.description;
      const tone = rc.tone || path.tone;

      // Register-specific icon with fallback to generic
      const iconUrl = `/icons/path-${id}-${register}.png`;
      const fallbackIconUrl = path.iconUrl;
      const iconHtml = `<img class="path-card-icon-img" src="${iconUrl}" alt="${path.name}" onerror="this.onerror=null; this.src='${fallbackIconUrl}'" />`;

      card.innerHTML = `
        ${iconHtml}
        <div class="path-card-body">
          <div class="path-card-name">${path.name}</div>
          <div class="path-card-subtitle">${subtitle}</div>
          <div class="path-card-desc">${description}</div>
          <div class="path-card-tags">
            <span class="path-tag">${tone.split(',')[0].trim()}</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }
  },

  async _selectPath(pathId) {
    const path = STORY.paths[pathId];
    if (!path) return;

    document.documentElement.style.setProperty('--path-color', path.color);

    this.showScreen('screen-path-intro');
    const register = STORY.state.register;
    const rc = path.registerContent?.[register] || {};

    const introIconEl = document.getElementById('path-intro-icon');
    const introIconUrl = `/icons/path-${pathId}-${register}.png`;
    introIconEl.innerHTML = `<img class="path-intro-icon-img" src="${introIconUrl}" alt="${path.name}" onerror="this.onerror=null; if('${path.iconUrl}'){this.src='${path.iconUrl}'}else{this.outerHTML='${path.icon}'}" />`;

    document.getElementById('path-intro-name').textContent = path.name;
    document.getElementById('path-intro-subtitle').textContent = rc.subtitle || path.subtitle;

    const narration = await CLAUDE.generatePathIntro(pathId, STORY.state.register);
    const el = document.getElementById('path-intro-narration');

    if (narration) {
      el.innerHTML = this._formatNarration(narration);
      if (this.voiceEnabled && VOICE.supported()) {
        VOICE.speak(narration, { gender: 'male', rate: 0.85 });
      }
    } else {
      el.innerHTML = this._formatNarration(path.description);
    }

    this._pendingPath = pathId;
    document.getElementById('path-intro-begin').style.display = 'block';
  },

  beginPath() {
    VOICE.stop();
    if (!this._pendingPath) return;
    STORY.selectPath(this._pendingPath);
    this._enterGameplay();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GAMEPLAY — Cinematic Scroll
  // ══════════════════════════════════════════════════════════════════════════

  _enterGameplay() {
    const path = STORY.paths[STORY.state.pathId];
    if (!path) return;

    document.documentElement.style.setProperty('--path-color', path.color);
    this.showScreen('screen-gameplay');

    // Set up header — guide character info
    const guideIconEl = document.getElementById('gp-guide-icon');
    if (path.iconUrl) {
      guideIconEl.innerHTML = `<img class="gp-guide-icon-img" src="${path.iconUrl}" alt="${path.guide}" onerror="this.outerHTML='${path.icon}'" />`;
    } else {
      guideIconEl.textContent = path.icon;
    }
    document.getElementById('gp-guide-name').textContent = path.guide;

    this._updateActIndicator();

    // Add opening message if no entries exist
    const scrollContent = document.getElementById('gp-scroll-content');
    if (scrollContent.children.length === 0) {
      this._addSystemEntry(`${path.name} \u2014 ${path.subtitle}`);
      this._generateOpeningMessage();
    }

    // Show convergence button if already ready
    if (STORY.state.convergenceReady) {
      document.getElementById('gp-convergence-btn').style.display = 'block';
    }
  },

  async _generateOpeningMessage() {
    const pathId = STORY.state.pathId;
    const register = STORY.state.register;

    this._showThinking(true);

    // Build prompt context from narrative engine
    const promptContext = NARRATIVE.buildPromptContext(STORY.state, pathId);

    const message = await CLAUDE.generateStoryBeat(pathId, null, register, promptContext);

    this._showThinking(false);

    if (message) {
      this._addGuideEntry(message);
      if (this.voiceEnabled && VOICE.supported()) {
        const gender = pathId === 'search' ? 'female' : 'male';
        VOICE.speak(message, { gender, rate: 0.85 });
      }
    } else {
      // Path-specific rich fallback with visceral motivation
      this._addGuideEntry(this._getOpeningFallback());
    }

    // Show hint card for first target
    const firstTarget = PATH_DATA.getNextTarget();
    if (firstTarget) {
      this._addHintCard(firstTarget);
    }
  },

  // ── Chat ────────────────────────────────────────────────────────────────
  toggleChat() {
    const drawer = document.getElementById('gp-chat-drawer');
    const isVisible = drawer.style.display !== 'none';
    drawer.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      document.getElementById('gp-chat-input').focus();
    }
  },

  async sendMessage() {
    const input = document.getElementById('gp-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    VOICE.stop();

    this._addPlayerEntry(msg);
    this._showThinking(true);

    const reply = await CLAUDE.chat(
      STORY.state.pathId,
      msg,
      this.currentArtifact,
      STORY.state.register,
      STORY.getJourneySummary()
    );

    this._showThinking(false);

    if (reply) {
      this._addGuideEntry(reply);
      STORY.addChatMoment(msg.substring(0, 50));
      if (this.voiceEnabled && VOICE.supported()) {
        const gender = STORY.state.pathId === 'search' ? 'female' : 'male';
        VOICE.speak(reply, { gender, rate: 0.85 });
      }
    } else {
      this._addGuideEntry('The gods fall silent for a moment. Perhaps try scanning another artifact.');
    }
  },

  // ── Scanner — Take a photo, compare to target or free-explore ───────────
  async openScanner() {
    // Step 1: Capture photo
    const photo = await CAMERA.takePhoto();
    if (!photo) {
      this._openDemoScanner();
      return;
    }

    // Step 2: Check if there's a current target to compare against
    const target = PATH_DATA.getNextTarget();

    if (target) {
      // ── Target mode: image-to-image comparison ──
      console.log('[SCAN] Target mode — comparing against:', target.artifact.title, '(object_id:', target.artifact.object_id, ')');
      this._addSystemEntry('Photo captured. Comparing to target artifact...');
      this._showThinking(true);

      try {
        const result = await CAMERA.compareToTarget(photo.base64, target.artifact.object_id);

        console.log('[SCAN] Compare result:', JSON.stringify(result));
        this._showThinking(false);

        if (result && (result.match || result.confidence === 'medium')) {
          console.log('[SCAN] Match accepted:', target.artifact.title, `(match=${result.match}, confidence=${result.confidence})`);
          this._processScannedArtifact(target.artifact, photo.blobUrl);
        } else {
          const reason = result ? result.reason : 'Comparison failed';
          console.log('[SCAN] No match — reason:', reason, '| full result:', JSON.stringify(result));
          this._addSystemEntry('Not the right artifact. Keep searching!');
        }
      } catch (e) {
        console.error('[SCAN] Compare error:', e);
        this._showThinking(false);
        this._addSystemEntry('Something went wrong. Try again or use Browse.');
      }
    } else {
      // ── Free-explore mode: no targets left, use text-based identification ──
      await this._scanFreeExplore(photo);
    }
  },

  // ── Free-explore scan: old text-based identify → catalog match flow ────
  async _scanFreeExplore(photo) {
    this._addSystemEntry('Photo captured. Identifying artifact...');
    this._showThinking(true);

    try {
      const vision = await CAMERA.identifyArtifact(photo.base64);
      if (!vision) {
        this._showThinking(false);
        this._addSystemEntry('Could not identify the artifact. Try again or use Browse.');
        return;
      }

      console.log('[SCAN] Vision result:', vision.identified, vision.title);

      let catalogMatch = null;

      if (vision.accession_number) {
        catalogMatch = CATALOG.objects.find(o =>
          o.object_number === vision.accession_number
        );
      }
      if (!catalogMatch && vision.title) {
        catalogMatch = CATALOG.findMatch(vision.title);
      }
      if (!catalogMatch && vision.search_queries) {
        for (const q of vision.search_queries) {
          const results = CATALOG.search(q, { limit: 3 });
          if (results.length > 0) { catalogMatch = results[0]; break; }
        }
      }
      if (!catalogMatch && vision.object_name) {
        catalogMatch = CATALOG.findMatch(vision.object_name);
      }
      if (!catalogMatch && vision.keywords) {
        for (const keyword of vision.keywords) {
          if (keyword.length < 4) continue;
          const results = CATALOG.search(keyword, { limit: 3 });
          if (results.length > 0) { catalogMatch = results[0]; break; }
        }
      }
      if (!catalogMatch && vision.gallery) {
        const galleryObjects = CATALOG.getByGallery(vision.gallery);
        if (vision.object_type) {
          catalogMatch = galleryObjects.find(o =>
            o.object_name && o.object_name.toLowerCase().includes(vision.object_type.toLowerCase())
          );
        }
        if (!catalogMatch && vision.object_name) {
          const name = vision.object_name.toLowerCase();
          catalogMatch = galleryObjects.find(o =>
            o.title && o.title.toLowerCase().includes(name)
          );
        }
      }

      console.log('[SCAN] Catalog match:', catalogMatch ? catalogMatch.title : 'none');
      this._showThinking(false);

      if (catalogMatch) {
        this._processScannedArtifact(catalogMatch, photo.blobUrl);
      } else if (vision) {
        this._processUnknownArtifact(vision, photo.blobUrl);
      }
    } catch (e) {
      console.error('[SCAN] Error:', e);
      this._showThinking(false);
      this._addSystemEntry('Something went wrong identifying the artifact. Try again or use Browse.');
    }
  },

  // ── Skip to browse artifacts ─────────────────────────────────────────────
  skipToBrowse() {
    this._openDemoScanner();
  },

  // ── Skip current target artifact ────────────────────────────────────────
  skipTarget() {
    const current = PATH_DATA.getNextTarget();
    if (!current) return;

    // Mark as scanned so getNextTarget() advances past it
    PATH_DATA.markScanned(current.artifact.object_id);

    // Remove the old hint card, skip message, and stale scan messages
    const oldCard = document.querySelector('.hint-card');
    if (oldCard) oldCard.remove();
    const oldSkipMsg = document.querySelector('.skip-entry');
    if (oldSkipMsg) oldSkipMsg.remove();
    // Clean up "Photo captured..." / "Not the right artifact" entries from failed scans
    document.querySelectorAll('.system-entry').forEach(el => {
      const text = el.textContent || '';
      if (text.includes('Photo captured') || text.includes('Not the right artifact')) {
        el.remove();
      }
    });

    // Add a system message noting the skip
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry system-entry skip-entry';
    entry.innerHTML = `<div class="entry-text">Skipped: ${current.artifact.title || 'Unknown'}</div>`;
    container.appendChild(entry);

    // Show next hint card (or trigger convergence if none left)
    const next = PATH_DATA.getNextTarget();
    if (next) {
      this._addHintCard(next);
      this._generateSkipRedirect(next);
    } else {
      // All targets exhausted — show convergence button
      const convBtn = document.getElementById('gp-convergence-btn');
      if (convBtn) convBtn.style.display = '';
    }
    this._scrollToBottom();
  },

  // ── Generate new guide narration after skipping a target ──────────────
  async _generateSkipRedirect(nextTarget) {
    const pathId = STORY.state.pathId;
    const register = STORY.state.register;
    const promptContext = NARRATIVE.buildPromptContext(STORY.state, pathId);

    const system = CLAUDE.buildSystemPrompt(pathId, nextTarget.artifact, register, {
      act: promptContext.actNumber,
      guideState: promptContext.guideState,
      actDirective: promptContext.actDirective,
      beatHistory: promptContext.beatHistory,
      currentClue: promptContext.currentClue,
      isTarget: false,
      targetData: null,
      targetContext: PATH_DATA.getTargetSummary(),
      nextTargetHint: `Title: ${nextTarget.artifact.title}\nGallery: ${nextTarget.artifact.gallery_number || '?'}\nMedium: ${nextTarget.artifact.medium || ''}\nPeriod: ${nextTarget.artifact.period || ''}`
    });

    const prompt = `The player skipped the previous target. Redirect them toward the next artifact: "${nextTarget.artifact.title}" in Gallery ${nextTarget.artifact.gallery_number || '?'}. Evocative, not gamey. Stay in character. HARD LIMIT: Keep your ENTIRE response under 250 characters. 2 short sentences max.`;

    this._showThinking(true);
    const response = await CLAUDE.generate(system, prompt, {
      maxTokens: 500,
      temperature: 0.9,
      historyKey: `path_${pathId}`
    });
    this._showThinking(false);

    if (response) {
      this._addGuideEntry(response);
      if (this.voiceEnabled && VOICE.supported()) {
        const gender = pathId === 'search' ? 'female' : 'male';
        VOICE.speak(response, { gender, rate: 0.85 });
      }
    }
  },

  closeScanner() {
    this.showScreen('screen-gameplay');
  },

  // ── Demo Scanner ──────────────────────────────────────────────────────
  _openDemoScanner() {
    this.showScreen('screen-demo-scanner');
    this._demoLoadRandomArtifacts();
  },

  closeDemoScanner() {
    this.showScreen('screen-gameplay');
  },

  _populateDemoGalleries() {
    const select = document.getElementById('demo-gallery-select');
    if (!select) return;
    const galleries = CATALOG.egyptianGalleries();
    galleries.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = `Gallery ${g} (${CATALOG.getByGallery(g).length} objects)`;
      select.appendChild(opt);
    });
  },

  demoLoadGallery(gallery) {
    const results = document.getElementById('demo-results');
    results.innerHTML = '';

    let artifacts;
    if (gallery) {
      artifacts = CATALOG.randomFromGallery(gallery, 20);
    } else {
      artifacts = CATALOG.randomArtifacts(20);
    }

    this._renderDemoCards(artifacts);
  },

  _demoLoadRandomArtifacts() {
    const artifacts = CATALOG.randomArtifacts(20);
    this._renderDemoCards(artifacts);
  },

  demoSearch(query) {
    clearTimeout(this.demoSearchTimeout);
    if (!query || query.length < 2) {
      this._demoLoadRandomArtifacts();
      return;
    }
    this.demoSearchTimeout = setTimeout(() => {
      const results = CATALOG.search(query, { limit: 20, withImages: true });
      this._renderDemoCards(results);
    }, 300);
  },

  _renderDemoCards(artifacts) {
    const container = document.getElementById('demo-results');
    container.innerHTML = '';

    if (artifacts.length === 0) {
      container.innerHTML = '<p class="empty-state" style="grid-column:1/-1">No artifacts found.</p>';
      return;
    }

    artifacts.forEach(a => {
      const card = document.createElement('button');
      card.className = 'demo-card';
      const imgUrl = CATALOG.getImageUrl(a) || a.image_url || '';
      card.innerHTML = `
        <img class="demo-card-img" src="${imgUrl}" alt="${a.title || ''}"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%2313131e%22 width=%22100%22 height=%22100%22/><text fill=%22%237a7a9a%22 x=%2250%22 y=%2254%22 text-anchor=%22middle%22 font-size=%2212%22>No image</text></svg>'" />
        <div class="demo-card-info">
          <div class="demo-card-title">${a.title || 'Untitled'}</div>
          <div class="demo-card-meta">${a.date || ''} \u00B7 G${a.gallery_number || '?'}</div>
        </div>
      `;
      card.onclick = () => {
        this.showScreen('screen-gameplay');
        this._processScannedArtifact(a);
      };
      container.appendChild(card);
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ARTIFACT PROCESSING — Beat-aware with story entries
  // ══════════════════════════════════════════════════════════════════════════

  async _processScannedArtifact(artifact, photoUrl = null) {
    this.currentArtifact = artifact;
    const isTarget = PATH_DATA.isTarget(artifact.object_id);
    const targetData = PATH_DATA.getTargetData(artifact.object_id);

    // Add artifact entry inline in scroll — with user photo if available
    this._addArtifactEntry(artifact, isTarget, photoUrl);

    // Add scan notification
    if (isTarget) {
      const badge = this._getTargetBadge();
      this._addSystemEntry(`${badge} ${artifact.title || 'Unknown'}`, true);
    }

    // Generate story response
    this._showThinking(true);

    const pathId = STORY.state.pathId;
    const register = STORY.state.register;
    const promptContext = NARRATIVE.buildPromptContext(STORY.state, pathId);

    let response;
    if (pathId === 'awakening') {
      response = await CLAUDE.generateCharacter(artifact, register, promptContext, targetData);
    } else {
      response = await CLAUDE.generateStoryBeat(pathId, artifact, register, promptContext);
    }

    this._showThinking(false);

    // Record the beat with the AI response
    const result = STORY.recordBeat(artifact, response, isTarget, targetData);

    if (result && result.duplicate) {
      this._addSystemEntry('You have already scanned this artifact.');
      return;
    }

    // Show the response as a guide entry
    if (response) {
      const beat = result ? result.beat : null;
      const beatType = beat ? beat.beatType : null;
      const isTurningPoint = beat ? beat.turningPoint : false;
      this._addGuideEntry(response, beatType, isTurningPoint);

      // Show hint card for next target after guide entry
      const nextTarget = PATH_DATA.getNextTarget();
      if (nextTarget) {
        this._addHintCard(nextTarget);
      }

      if (this.voiceEnabled && VOICE.supported()) {
        const gender = pathId === 'search' ? 'female' : 'male';
        VOICE.speak(response, { gender, rate: 0.85 });
      }
    }

    // Update act indicator
    this._updateActIndicator();

    // Check for act transition
    if (result && result.actTransition) {
      await this._showActTransition(result.actTransition);
      STORY.advanceAct(result.actTransition);
      this._updateActIndicator();
    }

    // Check convergence readiness
    if (STORY.state.convergenceReady) {
      document.getElementById('gp-convergence-btn').style.display = 'block';
    }

    // Path-specific side effects
    if (pathId === 'letters' && response) {
      STORY.addLetter({ artifact: artifact.title, content: response.substring(0, 200) });
    }
    if (pathId === 'awakening' && response) {
      STORY.addCharacter({ artifact: artifact.title, intro: response.substring(0, 100) });
    }
  },

  _getTargetBadge() {
    const pathId = STORY.state.pathId;
    const badges = {
      search: 'PIECE FOUND:',
      trial: 'EVIDENCE:',
      letters: 'POSSESSION:',
      memory: 'VISION:',
      awakening: 'CHARACTER:'
    };
    return badges[pathId] || 'TARGET:';
  },

  async _processUnknownArtifact(vision, photoUrl = null) {
    this._addSystemEntry('Artifact detected but not in catalog. The gods speak anyway...');
    // Show the user's photo center-stage
    if (photoUrl) {
      this._addPhotoEntry(photoUrl, vision.title || 'Unknown Artifact', vision.description || '');
    }
    this._showThinking(true);

    const fakeArtifact = {
      title: vision.title || 'Unknown Artifact',
      description: vision.description || '',
      object_id: 'unknown_' + Date.now(),
      medium: vision.medium || '',
      period: vision.period || '',
      date: '',
      gallery_number: vision.gallery || ''
    };

    const promptContext = NARRATIVE.buildPromptContext(STORY.state, STORY.state.pathId);
    const response = await CLAUDE.generateStoryBeat(
      STORY.state.pathId,
      fakeArtifact,
      STORY.state.register,
      promptContext
    );

    this._showThinking(false);

    if (response) {
      this._addGuideEntry(response);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ACT TRANSITIONS
  // ══════════════════════════════════════════════════════════════════════════

  async _showActTransition(nextAct) {
    const actData = NARRATIVE.acts[nextAct];
    if (!actData) return;

    const overlay = document.getElementById('act-transition-overlay');
    const numEl = document.getElementById('act-transition-number');
    const nameEl = document.getElementById('act-transition-name');

    numEl.textContent = `Act ${nextAct}`;
    nameEl.textContent = actData.name;

    // Set path color for the overlay
    overlay.style.setProperty('--act-color', getComputedStyle(document.documentElement).getPropertyValue('--path-color'));

    overlay.classList.add('visible');

    // Wait for cinematic moment
    return new Promise(resolve => {
      setTimeout(() => {
        overlay.classList.remove('visible');
        resolve();
      }, 3000);
    });
  },

  _updateActIndicator() {
    const currentAct = STORY.state.act?.current || 1;

    // Update act pips
    const pips = document.querySelectorAll('.act-pip');
    pips.forEach((pip, i) => {
      const actNum = i + 1;
      pip.classList.remove('pip-active', 'pip-done');
      if (actNum < currentAct) {
        pip.classList.add('pip-done');
      } else if (actNum === currentAct) {
        pip.classList.add('pip-active');
      }
    });

    // Update act label
    const actLabel = document.getElementById('gp-act-label');
    if (actLabel) {
      const actNames = { 1: 'Act I', 2: 'Act II', 3: 'Act III', 4: 'Act IV' };
      actLabel.textContent = actNames[currentAct] || 'Act I';
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONVERGENCE — Path-specific
  // ══════════════════════════════════════════════════════════════════════════

  async startConvergence() {
    VOICE.stop();
    STORY.startConvergence();
    this.showScreen('screen-convergence');

    // Set convergence glow to path color
    const pathColor = getComputedStyle(document.documentElement).getPropertyValue('--path-color').trim();
    const convGlow = document.querySelector('.conv-glow');
    if (convGlow && pathColor) {
      convGlow.style.background = `radial-gradient(circle, ${pathColor}18 0%, transparent 70%)`;
    }

    const narration = await CLAUDE.generateConvergence(
      STORY.state.register,
      STORY.state.pathId,
      STORY.getJourneySummary()
    );

    const el = document.getElementById('conv-narration');
    if (narration) {
      el.innerHTML = this._formatNarration(narration);
      if (this.voiceEnabled && VOICE.supported()) {
        VOICE.speak(narration, { gender: 'male', rate: 0.8 });
      }
    } else {
      el.innerHTML = this._formatNarration(
        'Osiris appears before you, weakened, flickering like a candle in the wind. ' +
        '"You came," he whispers. "Tell me \u2014 what did you learn on your journey? ' +
        'What did the old stories teach you?"'
      );
    }

    setTimeout(() => {
      document.getElementById('conv-reflection').style.display = 'block';
    }, 3000);
  },

  async submitReflection() {
    const input = document.getElementById('conv-input');
    const reflection = input.value.trim();
    if (!reflection) return;

    document.getElementById('conv-reflection').style.display = 'none';
    this._showConvergenceThinking(true);

    const beats = STORY.state.beats;
    const beatSummary = beats.map(b => `"${b.artifactTitle}" (${b.beatType})`).join(', ');

    const system = `You are OSIRIS, receiving the mortal's reflection. Their heart is being weighed against Ma'at's feather.
${CLAUDE.registerPrompt(STORY.state.register)}
The mortal answered: "${reflection}"
Their path was: ${STORY.state.pathId}
Their journey: ${STORY.getJourneySummary()}
Their story beats: ${beatSummary}

Generate the weighing result. The heart ALWAYS balances \u2014 every player succeeds, because the act of playing, of learning, of caring about the old stories, IS the restoration of Ma'at.
Make it emotional and personal. Reference what they said AND specific artifacts from their journey. 4-6 sentences. End with the seal being restored.`;

    const verdict = await CLAUDE.generate(system, 'Weigh their heart.', { maxTokens: 400 });

    this._showConvergenceThinking(false);

    const resultEl = document.getElementById('conv-result');
    resultEl.style.display = 'block';

    if (verdict) {
      document.getElementById('conv-verdict').innerHTML = this._formatNarration(verdict);
      if (this.voiceEnabled && VOICE.supported()) {
        VOICE.speak(verdict, { gender: 'male', rate: 0.8 });
      }
    } else {
      document.getElementById('conv-verdict').innerHTML = this._formatNarration(
        'The scales tip... and balance. Your heart is true. ' +
        'The seal holds. Osiris is restored \u2014 not by magic, but by memory. ' +
        'By the act of listening. That is all we have ever asked.'
      );
    }
  },

  _showConvergenceThinking(show) {
    const el = document.getElementById('conv-narration');
    if (show) {
      el.innerHTML += '<div class="narration-loading"><span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span></div>';
    }
  },

  // ── Epilogue ────────────────────────────────────────────────────────────
  async showEpilogue() {
    VOICE.stop();
    STORY.startEpilogue();
    this.showScreen('screen-epilogue');

    const path = STORY.paths[STORY.state.pathId];
    document.getElementById('scroll-path').textContent = path ? path.name : '';

    // Set epilogue color to path color
    const border = document.querySelector('.epilogue-border');
    if (border && path) {
      border.style.background = `linear-gradient(135deg, ${path.color}26 0%, ${path.color}0D 100%)`;
      border.style.borderColor = `${path.color}4D`;
    }

    const scrollText = await CLAUDE.generateEpilogue(
      STORY.state.register,
      STORY.state.pathId,
      STORY.state.artifactsScanned,
      STORY.getJourneySummary()
    );

    const bodyEl = document.getElementById('scroll-body');
    if (scrollText) {
      bodyEl.innerHTML = this._formatNarration(scrollText);
    } else {
      bodyEl.innerHTML = this._formatNarration(
        'You walked where pharaohs once stood. You listened when others passed by. ' +
        'The gods spoke, and you answered. Ma\'at is restored \u2014 not through magic, ' +
        'but through the simple act of remembering.\n\n' +
        'The museum sleeps again \u2014 until the next visitor wakes it.'
      );
    }

    // Populate artifact list with beat info
    const listEl = document.getElementById('scroll-artifacts');
    listEl.innerHTML = '';

    STORY.state.artifactsScanned.forEach(a => {
      const fullArtifact = CATALOG.getById(a.object_id);
      const imgUrl = fullArtifact ? CATALOG.getImageUrl(fullArtifact) : '';
      const beat = STORY.state.beats.find(b => b.artifactId === a.object_id);
      const beatLabel = beat ? beat.beatType : '';

      const item = document.createElement('div');
      item.className = 'scroll-artifact-item';
      item.innerHTML = `
        ${imgUrl ? `<img class="scroll-artifact-thumb" src="${imgUrl}" alt="" onerror="this.style.display='none'" />` : ''}
        <div class="scroll-artifact-info">
          <div class="scroll-artifact-name">${a.title || 'Unknown'}</div>
          <div class="scroll-artifact-date">${a.date || ''} \u00B7 Gallery ${a.gallery_number || '?'}${beatLabel ? ` \u00B7 ${beatLabel}` : ''}</div>
        </div>
      `;
      listEl.appendChild(item);
    });

    if (STORY.state.artifactsScanned.length === 0) {
      listEl.innerHTML = '<p class="empty-state">No artifacts were scanned.</p>';
    }
  },

  shareScroll() {
    const scrollBody = document.getElementById('scroll-body');
    const text = `Museum Wakes \u2014 My Journey\n\n${scrollBody.textContent}\n\nArtifacts discovered: ${STORY.state.artifactsScanned.map(a => a.title).join(', ')}`;

    if (navigator.share) {
      navigator.share({ title: 'Museum Wakes \u2014 My Journey', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert('Scroll copied to clipboard!');
      }).catch(() => {});
    }
  },

  // ── Menu ────────────────────────────────────────────────────────────────
  showMenu() {
    const progress = STORY.getProgress();
    document.getElementById('menu-progress').textContent =
      `${progress.pathName} \u00B7 Act ${progress.act} \u00B7 ${progress.scanned} artifacts \u00B7 ${progress.guideState}`;
    document.getElementById('menu-overlay').style.display = 'flex';
  },

  closeMenu() {
    document.getElementById('menu-overlay').style.display = 'none';
  },

  showClues() {
    this.closeMenu();
    const listEl = document.getElementById('clues-list-full');
    listEl.innerHTML = '';

    // Show narrative thread — beats with summaries
    if (STORY.state.beats.length > 0) {
      const threadHeader = document.createElement('div');
      threadHeader.className = 'narrative-thread-header';
      threadHeader.textContent = 'Story Thread';
      listEl.appendChild(threadHeader);

      STORY.state.beats.forEach(beat => {
        const item = document.createElement('div');
        item.className = `clue-item beat-${beat.beatType}`;
        item.innerHTML = `
          <div class="beat-indicator">${this._beatIcon(beat.beatType)}</div>
          <div class="clue-item-info">
            <div class="clue-item-title">${beat.artifactTitle}</div>
            <div class="clue-item-meta">Act ${beat.act} \u00B7 ${beat.beatType}${beat.summary ? ' \u00B7 ' + beat.summary : ''}</div>
          </div>
        `;
        listEl.appendChild(item);
      });
    }

    // Separator
    if (STORY.state.beats.length > 0 && STORY.state.artifactsScanned.length > 0) {
      const sep = document.createElement('div');
      sep.className = 'narrative-thread-header';
      sep.textContent = 'Artifacts Scanned';
      listEl.appendChild(sep);
    }

    if (STORY.state.artifactsScanned.length === 0 && STORY.state.beats.length === 0) {
      listEl.innerHTML = '<p class="empty-state">No artifacts scanned yet. Use the scanner to discover artifacts!</p>';
    } else {
      STORY.state.artifactsScanned.forEach(a => {
        const fullArtifact = CATALOG.getById(a.object_id);
        const imgUrl = fullArtifact ? CATALOG.getImageUrl(fullArtifact) : '';
        const item = document.createElement('div');
        item.className = 'clue-item';
        item.innerHTML = `
          ${imgUrl ? `<img class="clue-item-img" src="${imgUrl}" alt="" onerror="this.style.display='none'" />` : ''}
          <div class="clue-item-info">
            <div class="clue-item-title">${a.title || 'Unknown'}</div>
            <div class="clue-item-meta">${a.date || ''} \u00B7 ${a.medium || ''}</div>
          </div>
        `;
        listEl.appendChild(item);
      });
    }

    document.getElementById('clues-overlay').style.display = 'flex';
  },

  _beatIcon(beatType) {
    const icons = {
      discovery: '\u2727',
      complication: '\u26A0',
      revelation: '\u2736',
      crisis: '\uD83D\uDD25',
      resolution: '\u2728'
    };
    return icons[beatType] || '\u00B7';
  },

  closeClues() {
    document.getElementById('clues-overlay').style.display = 'none';
  },

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    VOICE.stop();
    if (this.voiceModeActive) {
      GEMINI_VOICE.stop();
      this.voiceModeActive = false;
    }
    this.closeMenu();
  },

  // ── Gemini Live Voice Mode ────────────────────────────────────────────
  async toggleVoiceMode() {
    const btn = document.getElementById('gp-voice-toggle');

    if (this.voiceModeActive) {
      // Stop voice mode
      GEMINI_VOICE.stop();
      this.voiceModeActive = false;
      btn.classList.remove('voice-active', 'voice-listening', 'voice-speaking');
      this._addSystemEntry('Voice mode ended');
      return;
    }

    if (!GEMINI_VOICE.isSupported()) {
      this._addSystemEntry('Voice mode requires microphone access');
      return;
    }

    // Build system instruction from current path context
    const pathId = STORY.state.pathId;
    const register = STORY.state.register;
    const path = STORY.paths[pathId];
    const promptContext = NARRATIVE.buildPromptContext(STORY.state, pathId);

    const systemInstruction = CLAUDE.buildSystemPrompt(pathId, this.currentArtifact, register, {
      act: promptContext.actNumber,
      guideState: promptContext.guideState,
      actDirective: promptContext.actDirective,
      beatHistory: promptContext.beatHistory
    }) + '\n\nIMPORTANT: You are in VOICE conversation mode. Speak naturally, with emotion and personality. Keep responses to 2-4 sentences. You are speaking aloud to a visitor in the Egyptian Wing.';

    // Set up state change handler
    GEMINI_VOICE.onStateChange = (state) => {
      btn.classList.remove('voice-active', 'voice-listening', 'voice-speaking');
      switch (state) {
        case 'connecting':
          btn.classList.add('voice-active');
          break;
        case 'ready':
        case 'listening':
          btn.classList.add('voice-listening');
          break;
        case 'speaking':
          btn.classList.add('voice-speaking');
          break;
        case 'error':
          this.voiceModeActive = false;
          this._addSystemEntry('Voice connection failed');
          break;
        case 'closed':
          this.voiceModeActive = false;
          break;
      }
    };

    // Show transcript text in scroll
    GEMINI_VOICE.onTranscript = (text, role) => {
      if (role === 'model') {
        this._addGuideEntry(text);
      }
    };

    const started = await GEMINI_VOICE.start(systemInstruction, pathId);
    if (started) {
      this.voiceModeActive = true;
      this._addSystemEntry(`Voice mode \u2014 speak to ${path ? path.guide : 'the gods'}`);
    }
  },

  confirmRestart() {
    if (confirm('Start over? All progress will be lost.')) {
      this.restart();
    }
  },

  restart() {
    VOICE.stop();
    CAMERA.stop();
    STORY.reset();
    document.getElementById('gp-scroll-content').innerHTML = '';
    document.getElementById('menu-overlay').style.display = 'none';
    document.getElementById('clues-overlay').style.display = 'none';
    this._startPrologue();
  },

  // ── Resume from saved state ─────────────────────────────────────────────
  _resumeFromState() {
    const phase = STORY.state.phase;
    switch (phase) {
      case 'prologue':
        this._startPrologue();
        break;
      case 'path-select':
        this._showPathSelect();
        break;
      case 'playing':
        this._enterGameplay();
        break;
      case 'convergence':
        this.showScreen('screen-convergence');
        break;
      case 'epilogue':
        this.showEpilogue();
        break;
      default:
        this._startPrologue();
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STORY ENTRIES — Cinematic scroll, not chat bubbles
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Guide entry — the god/guide's narrative text.
   * Rendered as cinematic serif text with left border accent.
   */
  _addGuideEntry(text, beatType = null, isTurningPoint = false) {
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry guide-entry';

    if (beatType) entry.classList.add(`beat-${beatType}`);
    if (isTurningPoint) entry.classList.add('turning-point');

    const path = STORY.paths[STORY.state.pathId];
    const guideName = path ? path.guide : 'Thoth';

    entry.innerHTML = `
      <div class="entry-source">${guideName}</div>
      <div class="entry-text">${this._formatInline(text)}</div>
    `;
    container.appendChild(entry);
    this._scrollToBottom();
  },

  /**
   * Player entry — the mortal's words, right-aligned.
   */
  _addPlayerEntry(text) {
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry player-entry';
    entry.innerHTML = `<div class="entry-text">${this._escapeHtml(text)}</div>`;
    container.appendChild(entry);
    this._scrollToBottom();
  },

  /**
   * System entry — centered notification (act transitions, scan notices).
   */
  _addSystemEntry(text, isTarget = false) {
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry system-entry';
    if (isTarget) entry.classList.add('target-found');
    entry.innerHTML = `<div class="entry-text">${text}</div>`;
    container.appendChild(entry);
    this._scrollToBottom();
  },

  /**
   * Artifact entry — inline card with image, title, metadata.
   * Replaces the old slide-down artifact panel.
   */
  _addArtifactEntry(artifact, isTarget = false, photoUrl = null) {
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry artifact-entry';

    const img = this._createArtifactImg(artifact, 'artifact-entry-img artifact-hero-img', photoUrl);
    if (img) entry.appendChild(img);

    const badge = isTarget ? this._getTargetBadge().replace(':', '') : 'ARTIFACT IDENTIFIED';
    const meta = [
      artifact.date,
      artifact.medium,
      artifact.gallery_number ? `Gallery ${artifact.gallery_number}` : ''
    ].filter(Boolean).join(' \u00B7 ');

    const body = document.createElement('div');
    body.className = 'artifact-entry-body';
    body.innerHTML = `
      <div class="artifact-entry-badge">${badge}</div>
      <div class="artifact-entry-title">${artifact.title || 'Unknown'}</div>
      <div class="artifact-entry-meta">${meta}</div>
    `;
    entry.appendChild(body);
    container.appendChild(entry);
    this._scrollToBottom();
  },

  /**
   * Photo entry — shows the user's captured photo center-stage for unknown artifacts.
   */
  _addPhotoEntry(photoUrl, title, description) {
    const container = document.getElementById('gp-scroll-content');
    const entry = document.createElement('div');
    entry.className = 'story-entry artifact-entry';

    entry.innerHTML = `
      <img class="artifact-entry-img artifact-hero-img" src="${photoUrl}" alt="${this._escapeAttr(title)}" />
      <div class="artifact-entry-body">
        <div class="artifact-entry-badge">ARTIFACT DETECTED</div>
        <div class="artifact-entry-title">${title}</div>
        ${description ? `<div class="artifact-entry-meta">${description}</div>` : ''}
      </div>
    `;
    container.appendChild(entry);
    this._scrollToBottom();
  },

  /**
   * Hint card — visual clue showing the NEXT target artifact's photo.
   * Appears after guide entries to help players physically find the next artifact.
   */
  _addHintCard(nextTarget) {
    if (!nextTarget) return;

    const container = document.getElementById('gp-scroll-content');
    const card = document.createElement('div');
    card.className = 'story-entry hint-card';

    const artifact = nextTarget.artifact;
    const img = this._createArtifactImg(artifact, 'hint-card-img');
    if (img) card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'hint-card-info';
    info.innerHTML = `
      <div class="hint-card-title">${artifact.title || 'Unknown'}</div>
      <div class="hint-card-gallery">Gallery ${artifact.gallery_number || '?'}</div>
    `;
    card.appendChild(info);
    container.appendChild(card);
    this._scrollToBottom();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FALLBACKS — Path-specific visceral motivation + first target hint
  // ══════════════════════════════════════════════════════════════════════════

  _getOpeningFallback() {
    const pathId = STORY.state.pathId;
    const firstTarget = PATH_DATA.getNextTarget();
    const hint = firstTarget ? this._buildTargetHint(firstTarget) : '';

    const fallbacks = {
      search:
        `Osiris is dying. His body lies in 14 pieces across this wing. Each piece hides inside an artifact, pulsing with his fading life force. Find them before the museum closes or he is lost forever.\n\n` +
        `I am Isis. I have searched alone for three thousand years. But today \u2014 today you are here.\n\n` +
        hint,

      trial:
        `Horus and Set have fought for 80 years. The gods need YOU to gather evidence and render the verdict. The fate of Egypt hangs on your judgment.\n\n` +
        `I am Thoth, keeper of records, recorder of verdicts. The trial resumes now \u2014 and the first evidence awaits.\n\n` +
        hint,

      letters:
        `My heart failed the weighing. I am Kha, a scribe, and I am trapped between worlds. Only my scattered possessions can save me \u2014 but time runs out at closing.\n\n` +
        `Please. I am writing to you because you are the only one who can hear me.\n\n` +
        hint,

      memory:
        `Three thousand years of memory are dying. Each artifact you see restores a vision of what once was. Let enough fade and Egypt itself vanishes into silence.\n\n` +
        `I am Thoth. I grant you divine sight \u2014 the power to see through time. Turn your gaze upon the old things.\n\n` +
        hint,

      awakening:
        `The artifacts are waking. They have stories to tell and conflicts to resolve. They need a living person to listen before silence returns.\n\n` +
        `Step closer. Someone has been waiting three thousand years to speak to you.\n\n` +
        hint
    };

    return fallbacks[pathId] || 'The gods are stirring. Scan an artifact to begin your journey.';
  },

  /**
   * Build story-driven target hint — evocative, not gamey.
   * "I can feel his heart among the painted coffins..." not "Go to Gallery 131"
   */
  _buildTargetHint(target) {
    if (!target) return '';
    const a = target.artifact;
    const pathId = STORY.state.pathId;
    const medium = a.medium ? a.medium.split(';')[0].split(',')[0].trim().toLowerCase() : 'ancient objects';
    const gallery = a.gallery_number || '';

    const galleryPhrase = gallery
      ? `in the room numbered ${gallery}, the gallery ahead`
      : 'somewhere nearby';

    if (pathId === 'search') {
      const part = target.bodyPart || 'essence';
      return `*I can feel his ${part}... it pulses faintly among the ${medium}, ${galleryPhrase}. Find it. Please.*`;
    }
    if (pathId === 'trial') {
      return `*The first witness awaits among the ${medium} ${galleryPhrase}. Seek it out \u2014 the evidence must be gathered before the Ennead grows impatient.*`;
    }
    if (pathId === 'letters') {
      const category = target.category || 'belongings';
      return `*My ${category} rest among the ${medium} ${galleryPhrase} \u2014 the room where daily things were kept. Please find what remains of me.*`;
    }
    if (pathId === 'memory') {
      return `*Turn your gaze toward the ${medium} ${galleryPhrase}. A vision waits there, trembling at the edge of time.*`;
    }
    if (pathId === 'awakening') {
      return `*Someone stirs among the ${medium} ${galleryPhrase}. They have been waiting. Go to them.*`;
    }
    return '';
  },

  // ══════════════════════════════════════════════════════════════════════════
  // UI UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  _showThinking(show) {
    const el = document.getElementById('gp-thinking');
    if (el) el.style.display = show ? 'flex' : 'none';
    if (show) this._scrollToBottom();
  },

  _scrollToBottom() {
    const scroll = document.getElementById('gp-scroll');
    if (scroll) {
      requestAnimationFrame(() => {
        scroll.scrollTop = scroll.scrollHeight;
      });
    }
  },

  _formatNarration(text) {
    if (!text) return '';
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => `<p>${this._formatInline(line)}</p>`)
      .join('');
  },

  _formatInline(text) {
    return text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  },

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /**
   * Programmatic image loader with fallback chain.
   * Tries sources in order: photoUrl → local catalog → Met URL → hide.
   * Returns an <img> element, or null if no sources available.
   */
  _createArtifactImg(artifact, cssClass, photoUrl = null) {
    const sources = [];
    if (photoUrl) sources.push(photoUrl);
    const localImg = CATALOG.getImageUrl(artifact);
    if (localImg) sources.push(localImg);
    if (artifact.image_url) sources.push(artifact.image_url);

    if (sources.length === 0) return null;

    const img = document.createElement('img');
    img.className = cssClass;
    img.alt = artifact.title || '';

    let attempt = 0;
    img.addEventListener('error', () => {
      attempt++;
      if (attempt < sources.length) {
        img.src = sources[attempt];
      } else {
        img.style.display = 'none';
      }
    });
    img.src = sources[0];
    return img;
  }
};

// ── Boot ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => APP.boot());
