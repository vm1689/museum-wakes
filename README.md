# Museum Wakes

**An Egyptian Mystery at The Metropolitan Museum of Art**

A mobile web app that turns the Met's Egyptian Wing into a narrative mystery game. Visitors walk real galleries, scan real artifacts with their phone, and speak with ancient gods who respond in character using generative AI.

No install. No download. Open a link on your phone.

---

## The Story

> The museum is closing. But something is wrong. The seal on the Triadic Gods has been broken — Osiris's power is fading. Isis is searching. Horus is watching you.
>
> You have one night to restore the balance.

---

## How It Works

1. Choose your age register (kid / teen / adult / family) — the gods adapt their voice
2. Pick a narrative path — each tells a different story through the same galleries
3. Walk the Egyptian Wing. The AI guide directs you to specific artifacts
4. Scan artifacts with your phone camera or browse the catalog
5. The guide reacts to what you find — the story advances, clues chain forward
6. Reach the Hall of Two Truths for the final convergence

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

## Artifact Data

The `egypt-data/` directory contains a full catalog scraped from the Met Museum Open API:

- **8,390 objects** from the Egyptian Art department
- Each object has: title, date, period, dynasty, medium, dimensions, gallery number, tags, image URL, description, provenance
- Pre-built indexes for browsing by century, classification, culture, department, medium, and tags
- Images are fetched on demand from Met servers and cached locally in `egypt-data/images/`

---

## License

This project uses data from the [Metropolitan Museum of Art Open Access API](https://metmuseum.github.io/), which is available under Creative Commons Zero (CC0).

Built for the Google Hackathon — Statement 3: New Forms of Gameplay, Intelligent Worlds.
