// story.js — Story state machine

const STORY = {
  // State
  state: {
    phase: 'intro',         // intro | horus | isis | osiris | complete
    visited: new Set(),
    clues: [],
    godData: {},            // Populated from Met API
    taskProgress: {}        // { horus: 1, isis: 2 } — 1=task1 done, 2=both done
  },

  phases: ['intro', 'horus', 'isis', 'osiris', 'complete'],

  canVisit(god) {
    const order = { horus: 0, isis: 1, osiris: 2 };
    const phaseOrder = { intro: -1, horus: 0, isis: 1, osiris: 2, complete: 3 };
    return phaseOrder[this.state.phase] >= order[god] - 1;
  },

  visit(god) {
    if (this.state.visited.has(god)) return 'revisit';
    if (!this.canVisit(god)) return 'locked';

    this.state.visited.add(god);
    const clue = DIALOGUE[god].clue;
    if (clue) this.state.clues.push({ god, clue });

    // Advance phase
    const nextPhase = { horus: 'isis', isis: 'osiris', osiris: 'complete' };
    this.state.phase = nextPhase[god] || this.state.phase;

    this.save();
    return 'first';
  },

  isComplete() {
    return this.state.phase === 'complete';
  },

  getProgress() {
    const gods = ['horus', 'isis', 'osiris'];
    return gods.map(g => ({
      god: g,
      visited: this.state.visited.has(g),
      available: this.canVisit(g)
    }));
  },

  save() {
    try {
      localStorage.setItem('museum_wakes_state', JSON.stringify({
        phase: this.state.phase,
        visited: [...this.state.visited],
        clues: this.state.clues,
        taskProgress: this.state.taskProgress
      }));
    } catch(e) {}
  },

  load() {
    try {
      const saved = localStorage.getItem('museum_wakes_state');
      if (saved) {
        const data = JSON.parse(saved);
        this.state.phase = data.phase || 'intro';
        this.state.visited = new Set(data.visited || []);
        this.state.clues = data.clues || [];
        this.state.taskProgress = data.taskProgress || {};
      }
    } catch(e) {}
  },

  reset() {
    const godData = this.state.godData; // preserve fetched Met API data
    this.state = { phase: 'intro', visited: new Set(), clues: [], godData, taskProgress: {} };
    try { localStorage.removeItem('museum_wakes_state'); } catch(e) {}
  }
};
