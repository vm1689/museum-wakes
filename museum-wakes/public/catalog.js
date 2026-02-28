// catalog.js — Full catalog search and artifact matching
// Loads 8,390 objects from the server and provides search/filtering

const CATALOG = {
  objects: [],
  loaded: false,
  byId: {},
  byGallery: {},

  async load() {
    if (this.loaded) return;
    try {
      const res = await fetch('/data/catalog_egyptian.json');
      if (!res.ok) throw new Error('Catalog load failed');
      this.objects = await res.json();
      this.loaded = true;

      // Build indexes
      this.objects.forEach(obj => {
        this.byId[obj.object_id] = obj;
        const g = obj.gallery_number;
        if (g) {
          if (!this.byGallery[g]) this.byGallery[g] = [];
          this.byGallery[g].push(obj);
        }
      });

      console.log(`Catalog loaded: ${this.objects.length} objects, ${Object.keys(this.byGallery).length} galleries`);
    } catch (e) {
      console.error('Catalog load error:', e);
    }
  },

  getById(id) {
    return this.byId[id] || null;
  },

  getByGallery(galleryNum) {
    return this.byGallery[String(galleryNum)] || [];
  },

  // Get galleries that have artifacts on view
  getGalleries() {
    return Object.keys(this.byGallery).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  },

  // Search across all objects
  search(query, options = {}) {
    const { limit = 20, gallery = null, withImages = false, period = null, dynasty = null } = options;
    const q = query.toLowerCase();

    let results = this.objects;

    if (gallery) {
      results = results.filter(o => o.gallery_number === String(gallery));
    }
    if (withImages) {
      results = results.filter(o => o.image_url);
    }
    if (period) {
      results = results.filter(o => o.period && o.period.toLowerCase().includes(period.toLowerCase()));
    }
    if (dynasty) {
      results = results.filter(o => o.dynasty && o.dynasty.toLowerCase().includes(dynasty.toLowerCase()));
    }

    if (q) {
      results = results.filter(o =>
        (o.title && o.title.toLowerCase().includes(q)) ||
        (o.object_name && o.object_name.toLowerCase().includes(q)) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.medium && o.medium.toLowerCase().includes(q)) ||
        (o.tags && o.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return results.slice(0, limit);
  },

  // Search by tags
  searchByTags(tags, options = {}) {
    const { limit = 20, gallery = null } = options;
    const tagList = tags.map(t => t.toLowerCase());

    let results = this.objects;
    if (gallery) {
      results = results.filter(o => o.gallery_number === String(gallery));
    }

    results = results.filter(o =>
      o.tags && o.tags.some(t => tagList.some(tl => t.toLowerCase().includes(tl)))
    );

    return results.slice(0, limit);
  },

  // Get random artifacts from a gallery (for path gameplay)
  randomFromGallery(galleryNum, count = 5) {
    const gallery = this.getByGallery(galleryNum);
    const withImages = gallery.filter(o => o.image_url);
    const shuffled = [...withImages].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  // Get random artifacts from any gallery (for exploration paths)
  randomArtifacts(count = 10) {
    const withImages = this.objects.filter(o => o.image_url && o.gallery_number);
    const shuffled = [...withImages].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  // Egyptian wing galleries (100-138)
  egyptianGalleries() {
    return this.getGalleries().filter(g => {
      const n = parseInt(g);
      return !isNaN(n) && n >= 100 && n <= 138;
    });
  },

  // Get artifact image URL — serve from local images directory
  getImageUrl(artifact) {
    if (!artifact) return null;
    if (artifact.image_url || artifact.image_file) {
      return `/images/${artifact.object_id}.jpg`;
    }
    return null;
  },

  // Build artifact metadata string for Claude prompts
  describeArtifact(artifact) {
    if (!artifact) return 'Unknown artifact';
    const parts = [];
    if (artifact.title) parts.push(`Title: ${artifact.title}`);
    if (artifact.date) parts.push(`Date: ${artifact.date}`);
    if (artifact.period) parts.push(`Period: ${artifact.period}`);
    if (artifact.dynasty) parts.push(`Dynasty: ${artifact.dynasty}`);
    if (artifact.medium) parts.push(`Medium: ${artifact.medium}`);
    if (artifact.gallery_number) parts.push(`Gallery: ${artifact.gallery_number}`);
    if (artifact.description) parts.push(`Description: ${artifact.description.substring(0, 400)}`);
    if (artifact.provenance) parts.push(`Provenance: ${artifact.provenance.substring(0, 200)}`);
    return parts.join('\n');
  },

  // Match a Claude Vision identification against the catalog
  findMatch(visionText) {
    if (!visionText) return null;
    const text = visionText.toLowerCase();

    // Try to extract object identifiers
    const idMatch = text.match(/object\s*(?:id|#|number)?\s*:?\s*(\d{4,})/);
    if (idMatch) {
      const obj = this.getById(parseInt(idMatch[1]));
      if (obj) return obj;
    }

    // Try title matching
    let bestMatch = null;
    let bestScore = 0;

    for (const obj of this.objects) {
      if (!obj.title) continue;
      const title = obj.title.toLowerCase();

      // Direct title match
      if (text.includes(title) || title.includes(text.substring(0, 50))) {
        return obj;
      }

      // Word overlap scoring
      const titleWords = title.split(/\s+/).filter(w => w.length > 3);
      const textWords = text.split(/\s+/).filter(w => w.length > 3);
      let score = 0;
      for (const tw of titleWords) {
        if (textWords.some(w => w.includes(tw) || tw.includes(w))) {
          score++;
        }
      }

      // Boost for matching medium, period, dynasty
      if (obj.medium && text.includes(obj.medium.toLowerCase().split(',')[0])) score += 2;
      if (obj.period && text.includes(obj.period.toLowerCase())) score += 2;
      if (obj.dynasty && text.includes(obj.dynasty.toLowerCase())) score += 1;
      if (obj.gallery_number && text.includes(`gallery ${obj.gallery_number}`)) score += 3;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = obj;
      }
    }

    return bestScore >= 3 ? bestMatch : null;
  }
};
