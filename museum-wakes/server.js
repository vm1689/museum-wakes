// server.js — Express server: static files + Gemini API proxy + Gemini Live voice
require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Gemini client — lazy init so server starts even without API key
let genAI = null;
function getClient() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set. Export it in your terminal and restart.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve catalog data from egypt-data
app.use('/data', express.static(path.join(__dirname, '..', 'egypt-data')));

// ── Gemini Text API ──────────────────────────────────────────────────────────
app.post('/api/gemini', async (req, res) => {
  try {
    const { system, messages, max_tokens = 2048, temperature = 0.9, model } = req.body;

    const geminiModel = getClient().getGenerativeModel({
      model: model || 'gemini-3-flash-preview',
      systemInstruction: system || undefined,
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature
      }
    });

    // Convert messages from {role, content} to Gemini format {role, parts}
    const contents = (messages || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const result = await geminiModel.generateContent({ contents });
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    let text = result.response.text();

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[Gemini] Response truncated (MAX_TOKENS) — trimming to last complete sentence');
      // Trim to last complete sentence
      const lastPeriod = text.lastIndexOf('.');
      const lastExcl = text.lastIndexOf('!');
      const lastQ = text.lastIndexOf('?');
      const lastSentEnd = Math.max(lastPeriod, lastExcl, lastQ);
      if (lastSentEnd > text.length * 0.3) {
        text = text.substring(0, lastSentEnd + 1);
      }
    }
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`[Gemini] finishReason: ${finishReason}`);
    }

    res.json({ text, finishReason });
  } catch (e) {
    console.error('Gemini API error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Gemini Vision API (artifact identification) ──────────────────────────────
app.post('/api/gemini-vision', async (req, res) => {
  try {
    const { image_base64, media_type = 'image/jpeg', system, prompt, max_tokens = 800 } = req.body;

    const geminiModel = getClient().getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: system || undefined,
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    const result = await geminiModel.generateContent([
      { text: prompt || 'What artifact is this?' },
      {
        inlineData: {
          mimeType: media_type,
          data: image_base64
        }
      }
    ]);

    const text = result.response.text();
    res.json({ text });
  } catch (e) {
    console.error('Gemini Vision error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Gemini Image Comparison (artifact matching) ──────────────────────────────
app.post('/api/gemini-compare', async (req, res) => {
  try {
    const { image_base64, object_id } = req.body;
    if (!image_base64 || !object_id) {
      return res.status(400).json({ error: 'image_base64 and object_id required' });
    }

    console.log(`[COMPARE] Request for object_id: ${object_id}, photo size: ${image_base64.length} chars`);

    // Load reference image from disk (auto-fetch from Met if missing)
    const localPath = path.join(IMAGE_DIR, `${object_id}.jpg`);
    let refBuffer;

    if (fs.existsSync(localPath)) {
      refBuffer = fs.readFileSync(localPath);
      console.log(`[COMPARE] Reference image loaded from disk: ${localPath} (${refBuffer.length} bytes)`);
    } else {
      // Auto-fetch from Met
      console.log(`[COMPARE] Reference image not on disk, fetching from Met...`);
      const data = loadCatalog();
      const obj = data.find(o => String(o.object_id) === String(object_id));
      if (!obj || !obj.image_url) {
        console.log(`[COMPARE] No catalog entry or image_url for object_id: ${object_id}`);
        return res.status(404).json({ error: 'Reference image not found' });
      }
      console.log(`[COMPARE] Fetching from: ${obj.image_url}`);
      const fetchRes = await fetch(obj.image_url);
      if (!fetchRes.ok) {
        console.log(`[COMPARE] Met fetch failed: ${fetchRes.status}`);
        return res.status(502).json({ error: 'Failed to fetch reference image from Met' });
      }
      refBuffer = Buffer.from(await fetchRes.arrayBuffer());
      if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
      fs.writeFileSync(localPath, refBuffer);
      console.log(`[COMPARE] Reference image fetched and cached (${refBuffer.length} bytes)`);
    }

    const refBase64 = refBuffer.toString('base64');
    console.log(`[COMPARE] Sending to Gemini — user photo: ${image_base64.length} chars, ref image: ${refBase64.length} chars`);

    const geminiModel = getClient().getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const result = await geminiModel.generateContent([
      {
        text: `You are comparing two images of museum artifacts. Image 1 is a visitor's photo. Image 2 is the reference image of a specific artifact from The Metropolitan Museum of Art.

Determine if the visitor's photo shows the SAME artifact or a very similar artifact as the reference image. Be LENIENT — the photos may differ in angle, lighting, zoom, quality, or cropping. If the objects look like the same type of artifact and share similar visual features (shape, material, decorations, style), lean toward matching.

Only say "match": false if the objects are clearly DIFFERENT artifacts (e.g. a statue vs a coffin, or completely different objects).

Return JSON: { "match": true/false, "confidence": "high"/"medium"/"low", "reason": "brief explanation" }`
      },
      { inlineData: { mimeType: 'image/jpeg', data: image_base64 } },
      { inlineData: { mimeType: 'image/jpeg', data: refBase64 } }
    ]);

    const text = result.response.text();
    console.log(`[COMPARE] Gemini raw response: ${text}`);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { match: false, confidence: 'low', reason: 'Could not parse response' };
    }

    console.log(`[COMPARE] Result — match: ${parsed.match}, confidence: ${parsed.confidence}, reason: ${parsed.reason}`);
    res.json(parsed);
  } catch (e) {
    console.error('Gemini Compare error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Catalog search endpoint (lightweight server-side search) ─────────────────
let catalog = null;

function loadCatalog() {
  if (catalog) return catalog;
  const catalogPath = path.join(__dirname, '..', 'egypt-data', 'catalog_egyptian.json');
  if (fs.existsSync(catalogPath)) {
    catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    console.log(`Catalog loaded: ${catalog.length} objects`);
  } else {
    catalog = [];
    console.warn('Catalog not found at', catalogPath);
  }
  return catalog;
}

app.get('/api/catalog/search', (req, res) => {
  const data = loadCatalog();
  const { q, gallery, limit = 20, tags, period, dynasty } = req.query;

  let results = data;

  if (gallery) {
    results = results.filter(o => o.gallery_number === gallery);
  }
  if (period) {
    results = results.filter(o => o.period && o.period.toLowerCase().includes(period.toLowerCase()));
  }
  if (dynasty) {
    results = results.filter(o => o.dynasty && o.dynasty.toLowerCase().includes(dynasty.toLowerCase()));
  }
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim().toLowerCase());
    results = results.filter(o =>
      o.tags && o.tags.some(t => tagList.some(tl => t.toLowerCase().includes(tl)))
    );
  }
  if (q) {
    const query = q.toLowerCase();
    results = results.filter(o =>
      (o.title && o.title.toLowerCase().includes(query)) ||
      (o.object_name && o.object_name.toLowerCase().includes(query)) ||
      (o.description && o.description.toLowerCase().includes(query)) ||
      (o.medium && o.medium.toLowerCase().includes(query)) ||
      (o.period && o.period.toLowerCase().includes(query))
    );
  }

  res.json({
    total: results.length,
    objects: results.slice(0, parseInt(limit))
  });
});

app.get('/api/catalog/:id', (req, res) => {
  const data = loadCatalog();
  const obj = data.find(o => String(o.object_id) === req.params.id);
  if (obj) {
    res.json(obj);
  } else {
    res.status(404).json({ error: 'Object not found' });
  }
});

// ── Catalog random artifacts for a gallery ───────────────────────────────────
app.get('/api/catalog/gallery/:num/random', (req, res) => {
  const data = loadCatalog();
  const gallery = req.params.num;
  const count = parseInt(req.query.count || '5');
  const inGallery = data.filter(o => o.gallery_number === gallery && o.image_url);
  const shuffled = inGallery.sort(() => Math.random() - 0.5);
  res.json(shuffled.slice(0, count));
});

// ── Serve artifact images (with auto-fetch fallback) ─────────────────────────
const IMAGE_DIR = path.join(__dirname, '..', 'egypt-data', 'images');
app.use('/images', express.static(IMAGE_DIR));

// Fallback: if image not cached locally, fetch from Met and cache it
app.get('/images/:filename', async (req, res) => {
  const objectId = req.params.filename.replace('.jpg', '');
  const localPath = path.join(IMAGE_DIR, `${objectId}.jpg`);

  const data = loadCatalog();
  const obj = data.find(o => String(o.object_id) === objectId);
  if (!obj || !obj.image_url) {
    return res.status(404).send('Not found');
  }

  try {
    const response = await fetch(obj.image_url);
    if (!response.ok) throw new Error(`Met returned ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.writeFileSync(localPath, buffer);

    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (e) {
    console.error(`Image fetch error for ${objectId}:`, e.message);
    res.status(502).send('Failed to fetch image');
  }
});

// ── Gemini Image Generation — thematic game icons ────────────────────────────
const ICON_PROMPTS = {
  // Path icons — generic fallbacks (atmospheric, card-art style)
  'path-search': 'A golden Egyptian goddess Isis with outstretched wings, searching through moonlit temple ruins. She holds a glowing ankh. Dramatic torchlight, ancient stone columns, mysterious shadows. Style: cinematic digital painting, rich gold and deep blue tones on dark background. Square composition, icon-ready.',
  'path-trial': 'The golden Scales of Ma\'at in an Egyptian court of judgment. A glowing feather on one side, a human heart on the other. Two powerful figures (falcon-headed Horus, beast-headed Set) face each other. Style: cinematic digital painting, gold and crimson tones on dark background. Square composition, icon-ready.',
  'path-letters': 'A ghostly Egyptian scribe writing on a floating papyrus scroll by candlelight. Hieroglyphs glow gold as they appear. The figure is translucent, trapped between worlds. Style: cinematic digital painting, warm amber and ethereal blue tones on dark background. Square composition, icon-ready.',
  'path-memory': 'The Eye of Horus radiating golden light, with visions of ancient Egypt reflected in its pupil — pyramids, temples, ceremonies. Time flowing like sand. Style: cinematic digital painting, gold and deep purple tones on dark background. Square composition, icon-ready.',
  'path-awakening': 'Ancient Egyptian statues in a museum coming to life at night — golden light emanating from their eyes and mouths. A mix of gods and humans, reaching toward the viewer. Style: cinematic digital painting, gold and stone tones on dark background. Square composition, icon-ready.',

  // Register-specific path icons (5 paths × 4 registers = 20)
  // Search — kid/teen/adult/family
  'path-search-kid': 'A young Egyptian hero child with a glowing compass, running through a magical golden tomb searching for hidden treasure pieces. Colorful, exciting, adventurous. Style: vibrant animated digital art, warm gold and bright blue. Square icon.',
  'path-search-teen': 'A mysterious map of ancient Egypt glowing with supernatural energy, pieces scattered like a puzzle. Dark, cool, enigmatic. Style: dark atmospheric digital art, neon gold and deep indigo. Square icon.',
  'path-search-adult': 'Isis kneeling in moonlit temple ruins, reassembling sacred relics by golden light. Classical, emotional, cinematic. Style: Renaissance-inspired digital painting, rich gold and deep blue. Square icon.',
  'path-search-family': 'A parent and child exploring a golden Egyptian tomb together, discovering glowing artifacts. Warm, adventurous, welcoming. Style: warm illustrated digital art, golden amber tones. Square icon.',

  // Trial — kid/teen/adult/family
  'path-trial-kid': 'Two colorful Egyptian animal gods — a brave falcon and a wild beast — facing off in a magical arena with golden scales between them. Exciting, dramatic, fun. Style: vibrant animated digital art, gold and crimson. Square icon.',
  'path-trial-teen': 'A dark courtroom of the gods with glowing scales of justice, shadowy figures watching from thrones, tension and mystery. Style: dark moody digital art, crimson and gold on black. Square icon.',
  'path-trial-adult': 'The divine tribunal of the Ennead — Horus and Set before the assembled gods, Ma\'at\'s feather glowing on the scales. Classical, dramatic. Style: Renaissance-inspired digital painting, gold and deep crimson. Square icon.',
  'path-trial-family': 'A family gathered around glowing golden scales, working together to weigh evidence like detectives in an ancient Egyptian court. Warm, collaborative. Style: warm illustrated digital art, gold and amber. Square icon.',

  // Letters — kid/teen/adult/family
  'path-letters-kid': 'A friendly ghost scribe sending glowing magical letters that float through a colorful Egyptian museum at night. Spooky but fun, whimsical. Style: vibrant animated digital art, amber and ghostly blue. Square icon.',
  'path-letters-teen': 'A translucent hand writing desperate hieroglyphs that glow in the dark, a soul trapped between dimensions. Haunting, emotional. Style: dark atmospheric digital art, ethereal blue and warm amber. Square icon.',
  'path-letters-adult': 'An ancient Egyptian scribe\'s ghost writing by candlelight on papyrus, hieroglyphs materializing as golden light. Intimate, literary, melancholic. Style: Renaissance-inspired digital painting, warm amber and deep shadow. Square icon.',
  'path-letters-family': 'A parent and child reading a glowing ancient letter together, the ghostly figure of a friendly Egyptian scribe watching gratefully. Warm, touching. Style: warm illustrated digital art, amber and soft gold. Square icon.',

  // Memory — kid/teen/adult/family
  'path-memory-kid': 'A magical golden eye showing amazing visions of ancient Egypt — pyramids being built, pharaohs marching, treasure glowing. Wondrous, exciting. Style: vibrant animated digital art, gold and purple. Square icon.',
  'path-memory-teen': 'The Eye of Horus as a portal through time, showing fragmented visions of ancient Egypt like a broken mirror. Surreal, mysterious. Style: dark atmospheric digital art, deep purple and electric gold. Square icon.',
  'path-memory-adult': 'The Eye of Horus radiating divine light, with layered visions of dynasties and ceremonies reflected within. Scholarly, awe-inspiring. Style: Renaissance-inspired digital painting, gold and deep purple. Square icon.',
  'path-memory-family': 'A family looking through a magical golden window that shows ancient Egypt alive and vibrant — people, animals, temples in full color. Wondrous, inclusive. Style: warm illustrated digital art, gold and warm purple. Square icon.',

  // Awakening — kid/teen/adult/family
  'path-awakening-kid': 'Friendly Egyptian statues coming alive in a museum at night, waving and smiling at a young visitor. Magical, fun, exciting. Style: vibrant animated digital art, gold and warm stone tones. Square icon.',
  'path-awakening-teen': 'Museum statues with glowing eyes opening their mouths to speak, shadows stretching across gallery floors. Eerie, cool, supernatural. Style: dark atmospheric digital art, gold and shadow. Square icon.',
  'path-awakening-adult': 'Ancient Egyptian figures stepping from their display cases, illuminated by inner golden light, reaching toward a mortal viewer. Cinematic, dramatic. Style: Renaissance-inspired digital painting, gold and stone on dark. Square icon.',
  'path-awakening-family': 'A diverse group of Egyptian artifact characters — gods, craftsmen, a cat — gathered warmly around a parent and child in a museum. Welcoming, magical. Style: warm illustrated digital art, gold and warm tones. Square icon.',

  // Path select background images — one per register (portrait, very dark for mobile overlay)
  'bg-paths-kid': 'Tall Egyptian tomb interior, faint golden light on hieroglyph walls, sense of adventure. Mostly darkness with hints of color. Style: dark cinematic digital painting, muted gold accents on near-black. Portrait 9:16 ratio, extremely dark, suitable as subtle phone wallpaper behind UI.',
  'bg-paths-teen': 'Tall dark Egyptian underground chamber, very faint neon-gold runes on ancient walls, deep shadows. Style: very dark moody digital art, hints of indigo and dim gold on black. Portrait 9:16 ratio, extremely dark, suitable as subtle phone wallpaper behind UI.',
  'bg-paths-adult': 'Tall Egyptian temple interior in near darkness, faint torchlight on massive columns, scholarly mood. Style: very dark Renaissance-inspired painting, dim amber highlights on black. Portrait 9:16 ratio, extremely dark, suitable as subtle phone wallpaper behind UI.',
  'bg-paths-family': 'Tall Egyptian gallery in near darkness, faint warm golden light through a distant doorway, welcoming but dark. Style: very dark illustrated art, muted golden amber on black. Portrait 9:16 ratio, extremely dark, suitable as subtle phone wallpaper behind UI.',

  // Age icons — character-driven
  'age-kid': 'A young Egyptian child adventurer holding a glowing torch, eyes wide with wonder, standing at the entrance of a golden tomb. Exciting, brave, colorful. Style: stylized digital art, warm gold tones on dark background. Square icon composition.',
  'age-teen': 'A mysterious Egyptian scarab beetle glowing with inner golden light, hieroglyphs swirling around it. Mystical and cool. Style: stylized digital art, gold and teal tones on dark background. Square icon composition.',
  'age-adult': 'The ibis-headed god Thoth writing in a great book with a golden reed pen, surrounded by scrolls and astronomical instruments. Scholarly, atmospheric. Style: cinematic digital painting, amber and dark tones on solid dark background. NO border, NO frame, NO white edges. Edge-to-edge art filling the entire square.',
  'age-family': 'An Egyptian parent and child holding hands, walking toward a golden temple entrance with warm glowing light. Welcoming, adventurous. Style: stylized digital art, warm gold tones on solid dark background. NO border, NO frame, NO white edges. Edge-to-edge art filling the entire square.'
};

// Direct REST API call for image generation (SDK doesn't support responseModalities well)
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

async function generateImageFromPrompt(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT']
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.inlineData) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
    }
  }
  throw new Error('No image in response');
}

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const result = await generateImageFromPrompt(prompt);
    res.json({ image: result.data, mimeType: result.mimeType });
  } catch (e) {
    console.error('Image gen error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Generate all game icons (called on startup or via admin route)
app.get('/api/generate-icons', async (req, res) => {
  const iconsDir = path.join(__dirname, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const results = {};
  for (const [name, prompt] of Object.entries(ICON_PROMPTS)) {
    const iconPath = path.join(iconsDir, `${name}.png`);
    if (fs.existsSync(iconPath)) {
      results[name] = 'cached';
      continue;
    }

    try {
      console.log(`Generating icon: ${name}...`);
      const result = await generateImageFromPrompt(prompt);
      const buffer = Buffer.from(result.data, 'base64');
      fs.writeFileSync(iconPath, buffer);
      results[name] = 'generated';
    } catch (e) {
      console.error(`Icon gen failed for ${name}:`, e.message);
      results[name] = `error: ${e.message}`;
    }
  }

  res.json({ results });
});

// Auto-generate icons on startup (background, non-blocking)
async function generateIconsOnStartup() {
  const iconsDir = path.join(__dirname, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const missing = Object.keys(ICON_PROMPTS).filter(
    name => !fs.existsSync(path.join(iconsDir, `${name}.png`))
  );

  if (missing.length === 0) {
    console.log('All game icons present.');
    return;
  }

  console.log(`Generating ${missing.length} game icons in background...`);
  for (const name of missing) {
    try {
      const result = await generateImageFromPrompt(ICON_PROMPTS[name]);
      const buffer = Buffer.from(result.data, 'base64');
      fs.writeFileSync(path.join(iconsDir, `${name}.png`), buffer);
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
    }
  }
  console.log('Icon generation complete.');
}

// ── Fallback to index.html ───────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  Museum Wakes running at http://localhost:${PORT}\n`);
  loadCatalog();

  // Generate icons in background after startup
  setTimeout(() => generateIconsOnStartup().catch(e => console.error('Icon gen startup error:', e)), 2000);
});

// ── Gemini Live Voice — WebSocket proxy ──────────────────────────────────────
const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const VOICE_MODEL = 'gemini-2.5-flash-native-audio-latest';

const wss = new WebSocketServer({ server, path: '/ws/voice' });

wss.on('connection', (clientWs) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(JSON.stringify({ type: 'error', message: 'GEMINI_API_KEY not set' }));
    clientWs.close();
    return;
  }

  let geminiWs = null;

  clientWs.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // First message from client should be 'setup' with system instructions
    if (msg.type === 'setup') {
      const geminiUrl = `${GEMINI_LIVE_URL}?key=${apiKey}`;
      geminiWs = new WebSocket(geminiUrl);

      geminiWs.on('open', () => {
        const setupMsg = {
          setup: {
            model: `models/${VOICE_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: msg.voice || 'Aoede'
                  }
                }
              }
            },
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                silenceDurationMs: 500
              },
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
            }
          }
        };

        if (msg.systemInstruction) {
          setupMsg.setup.systemInstruction = {
            parts: [{ text: msg.systemInstruction }]
          };
        }

        geminiWs.send(JSON.stringify(setupMsg));
      });

      geminiWs.on('message', (geminiData) => {
        try {
          const response = JSON.parse(geminiData);

          // Wait for setupComplete before telling client we're ready
          if (response.setupComplete) {
            clientWs.send(JSON.stringify({ type: 'ready' }));
            return;
          }

          clientWs.send(JSON.stringify({ type: 'response', data: response }));
        } catch {
          clientWs.send(geminiData);
        }
      });

      geminiWs.on('close', () => {
        try { clientWs.send(JSON.stringify({ type: 'closed' })); } catch {}
        clientWs.close();
      });

      geminiWs.on('error', (err) => {
        console.error('Gemini Live WS error:', err.message);
        try { clientWs.send(JSON.stringify({ type: 'error', message: err.message })); } catch {}
      });

      return;
    }

    // Forward audio and other messages to Gemini
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      if (msg.type === 'audio') {
        geminiWs.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: msg.data
            }
          }
        }));
      } else if (msg.type === 'text') {
        geminiWs.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text: msg.text }]
            }],
            turnComplete: true
          }
        }));
      } else if (msg.type === 'end') {
        geminiWs.close();
      }
    }
  });

  clientWs.on('close', () => {
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
  });
});
