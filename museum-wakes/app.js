// app.js — Main application controller

const APP = {
  currentGod: null,
  difficulty: 'medium',   // 'easy' | 'medium' | 'hard'

  // Called on page load — loads data silently, stays on intro screen
  async boot() {
    STORY.load();
    VOICE.init();
    await MET_API.loadGods();
  },

  // Called when user clicks "Begin the Quest" — go to difficulty screen
  startQuest() {
    UI.show('screen-difficulty');
  },

  // Called from difficulty screen
  selectDifficulty(level) {
    this.difficulty = level;
    // Populate god intro cards with real Met images then show gods intro
    ['horus', 'isis', 'osiris'].forEach(god => {
      const meta = STORY.state.godData[god] ? MET_API.summarize(STORY.state.godData[god]) : null;
      const img      = document.getElementById(`gi-img-${god}`);
      const fallback = document.getElementById(`gi-fallback-${god}`);
      if (img && meta && meta.image) {
        img.src = meta.image;
        img.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
      }
    });
    UI.show('screen-gods-intro');
  },

  // Called from "Enter the Museum →" on gods intro screen
  enterMuseum() {
    this.renderHome();
  },

  // ── Home ─────────────────────────────────────────────────

  renderHome() {
    const progress = STORY.getProgress();
    const allDone  = STORY.isComplete();

    UI.show('screen-home');
    UI.setStatus(allDone
      ? 'The balance is restored.'
      : STORY.state.phase === 'intro'
        ? 'Horus is waiting — approach when ready.'
        : `Next: find ${this._nextGodLabel()}`
    );

    // Update god cards
    ['horus', 'isis', 'osiris'].forEach(god => {
      const btn = document.getElementById(`btn-${god}`);
      const p   = progress.find(x => x.god === god);
      if (!btn) return;

      btn.disabled = !p.available;
      btn.classList.toggle('visited',   p.visited);
      btn.classList.toggle('available', p.available && !p.visited);
      btn.classList.toggle('locked',    !p.available);

      const label = btn.querySelector('.btn-status');
      if (label) label.textContent = p.visited ? '✓ Visited' : p.available ? 'Approach' : 'Locked';
    });

    // Clues panel
    const cluesList = document.getElementById('clues-list');
    if (!cluesList) return;
    if (STORY.state.clues.length === 0) {
      cluesList.innerHTML = '<li class="empty">No clues collected yet.</li>';
    } else {
      cluesList.innerHTML = STORY.state.clues.map(c =>
        `<li><span class="clue-god">${DIALOGUE[c.god].name}:</span> ${c.clue}</li>`
      ).join('');
    }
  },

  // ── Encounter ────────────────────────────────────────────

  async approachGod(god) {
    this.currentGod = god;
    const result  = STORY.visit(god);
    const data    = DIALOGUE[god];
    const metObj  = STORY.state.godData[god];
    const meta    = metObj ? MET_API.summarize(metObj) : null;
    const gallery = GALLERY_INFO[god];

    UI.show('screen-encounter');
    UI.setGodTheme(god, data.color);

    // Top bar
    document.getElementById('enc-god-name').textContent    = data.name;
    document.getElementById('enc-god-title').textContent   = data.title;
    document.getElementById('enc-gallery-tag').textContent = `${gallery.gallery} · ${gallery.wing}`;

    if (meta && meta.image) {
      const img = document.getElementById('enc-artifact-img');
      img.src = meta.image;
      img.style.display = 'block';
    }

    // Task progress pips
    this._resetPips();

    // If revisiting, resume from wherever they left off
    if (result === 'revisit') {
      const progress = STORY.state.taskProgress[god] || 0;
      if (progress >= 2) {
        // Fully complete — just go home
        this.renderHome();
        return;
      } else if (progress >= 1) {
        // Task 1 done, resume at Task 2
        document.getElementById('pip-1').className = 'task-pip done';
        this.showTask2Phase();
        return;
      } else {
        // Left before Task 1 — resume at Task 1 assignment
        this.showTask1Phase();
        return;
      }
    }

    // Phase 1: Welcome — chat (Gemini) or static story (fallback)
    this._showPhase('welcome');
    if (GEMINI.isConfigured()) {
      this._startChat(god);
    } else {
      this._startStaticStory(god);
    }
  },

  _resetPips() {
    document.getElementById('pip-1').className = 'task-pip';
    document.getElementById('pip-2').className = 'task-pip';
  },

  // ── Phase 2: Task 1 Assignment ────────────────────────────

  showTask1Phase() {
    VOICE.stop();
    const god    = this.currentGod;
    const data   = DIALOGUE[god];
    const metObj = STORY.state.godData[god];
    const meta   = metObj ? MET_API.summarize(metObj) : null;
    const gallery = GALLERY_INFO[god];

    this._showPhase('task1');
    document.getElementById('pip-1').className = 'task-pip active';

    document.getElementById('enc-task1-speech').textContent = data.task1Assign;

    // Artifact image
    const img = document.getElementById('enc-task1-img');
    const placeholder = document.getElementById('enc-task1-img-placeholder');
    if (meta && meta.image) {
      img.src = meta.image;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    }

    document.getElementById('enc-task1-artifact-name').textContent = meta ? meta.title : data.name;
    document.getElementById('enc-task1-gallery-hint').textContent  = gallery.hint;

    if (VOICE.supported()) VOICE.speak(data.task1Assign, { gender: god === 'isis' ? 'female' : 'male' });
  },

  // ── Phase 2b: Scan animation ─────────────────────────────

  startScan() {
    const god    = this.currentGod;
    const data   = DIALOGUE[god];
    const metObj = STORY.state.godData[god];
    const meta   = metObj ? MET_API.summarize(metObj) : null;

    this._showPhase('scanning');

    // Copy image into scan viewfinder
    const scanImg = document.getElementById('enc-scan-img');
    if (meta && meta.image) {
      scanImg.src = meta.image;
      scanImg.style.display = 'block';
    }

    document.getElementById('enc-scan-status').textContent    = 'Scanning...';
    document.getElementById('enc-scan-identified').style.display = 'none';
    document.getElementById('enc-scan-done-btn').style.display  = 'none';
    document.getElementById('enc-scan-line').style.display       = 'block';

    setTimeout(() => {
      document.getElementById('enc-scan-line').style.display       = 'none';
      document.getElementById('enc-scan-identified').style.display = 'flex';
      document.getElementById('enc-scan-id-name').textContent      = data.name;
      document.getElementById('enc-scan-id-artifact').textContent  = meta ? meta.title : '';
      document.getElementById('enc-scan-status').textContent       = 'Artifact identified';
      document.getElementById('enc-scan-done-btn').style.display   = 'block';
    }, 2400);
  },

  // ── Phase 3: Task 1 Complete ──────────────────────────────

  showTask1Complete() {
    VOICE.stop();
    const god  = this.currentGod;
    const data = DIALOGUE[god];
    const metObj = STORY.state.godData[god];
    const meta   = metObj ? MET_API.summarize(metObj) : null;

    // Record Task 1 done so re-entry resumes at Task 2
    STORY.state.taskProgress[god] = 1;
    STORY.save();

    this._showPhase('task1-complete');
    document.getElementById('pip-1').className = 'task-pip done';

    document.getElementById('enc-t1c-god-name').textContent  = data.name + ' says:';
    document.getElementById('enc-t1c-about-title').textContent = `About the Artifact`;

    const factsList = document.getElementById('enc-t1c-facts');
    factsList.innerHTML = data.task1Facts.map(f => `<li>${f}</li>`).join('');

    // Easy mode: skip Task 2, go straight to afterEncounter
    const t1NextBtn = document.getElementById('enc-t1c-next-btn');
    if (t1NextBtn) {
      if (this.difficulty === 'easy') {
        t1NextBtn.textContent = 'Return to the Gallery →';
        t1NextBtn.onclick = () => APP.afterEncounter();
      } else {
        t1NextBtn.textContent = 'Next Task →';
        t1NextBtn.onclick = () => APP.showTask2Phase();
      }
    }
  },

  // ── Phase 4: Task 2 — Hieroglyph puzzle ──────────────────

  showTask2Phase() {
    const god  = this.currentGod;
    const data = DIALOGUE[god];
    const p    = PUZZLES[god];

    this._showPhase('task2');
    document.getElementById('pip-2').className = 'task-pip active';

    document.getElementById('enc-task2-speech').textContent   = data.task2Intro;
    document.getElementById('enc-glyph-symbol').textContent   = p.glyph;
    document.getElementById('enc-glyph-name').textContent     = p.glyphName;
    document.getElementById('enc-puzzle-question').textContent = p.question;
    document.getElementById('enc-puzzle-feedback').style.display = 'none';
    document.getElementById('enc-puzzle-continue').style.display = 'none';

    const optionsEl = document.getElementById('enc-puzzle-options');
    optionsEl.innerHTML = p.options.map((opt, i) =>
      `<button class="puzzle-option" onclick="APP.answerPuzzle(${i})">${opt.text}</button>`
    ).join('');

    if (VOICE.supported()) VOICE.speak(data.task2Intro, { gender: god === 'isis' ? 'female' : 'male' });
  },

  answerPuzzle(index) {
    const p       = PUZZLES[this.currentGod];
    const correct = p.options[index].correct;
    const allBtns = document.querySelectorAll('.puzzle-option');

    allBtns.forEach((btn, i) => {
      btn.disabled = true;
      if (p.options[i].correct) btn.classList.add('correct');
      if (i === index && !correct) btn.classList.add('wrong');
    });

    const feedbackEl = document.getElementById('enc-puzzle-feedback');
    const resultEl   = document.getElementById('enc-puzzle-result');
    feedbackEl.style.display = 'block';

    if (correct) {
      resultEl.textContent = '✓ Correct.';
      resultEl.className   = 'puzzle-result correct';
      document.getElementById('enc-puzzle-explanation').textContent = p.explanation;
      const continueBtn = document.getElementById('enc-puzzle-continue');
      continueBtn.style.display = 'block';
    } else {
      resultEl.textContent = 'Not quite. Look again.';
      resultEl.className   = 'puzzle-result wrong';
      document.getElementById('enc-puzzle-explanation').textContent = '';
      setTimeout(() => {
        allBtns.forEach(btn => { btn.disabled = false; btn.classList.remove('wrong', 'correct'); });
        feedbackEl.style.display = 'none';
      }, 1500);
    }
  },

  // ── Phase 5: Task 2 Complete ──────────────────────────────

  showTask2Complete() {
    VOICE.stop();
    const god  = this.currentGod;
    const data = DIALOGUE[god];
    const p    = PUZZLES[god];

    // Record both tasks done so re-entry just goes home
    STORY.state.taskProgress[god] = 2;
    STORY.save();

    this._showPhase('task2-complete');
    document.getElementById('pip-2').className = 'task-pip done';

    document.getElementById('enc-t2c-god-name').textContent   = data.name + ' says:';
    document.getElementById('enc-t2c-about-title').textContent = `About the ${p.glyphName.split(' — ')[0]}`;

    const factsList = document.getElementById('enc-t2c-facts');
    factsList.innerHTML = p.symbolFacts.map(f => `<li>${f}</li>`).join('');

    // Update next button label if game complete after this
    const nextBtn = document.getElementById('enc-t2c-next-btn');
    if (STORY.isComplete()) {
      nextBtn.textContent = 'The seal is restored →';
    } else {
      const nextGod = this._nextGodLabel();
      nextBtn.textContent = nextGod ? `Find ${nextGod} →` : 'Find the Next Clue →';
    }
  },

  afterEncounter() {
    VOICE.stop();
    if (STORY.isComplete()) {
      UI.show('screen-ending');
    } else {
      this.renderHome();
    }
  },

  leaveEncounter() {
    VOICE.stop();
    if (STORY.isComplete()) {
      UI.show('screen-ending');
    } else {
      this.renderHome();
    }
  },

  reset() {
    VOICE.stop();
    STORY.reset();
    this.difficulty = 'medium';
    this.renderHome();
  },

  // ── Phase helpers ────────────────────────────────────────

  _showPhase(phase) {
    const phases = ['welcome', 'task1', 'scanning', 'task1-complete', 'task2', 'task2-complete'];
    phases.forEach(p => {
      const el = document.getElementById(`enc-phase-${p}`);
      if (el) el.style.display = p === phase ? 'block' : 'none';
    });
  },

  // ── Gemini chat mode ─────────────────────────────────────────────────────

  async _startChat(god) {
    const gender = god === 'isis' ? 'female' : 'male';

    // Show chat UI, hide fallback
    document.getElementById('enc-chat-messages').style.display  = 'block';
    document.getElementById('enc-chat-fallback').style.display  = 'none';
    document.getElementById('enc-chat-input-area').style.display = 'flex';
    document.getElementById('enc-to-task1-btn').style.display   = 'block';
    document.getElementById('enc-next-btn').style.display       = 'none';
    document.getElementById('enc-continue-btn').style.display   = 'none';

    GEMINI.resetHistory(god);
    this._showChatThinking(true);

    const opening = await GEMINI.openingLine(god);
    this._showChatThinking(false);

    if (opening) {
      this._appendChatBubble('god', opening, god);
      if (VOICE.supported()) VOICE.speak(opening, { gender });
    }

    document.getElementById('enc-chat-input').focus();
  },

  async sendChat() {
    const god    = this.currentGod;
    const input  = document.getElementById('enc-chat-input');
    const msg    = input.value.trim();
    if (!msg) return;

    const gender = god === 'isis' ? 'female' : 'male';
    input.value  = '';
    VOICE.stop();

    this._appendChatBubble('player', msg, god);
    this._showChatThinking(true);

    const reply = await GEMINI.chat(god, msg);
    this._showChatThinking(false);

    if (reply) {
      this._appendChatBubble('god', reply, god);
      if (VOICE.supported()) VOICE.speak(reply, { gender });
    } else {
      this._appendChatBubble('god', DIALOGUE[god].hint || 'The god falls silent.', god);
    }
  },

  _appendChatBubble(role, text, god) {
    const container = document.getElementById('enc-chat-messages');
    const bubble    = document.createElement('div');
    bubble.className = role === 'god' ? 'chat-bubble god-bubble' : 'chat-bubble player-bubble';
    if (role === 'god') {
      const nameTag = document.createElement('div');
      nameTag.className   = 'bubble-name';
      nameTag.textContent = DIALOGUE[god].name;
      bubble.appendChild(nameTag);
    }
    const textEl = document.createElement('div');
    textEl.textContent = text;
    bubble.appendChild(textEl);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  _showChatThinking(show) {
    document.getElementById('enc-chat-thinking').style.display = show ? 'flex' : 'none';
  },

  // ── Static story mode (fallback — no API key) ─────────────────────────────

  _startStaticStory(god) {
    const lines = DIALOGUE[god].intro;

    // Show fallback UI, hide chat UI
    document.getElementById('enc-chat-messages').style.display   = 'none';
    document.getElementById('enc-chat-fallback').style.display   = 'block';
    document.getElementById('enc-chat-input-area').style.display = 'none';
    document.getElementById('enc-to-task1-btn').style.display    = 'none';

    let i = 0;
    const nextBtn     = document.getElementById('enc-next-btn');
    const continueBtn = document.getElementById('enc-continue-btn');

    const show = () => {
      document.getElementById('enc-dialogue').textContent     = lines[i];
      document.getElementById('enc-line-counter').textContent = `${i + 1} / ${lines.length}`;
      if (i < lines.length - 1) {
        nextBtn.style.display     = 'inline-block';
        continueBtn.style.display = 'none';
      } else {
        nextBtn.style.display   = 'none';
        continueBtn.textContent = 'Continue →';
        continueBtn.onclick     = () => { VOICE.stop(); APP.showTask1Phase(); };
        continueBtn.style.display = 'block';
      }
    };

    show();
    nextBtn.onclick = () => { if (i < lines.length - 1) { i++; show(); } };
    if (VOICE.supported()) VOICE.speakLines(lines, { gender: god === 'isis' ? 'female' : 'male' });
  },

  // ── Helpers ─────────────────────────────────────────────

  _nextGodLabel() {
    const order = ['horus', 'isis', 'osiris'];
    const next  = order.find(g => !STORY.state.visited.has(g));
    return next ? DIALOGUE[next].name : '';
  },

  _godIcon(god) {
    return { horus: '🦅', isis: '✨', osiris: '☥' }[god] || '';
  }
};

// ── UI helpers ───────────────────────────────────────────

const UI = {
  show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  setStatus(text) {
    const el = document.getElementById('status-bar');
    if (el) el.textContent = text;
  },

  setGodTheme(god, color) {
    document.documentElement.style.setProperty('--god-color', color);
  }
};

// ── Boot ─────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => APP.boot());
