# Museum Wakes

**An Egyptian Mystery at The Metropolitan Museum of Art**

Museum Wakes transforms the Met's Egyptian Wing into an immersive narrative mystery — powered entirely by generative AI. Visitors walk real galleries, scan real artifacts with their phone camera, and have live conversations with ancient gods and characters who respond in their own voice, in character, and in real time.

Every playthrough is unique. The app draws from a catalog of **8,390 real Egyptian artifacts** scraped from the Met's Open API — each with full metadata, imagery, gallery locations, and historical context. On every new session, the game samples a different set of target artifacts from this pool and weaves them into the narrative. The AI generates original dialogue around whichever artifacts you encounter, reacts to what you've discovered, remembers what you've said, and adapts its emotional arc across a 4-act story structure. With 5 paths, 4 age registers, thousands of artifact combinations, and fully generative dialogue — no two visitors will ever hear the same story.

No install. No download. Open a link on your phone.

### Demo Video

[![Museum Wakes Demo](https://img.youtube.com/vi/Reuz2qMhqu0/maxresdefault.jpg)](https://youtube.com/shorts/Reuz2qMhqu0)

---

## The Story

> The museum is closing. But something is wrong. The seal on the Triadic Gods has been broken — Osiris's power is fading. Isis is searching. Horus is watching you.
>
> You have one night to restore the balance.

---

## How It Works

1. **Choose your register** (kid / teen / adult / family) — the AI adapts its language, tone, and complexity
2. **Pick a narrative path** — five different stories through the same galleries, each with its own AI guide
3. **Walk the Egyptian Wing** — the guide directs you to specific artifacts with visual clue chains
4. **Scan artifacts** with your phone camera — Gemini Vision identifies what you're looking at and compares it against 8,390 cataloged objects
5. **The guide reacts** — every artifact triggers a unique, AI-generated story beat that references your earlier discoveries and advances the narrative
6. **Talk back** — type or speak to the gods and they respond in character with full conversational memory
7. **Reach the convergence** — the Hall of Two Truths, where the story resolves based on everything you've done

## Why Every Experience Is Different

Museum Wakes doesn't use pre-written scripts (except as fallback). The AI generates every line of dialogue live, using a layered prompt system:

- **Character layer** — each guide has a distinct personality that evolves across 4 acts (e.g., Isis begins warm and urgent, breaks down in Act 3, finds peace in Act 4)
- **Register layer** — the same god speaks differently to an 8-year-old vs. an adult scholar
- **World layer** — the AI knows real Egyptology: dynasties, materials, tomb rituals, hieroglyph meanings
- **Context layer** — the AI sees your full journey: which artifacts you've scanned, what clues you carry, what you've said in conversation, your current act and tension level
- **Beat system** — the narrative engine classifies each moment (discovery, deepening, crisis, resolution) and shapes the AI's emotional register accordingly

Combined with the 8,390-artifact catalog — where each session samples different targets — the narrative possibility space is enormous. Two visitors on the same path in the same gallery will talk to the same god about completely different artifacts, hear different stories, and carry different clues forward.

## Five Paths

| Path | Guide | Story | Tone |
|------|-------|-------|------|
| **The Search** | Isis | Find the 14 pieces of Osiris scattered across the wing | Adventure, discovery |
| **The Trial** | Thoth | Judge the Contendings of Horus and Set — gather evidence, render a verdict | Moral complexity, drama |
| **The Letters** | Kha (a scribe) | A dead scribe writes letters from the underworld — find his possessions to free his soul | Intimate, literary |
| **The Memory** | Thoth | Divine sight lets you see artifacts as they were 3,000 years ago | Awe, time-travel wonder |
| **The Awakening** | Various | Every artifact has a voice — gods, craftsmen, soldiers with quests and relationships | Conversational, surprising |

Each path has a 4-act structure with rising tension, character arc, and crisis point.

---

## Generative AI Architecture

Museum Wakes uses Gemini across every layer of the experience:

| Capability | Gemini Model | What It Does |
|-----------|-------------|-------------|
| **Narrative generation** | Gemini Flash | Live dialogue, story beats, guide responses — all generated in real time with layered character/register/world/context prompts |
| **Artifact recognition** | Gemini Flash (Vision) | Visitor takes a photo → Gemini identifies the artifact, extracts title, material, period, gallery, accession number |
| **Artifact matching** | Gemini Flash (Vision) | Compares visitor's photo against reference images to confirm they found the right target artifact |
| **Real-time voice** | Gemini Live (WebSocket) | Streaming voice conversation — speak to the gods and hear them respond through your earbuds |
| **Icon generation** | Gemini Pro (Image) | All game icons (path cards, age selection) are AI-generated from thematic prompts |

### The Prompt System

The AI doesn't receive a single flat prompt. Each request is built from 5 composable layers:

1. **Character** — who is speaking (Isis, Thoth, Kha) + their emotional state for the current act
2. **Register** — age-appropriate tone (a child hears "Set tricked Osiris into a box"; an adult hears the full mythological weight)
3. **World** — real Egyptological knowledge: gallery descriptions, artifact metadata, hieroglyph meanings, dynasty context
4. **Rules** — response format constraints: stay in character, reference real artifacts, never break the fourth wall
5. **Context** — the player's full journey state: artifacts scanned, clues collected, conversation history, act number, tension level

This means the AI's response to scanning the same artifact changes based on who you are, what path you're on, what act you're in, and what you've already discovered.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS — no framework, opens in any mobile browser |
| Server | Node.js + Express |
| AI narrative | Gemini API (text generation, vision, image comparison) |
| AI voice | Gemini Live (WebSocket streaming for real-time voice) |
| Artifact data | Local catalog of 8,390 Egyptian objects from the Met Open API |
| Artifact images | Served locally with auto-fetch fallback from Met servers |
| Voice (TTS) | Web Speech API (browser-native) |
| Storage | localStorage for session persistence |

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/vm1689/museum-wakes.git
cd museum-wakes

# Install dependencies
cd museum-wakes
npm install

# Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Run
npm start
```

Open **http://localhost:3000** in your browser.

### Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API key**
4. Free tier works for development

### Without an API Key

The app still works — it falls back to pre-written narrative content. AI dialogue, vision scanning, and voice features require the key.

---

## Project Structure

```
museum-wakes/
├── README.md
├── egypt-data/                  # Artifact catalog and data tools
│   ├── catalog_egyptian.json    # 8,390 objects with metadata, tags, image URLs
│   ├── index/                   # Pre-built indexes (by century, culture, medium, etc.)
│   ├── egypt_scraper.py         # Met API scraper
│   ├── data_utils.py            # Tagging and enrichment utilities
│   └── app.py                   # Streamlit data explorer
│
└── museum-wakes/                # The application
    ├── server.js                # Express server: static files, Gemini proxy, WebSocket voice
    ├── package.json
    ├── .env                     # GEMINI_API_KEY (not committed)
    │
    ├── public/                  # Served to the browser
    │   ├── index.html           # All screens (prologue → age → paths → gameplay → convergence → epilogue)
    │   ├── style.css            # Dark Egyptian theme, cinematic scroll, atmospheric effects
    │   ├── app.js               # Main controller: screen transitions, scanning, chat, entries
    │   ├── story-engine.js      # State machine: acts, beats, clue chains, path progress
    │   ├── narrative-engine.js  # Act structure, tension curves, beat classification
    │   ├── path-data.js         # Per-path artifact pools and target sampling
    │   ├── catalog.js           # Client-side catalog search and image URL resolution
    │   ├── claude.js            # Gemini prompt builder: layered character/world/rules/context
    │   ├── camera.js            # Camera capture for artifact scanning
    │   ├── voice.js             # Web Speech API wrapper
    │   ├── gemini-voice.js      # Gemini Live WebSocket voice client
    │   └── icons/               # AI-generated path and age icons (auto-generated on startup)
    │
    ├── dialogue.js              # Static god scripts, Met artifact IDs, gallery info (v1)
    ├── puzzles.js               # Hieroglyph puzzle definitions
    └── Wireframes/              # Original hand-drawn wireframes
```

---

## Key Features

- **4-act narrative structure** — each path has setup, rising tension, crisis, and resolution
- **Clue chains** — the AI guide directs you to specific next artifacts based on the story
- **Artifact scanning** — camera capture matched against catalog via Gemini Vision
- **Browse mode** — search the full 8,390-object catalog by gallery, keyword, period, or tags
- **Age registers** — the same path told four different ways (kid, teen, adult, family)
- **Act transitions** — cinematic overlays mark story progression
- **Voice mode** — real-time voice conversation with Gemini Live
- **Convergence** — all paths lead to the Hall of Two Truths for a final reflection
- **Epilogue scroll** — personalized summary of your journey and artifacts discovered

---

## The 8,390-Artifact Catalog

The diversity of the experience comes from the data. The `egypt-data/` directory contains a full catalog scraped from the Met Museum Open API:

- **8,390 objects** from the Egyptian Art department — every publicly cataloged Egyptian artifact at the Met
- Each object has: title, date, period, dynasty, medium, dimensions, gallery number, tags, image URL, description, provenance
- Pre-built indexes for browsing by century, classification, culture, department, medium, and tags
- Images are fetched on demand from Met servers and cached locally in `egypt-data/images/`

On each new session, the game's `PATH_DATA` engine samples a fresh set of target artifacts from this pool based on the chosen path. The AI then generates narrative around these specific artifacts — their real history, materials, symbolism, and gallery context. This means even repeat visitors on the same path encounter different artifacts and hear entirely new stories built from real Egyptological data.

---

## License

This project uses data from the [Metropolitan Museum of Art Open Access API](https://metmuseum.github.io/), which is available under Creative Commons Zero (CC0).

Built for the Google Hackathon — Statement 3: New Forms of Gameplay, Intelligent Worlds.
