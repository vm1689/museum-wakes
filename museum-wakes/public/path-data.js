// path-data.js — Artifact pool builder and session target sampler
// Builds large pools from the 8,390-object catalog using tag/keyword/period filters,
// then randomly samples unique session shortlists for each playthrough.

const PATH_DATA = {

  // ── Filter definitions per path ──────────────────────────────────────────
  filters: {
    search: {
      tags: ['Scarabs', 'Coffins', 'Mummies', 'Amulets'],
      keywords: ['funerary', 'mummy', 'coffin', 'afterlife', 'canopic',
                 'amulet', 'djed', 'osiris', 'isis', 'anubis', 'ba bird',
                 'heart scarab', 'shabti', 'book of the dead', 'weighing'],
      bodyParts: ['heart', 'spine', 'eye', 'head', 'lungs', 'liver',
                  'stomach', 'intestines', 'skin', 'soul', 'tears',
                  'grain', 'limbs', 'phallus']
    },
    trial: {
      tags: ['Horus', 'Falcons', 'Kings', 'Goddess', 'Sphinxes'],
      keywords: ['falcon', 'horus', 'set', 'sekhmet', 'wedjat', 'eye',
                 'throne', 'crown', 'scepter', 'uraeus', 'cobra',
                 'kingship', 'divine', 'judgment', "ma'at"],
      horusKeywords: ['horus', 'falcon', 'wedjat', 'eye', 'heir', 'justice', 'son'],
      setKeywords: ['set', 'seth', 'chaos', 'storm', 'desert', 'strength', 'hippo', 'donkey'],
    },
    letters: {
      tags: ['Cosmetics', 'Games', 'Hieroglyphs'],
      keywords: ['shabti', 'scribe', 'papyrus', 'palette', 'reed pen',
                 'mirror', 'cosmetic', 'household', 'daily life', 'linen',
                 'offering', 'stele', 'letter', 'writing'],
      categoryKeywords: {
        profession: ['scribe', 'palette', 'papyrus', 'reed pen', 'writing', 'ink'],
        funerary:   ['shabti', 'coffin', 'canopic', 'mummy', 'offering', 'stele'],
        personal:   ['mirror', 'cosmetic', 'jewelry', 'ring', 'bracelet', 'necklace'],
        household:  ['bowl', 'jar', 'linen', 'furniture', 'tool', 'game', 'daily life']
      }
    },
    memory: {
      periods: ['Old Kingdom', 'Middle Kingdom', 'New Kingdom', 'Late Period',
                'Third Intermediate Period', 'Ptolemaic Period', 'Roman Period'],
      artifactsPerPeriod: 2
    },
    awakening: {
      tags: ['Kings', 'Cartouches'],
      keywords: ['pharaoh', 'king', 'queen', 'official', 'priest', 'priestess',
                 'scribe', 'soldier', 'craftsman', 'child', 'woman', 'man',
                 'servant', 'musician', 'dancer'],
      requireDescription: true,
      characterKeywords: {
        pharaoh:   ['pharaoh', 'king', 'queen', 'royal', 'ruler'],
        priest:    ['priest', 'priestess', 'temple', 'ritual'],
        scribe:    ['scribe', 'writing', 'papyrus', 'record'],
        soldier:   ['soldier', 'warrior', 'battle', 'military', 'weapon'],
        craftsman: ['craftsman', 'artisan', 'maker', 'carved', 'painted'],
        child:     ['child', 'young', 'boy', 'girl', 'infant'],
        musician:  ['musician', 'singer', 'dancer', 'harp', 'lute']
      }
    }
  },

  // Current session state
  sessionTargets: [],  // Array of { artifact, bodyPart?, side?, category?, characterType? }
  sessionPool: [],
  _scannedTargetIds: new Set(),

  // ── Pool builder ─────────────────────────────────────────────────────────
  // Runs filter criteria against the full catalog at path selection time

  buildPool(pathId, catalog) {
    const filter = this.filters[pathId];
    if (!filter) return [];

    const objects = catalog.objects;
    if (!objects || objects.length === 0) return [];

    // Memory path: filter by period across all eras
    if (pathId === 'memory') {
      return objects.filter(obj => {
        if (!obj.image_url && !obj.image_file) return false;
        if (!obj.period) return false;
        return filter.periods.some(p =>
          obj.period.toLowerCase().includes(p.toLowerCase())
        );
      });
    }

    // All other paths: filter by tags OR keywords
    const pool = objects.filter(obj => {
      // Must have an image
      if (!obj.image_url && !obj.image_file) return false;

      // Awakening requires a description for character generation
      if (filter.requireDescription && (!obj.description || obj.description.length < 20)) {
        return false;
      }

      const text = [
        obj.title, obj.object_name, obj.description, obj.medium
      ].filter(Boolean).join(' ').toLowerCase();

      // Check tag match
      const tagMatch = filter.tags && obj.tags &&
        obj.tags.some(t => filter.tags.some(ft =>
          t.toLowerCase().includes(ft.toLowerCase())
        ));

      // Check keyword match
      const keywordMatch = filter.keywords &&
        filter.keywords.some(kw => text.includes(kw));

      return tagMatch || keywordMatch;
    });

    return pool;
  },

  // ── Sampler ──────────────────────────────────────────────────────────────
  // Shuffles the pool and picks N items, returns unique session shortlist

  sampleTargets(pathId, catalog, count) {
    const pool = this.buildPool(pathId, catalog);
    this.sessionPool = pool;

    console.log(`[PATH_DATA] Pool for "${pathId}": ${pool.length} artifacts`);

    if (pool.length === 0) {
      console.warn(`[PATH_DATA] Empty pool for path "${pathId}"`);
      this.sessionTargets = [];
      return [];
    }

    let sampled;

    if (pathId === 'memory') {
      // Special sampling: pick artifactsPerPeriod from each era
      sampled = this._sampleByPeriod(pool);
    } else {
      // Shuffle and pick
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      sampled = shuffled.slice(0, count);
    }

    // Enrich each sampled artifact with path-specific metadata
    this.sessionTargets = sampled.map((artifact, i) =>
      this._enrichTarget(pathId, artifact, i, sampled.length)
    );

    this._scannedTargetIds = new Set();

    console.log(`[PATH_DATA] Session targets for "${pathId}":`,
      this.sessionTargets.map(t => `${t.artifact.title} (G${t.artifact.gallery_number})`));

    return this.sessionTargets;
  },

  _sampleByPeriod(pool) {
    const filter = this.filters.memory;
    const sampled = [];

    for (const period of filter.periods) {
      const periodPool = pool.filter(obj =>
        obj.period && obj.period.toLowerCase().includes(period.toLowerCase())
      );
      if (periodPool.length === 0) continue;

      const shuffled = [...periodPool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, filter.artifactsPerPeriod);
      sampled.push(...picked);
    }

    return sampled;
  },

  _enrichTarget(pathId, artifact, index, total) {
    const target = { artifact };

    switch (pathId) {
      case 'search': {
        // Assign a body part to each target
        const parts = this.filters.search.bodyParts;
        target.bodyPart = parts[index % parts.length];
        break;
      }
      case 'trial': {
        // Classify as horus/set/neutral based on keyword matching
        const text = [artifact.title, artifact.description, artifact.object_name]
          .filter(Boolean).join(' ').toLowerCase();
        const horusScore = this.filters.trial.horusKeywords
          .filter(kw => text.includes(kw)).length;
        const setScore = this.filters.trial.setKeywords
          .filter(kw => text.includes(kw)).length;
        if (horusScore > setScore) target.side = 'horus';
        else if (setScore > horusScore) target.side = 'set';
        else target.side = index % 2 === 0 ? 'horus' : 'set';
        break;
      }
      case 'letters': {
        // Classify by category
        const text = [artifact.title, artifact.description, artifact.object_name]
          .filter(Boolean).join(' ').toLowerCase();
        const cats = this.filters.letters.categoryKeywords;
        let bestCat = 'personal';
        let bestScore = 0;
        for (const [cat, kws] of Object.entries(cats)) {
          const score = kws.filter(kw => text.includes(kw)).length;
          if (score > bestScore) { bestScore = score; bestCat = cat; }
        }
        target.category = bestCat;
        break;
      }
      case 'memory': {
        // Already sampled by period; store the period
        target.period = artifact.period || 'Unknown';
        break;
      }
      case 'awakening': {
        // Generate character type from metadata
        const text = [artifact.title, artifact.description, artifact.object_name]
          .filter(Boolean).join(' ').toLowerCase();
        const charKws = this.filters.awakening.characterKeywords;
        let bestType = 'craftsman';
        let bestScore = 0;
        for (const [type, kws] of Object.entries(charKws)) {
          const score = kws.filter(kw => text.includes(kw)).length;
          if (score > bestScore) { bestScore = score; bestType = type; }
        }
        target.characterType = bestType;
        break;
      }
    }

    return target;
  },

  // ── Target queries ───────────────────────────────────────────────────────

  // Check if a scanned artifact is in the current session's target list
  isTarget(objectId) {
    return this.sessionTargets.some(t => t.artifact.object_id === objectId);
  },

  // Get the target data for a specific artifact
  getTargetData(objectId) {
    return this.sessionTargets.find(t => t.artifact.object_id === objectId) || null;
  },

  // Mark a target as scanned
  markScanned(objectId) {
    this._scannedTargetIds.add(objectId);
  },

  // Get the next unscanned target for clue generation
  getNextTarget() {
    for (const t of this.sessionTargets) {
      if (!this._scannedTargetIds.has(t.artifact.object_id)) {
        return t;
      }
    }
    return null;
  },

  // Get all unscanned targets
  getRemainingTargets() {
    return this.sessionTargets.filter(t =>
      !this._scannedTargetIds.has(t.artifact.object_id)
    );
  },

  // Get count of scanned targets
  getScannedTargetCount() {
    return this._scannedTargetIds.size;
  },

  // Get target list titles (for system prompts)
  getTargetTitles() {
    return this.sessionTargets.map(t => t.artifact.title).filter(Boolean);
  },

  // Get brief summary of all targets (for system prompts)
  getTargetSummary() {
    return this.sessionTargets.map(t => {
      let desc = `"${t.artifact.title}" (Gallery ${t.artifact.gallery_number || '?'})`;
      if (t.bodyPart) desc += ` [${t.bodyPart}]`;
      if (t.side) desc += ` [${t.side}]`;
      if (t.category) desc += ` [${t.category}]`;
      if (t.characterType) desc += ` [${t.characterType}]`;
      return desc;
    }).join('\n');
  },

  // ── Clue chain generation (delegates to NARRATIVE engine) ─────────────
  generateClueChain(pathId) {
    return NARRATIVE.generateClueChain(pathId, this.sessionTargets);
  }
};
