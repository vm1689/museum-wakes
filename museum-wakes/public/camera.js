// camera.js — Photo capture + Gemini Vision artifact identification
// Simplified: take a photo (no live video), identify, show artifact center-stage

const CAMERA = {
  canvasEl: null,

  init(videoElementId, canvasElementId) {
    this.canvasEl = document.getElementById(canvasElementId);
    if (!this.canvasEl) {
      this.canvasEl = document.createElement('canvas');
      this.canvasEl.id = canvasElementId;
      this.canvasEl.style.display = 'none';
      document.body.appendChild(this.canvasEl);
    }
  },

  // ── Take a photo using native camera picker ────────────────────────────
  async takePhoto() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // back camera on mobile

      let resolved = false;
      const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { done(null); return; }

        // Read as base64
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];

          // Also create a blob URL for display
          const blobUrl = URL.createObjectURL(file);
          done({ base64, dataUrl, blobUrl });
        };
        reader.onerror = () => done(null);
        reader.readAsDataURL(file);
      };

      // Cancel handler
      input.oncancel = () => done(null);

      // Fallback: detect cancel via window re-focus (mobile browsers)
      const focusHandler = () => {
        setTimeout(() => { if (!resolved) done(null); }, 500);
      };
      window.addEventListener('focus', focusHandler, { once: true });

      // Safety timeout so the promise never hangs forever
      setTimeout(() => done(null), 30000);

      input.click();
    });
  },

  // ── Identify artifact using Gemini Vision ──────────────────────────────
  async identifyArtifact(imageBase64) {
    if (!imageBase64) return null;

    const system = `You are an expert Egyptologist at The Metropolitan Museum of Art, specializing in identifying artifacts in the Egyptian Wing (Galleries 100-138).

You will receive a photo taken by a museum visitor. Analyze it carefully and identify the artifact.

IMPORTANT identification tips:
- Look for museum labels, plaques, or accession numbers (format like "12.345.67" or "O.C. 1234")
- Note the gallery setting, display case style, and neighboring objects
- Identify the material (stone types: granite/limestone/sandstone/basalt/quartzite, wood, faience, bronze, gold, pottery)
- Identify the object type precisely (seated statue, standing figure, coffin, canopic jar, scarab, relief fragment, stela, ushabti, amulet, vessel, papyrus)
- Note any visible hieroglyphs, cartouches, or inscriptions
- Estimate the period from artistic style

You MUST respond with valid JSON only, no other text.`;

    const prompt = `Identify this Egyptian artifact. Return JSON with these fields:
{
  "identified": true,
  "confidence": "high",
  "title": "the exact or closest museum title, e.g. 'Seated Statue of Hatshepsut'",
  "object_name": "generic type, e.g. 'Seated statue' or 'Coffin' or 'Amulet'",
  "accession_number": "if visible on label, e.g. '29.3.2', otherwise null",
  "object_type": "statue/amulet/coffin/relief/papyrus/jewelry/vessel/stela/ushabti/scarab/canopic_jar/tool/other",
  "material": "primary material seen",
  "period": "art historical period",
  "dynasty": "dynasty if identifiable",
  "gallery": "gallery number if visible or inferable (100-138)",
  "description": "2-3 sentence visual description of what you see",
  "keywords": ["5-8", "specific", "identifying", "terms", "for", "catalog", "search"],
  "search_queries": ["title-like phrase 1", "alternative title phrase 2", "object_name + material phrase"]
}

The search_queries field is critical — provide 3 phrases that could match a museum catalog title. Think about how the Met would title this object.
If you cannot identify it, set identified to false but still describe what you see with keywords.`;

    const result = await CLAUDE.vision(imageBase64, prompt, system);
    if (!result) return null;

    console.log('[VISION] Raw response:', result.substring(0, 300));

    try {
      // Try direct JSON parse first (server requests JSON mime type)
      const parsed = JSON.parse(result);
      return parsed;
    } catch (e1) {
      // Fallback: extract JSON from text
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.warn('[VISION] JSON parse failed:', e2.message);
      }
    }

    // Last resort: build a result from raw text
    return {
      identified: false,
      description: result,
      raw: result,
      keywords: result.split(/\s+/).filter(w => w.length > 4).slice(0, 10),
      search_queries: []
    };
  },

  // ── Compare user photo to a specific target artifact ─────────────────
  async compareToTarget(imageBase64, objectId) {
    if (!imageBase64 || !objectId) return null;
    return CLAUDE.compareArtifact(imageBase64, objectId);
  },

  // ── Full scan workflow: photo → identify → match catalog ──────────────
  async scan() {
    console.log('[SCAN] Starting photo capture...');
    const photo = await this.takePhoto();
    if (!photo) {
      console.log('[SCAN] No photo taken (cancelled)');
      return { success: false, error: 'No photo taken' };
    }
    console.log('[SCAN] Photo captured, identifying artifact...');

    // Step 1: Gemini Vision identifies the artifact
    const vision = await this.identifyArtifact(photo.base64);
    if (!vision) {
      console.warn('[SCAN] Vision API failed');
      return { success: false, error: 'Vision analysis failed', imageUrl: photo.blobUrl };
    }
    console.log('[SCAN] Vision result:', vision.identified, vision.title);

    // Step 2: Match against the catalog
    let catalogMatch = null;

    if (vision.identified && vision.title) {
      catalogMatch = CATALOG.findMatch(vision.title);

      if (!catalogMatch && vision.keywords) {
        for (const keyword of vision.keywords) {
          const results = CATALOG.search(keyword, { limit: 5, withImages: true });
          if (results.length > 0) {
            catalogMatch = results[0];
            break;
          }
        }
      }

      if (!catalogMatch && vision.gallery) {
        const galleryObjects = CATALOG.getByGallery(vision.gallery);
        if (vision.object_type) {
          catalogMatch = galleryObjects.find(o =>
            o.object_name && o.object_name.toLowerCase().includes(vision.object_type.toLowerCase())
          );
        }
        if (!catalogMatch && galleryObjects.length > 0) {
          catalogMatch = galleryObjects[0];
        }
      }
    }

    if (!catalogMatch && vision.raw) {
      catalogMatch = CATALOG.findMatch(vision.raw);
    }

    if (catalogMatch) {
      return {
        success: true,
        artifact: catalogMatch,
        vision,
        imageUrl: photo.blobUrl
      };
    }

    return {
      success: true,
      artifact: null,
      vision,
      imageUrl: photo.blobUrl,
      partial: true
    };
  },

  // ── Legacy compatibility ───────────────────────────────────────────────
  start() { return Promise.resolve(false); },
  stop() {},
  isSupported() {
    return true; // file input works everywhere
  }
};
