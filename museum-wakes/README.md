# The Museum Wakes
### A Google Hackathon Project — Statement 3: New Forms of Gameplay, Intelligent Worlds

---

## What It Is

A mobile web app that turns The Metropolitan Museum of Art's Egyptian Wing into a Da Vinci Code-style mystery game. Visitors walk the real galleries, find real artifacts, scan them, and speak directly with the ancient gods — who respond with their own voice and remember what you've already told them.

The seal on the Triadic Gods has been broken. Osiris is fading. You have one night to restore the balance.

**No install. No download. Open a link on your phone.**

---

## The Concept

Three gods. Three galleries. Two tasks each.

| God | Gallery | Symbol | Task |
|-----|---------|--------|------|
| Horus | Gallery 127 | 𓂀 Wedjat — Eye of Horus | Find the falcon statuette. Decode its symbol. |
| Isis | Gallery 134 | 𓋹 Ankh — Key of Life | Find the faience figure. Decode its symbol. |
| Osiris | Gallery 127 | 𓊽 Djed — Backbone of Osiris | Find the mummiform figure. Decode its symbol. |

Unlock Horus first → Isis second → Osiris last.

> **Narrative note:** Horus and Osiris are both in Gallery 127. Osiris was there beside Horus all along — but you couldn't see him until Isis taught you the old language.

---

## Full Game Flow

```
Intro Screen
  └─► Difficulty Selection (Easy / Medium / Hard)
        └─► Gods of Egypt intro (with real Met Museum images)
              └─► Home Map (Triadic Gods — locked / available / visited)
                    └─► Encounter per god:
                          1. Welcome chat     (god speaks first; player can reply — Gemini powered)
                          2. Task 1 assign    (god tells you which artifact to find + image shown)
                          3. Scan             (simulated camera scan + artifact identification)
                          4. Task 1 Complete  (About the Artifact — 5 educational facts)
                          5. Task 2           (god shows a hieroglyph symbol + multiple choice puzzle)
                          6. Task 2 Complete  (About the Symbol — 5 deep-dive facts)
                    └─► Repeat for next god
              └─► Ending Screen — The Seal Holds
```

### Difficulty Levels

| Level | Time | Content |
|-------|------|---------|
| Easy | ~30 min | Task 1 only — find artifacts, hear the gods speak |
| Medium | ~1 hr | Both tasks — artifacts + hieroglyph puzzles + all educational content |
| Hard | ~2 hrs | Both tasks + pattern unlock (planned) |

### Mid-Encounter Navigation

If the user goes back to the map mid-encounter, progress is saved. On re-entry:
- Left before Task 1 → resumes at Task 1 assignment
- Left after Task 1 (scan done) → resumes at Task 2 directly
- Both tasks done → god is marked visited; returns to home map

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| App | Vanilla HTML/CSS/JS | No framework, no install — opens in any mobile browser |
| Artifact images | Met Museum Open API | Free, no auth required |
| Voice | Web Speech API | Browser-native TTS; male voices for Horus/Osiris, female for Isis |
| Dialogue | Gemini API (`gemini-2.0-flash`) | Two-way conversation with full god persona system prompts |
| Storage | localStorage | Progress (phase, visited gods, task progress, clues) persists across refreshes |
| Future: scan | Gemini Vision | Camera input → artifact identification in real galleries |
| Future: TTS | Google Cloud TTS | Higher-quality god voices to replace Web Speech API |

---

## File Structure

```
museum-wakes/
├── index.html      — All screens (HTML shell, no server needed)
├── style.css       — Dark Egyptian theme, all screen styles, chat bubble styles
├── app.js          — Main controller: screen transitions, encounter phases, chat logic
├── dialogue.js     — Static god scripts: intro lines, task assignments, educational facts
│                     + MET_ARTIFACTS (verified object IDs) + GALLERY_INFO (real locations)
├── gemini.js       — Gemini API integration: per-god system prompts, conversation history,
│                     two-way chat, graceful fallback when no API key
├── puzzles.js      — Hieroglyph puzzle definitions (glyph, question, options, symbol facts)
├── story.js        — State machine: phase tracking, visited gods, task progress, localStorage
├── voice.js        — Web Speech API wrapper: male/female voice selection, single/multi-line
├── met-api.js      — Met Museum Open API: fetches artifact images and metadata
└── wireframes/     — Original hand-drawn wireframes (Steps 2–9)
```

---

## How to Run

No server needed.

1. Open `index.html` in a browser (Chrome or Safari recommended for voice support)
2. For the full experience, open on a phone at The Met's Egyptian Wing
3. To enable live AI dialogue, add your Gemini API key to `gemini.js` line 6:
   ```javascript
   apiKey: 'YOUR_GEMINI_API_KEY_HERE',  // replace this
   ```

For a local development server (optional, for CORS-free API calls):
```bash
cd museum-wakes
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Gemini Integration

### How It Works

`gemini.js` powers two-way conversations between the player and each god.

- Each god has a detailed **system prompt** defining personality, speech style, and emotional state
- The app maintains a **conversation history per god** (resets on each new encounter)
- Gemini is aware of **player progress** — which gods they've spoken with and what clues they carry
- Gemini is aware of the **real artifact** in front of the player (title, date, medium, gallery)

### God Personas

| God | Personality | Speech style |
|-----|------------|-------------|
| Horus | Suspicious of mortals; tests them; earned his power through battle | Short, commanding sentences. Never rambles. |
| Isis | Warm but carrying grief; a teacher, not a warrior; speaks to the player as an equal | Flowing sentences; occasionally asks questions; draws the player into the mystery |
| Osiris | Weakened, fading, speaking from far away; deeply grateful someone came | Sparse, poetic; sometimes fragmented; uses ellipses for effect |

### Graceful Fallback

If no API key is set, the app falls back to pre-written static dialogue. All game logic, educational content, voice, and puzzles work without Gemini. The API key is enhancement-only.

### Configuration

```javascript
// gemini.js
const GEMINI = {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE',  // swap this
  model:  'gemini-2.0-flash',
  ...
};
```

- `maxOutputTokens: 120` — keeps god responses short and dramatic
- `temperature: 0.92` — creative but consistent

---

## Met Museum Artifacts

Real, on-view objects fetched live from the Met Open API (verified with images):

| God | Met Object ID | Object | Gallery | Medium | Date |
|-----|--------------|--------|---------|--------|------|
| Horus | 550936 | Horus Falcon | 127 | Faience | 664–332 B.C. |
| Isis | 548310 | Statuette of Isis with the Infant Horus | 134 | Faience | 332–30 B.C. |
| Osiris | 546747 | Statuette of Osiris (Neb Ankh), donated by Padihorpare | 127 | Cupreous metal, gold leaf | ca. 588–526 B.C. |

API endpoint: `https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}`

---

## Real Gallery Descriptions

All galleries are part of the **Lila Acheson Wallace Galleries of Egyptian Art**, ground floor.

| Gallery | Description |
|---------|-------------|
| **123** | Monumental Egyptian art — granite jamb from Ramesses II's funerary temple, King Apries limestone relief, stone coffins, royal heads, and a gilded bronze statue of Ptah. |
| **127** | Dynasty 26 art (from 664 B.C.) — sensitive modeling, brilliant surface treatments, royal sculpture, two exquisite deity statuettes, Nespekashuty's unfinished tomb wall, western shelves of amulets and small sculptures. **Home to Horus and Osiris.** |
| **130** | Displayed as a storeroom for discovery — painted textiles, bronze deity statuettes, faience funerary figurines, hundreds of amulets (1100 B.C.–A.D. 300), elaborately decorated coffins, and Nubian Meroe objects. |
| **134** | Ptolemaic era (332–30 B.C.) — delicate faience inlays, deity figurines in faience and bronze, silver and bronze vessels, limestone plaques, depictions of Berenike II, Arsinoe II, and Cleopatra VII. **Home to Isis.** |
| **137** | Early Roman Period (30 B.C.–A.D. 200) — faience head of Augustus, superb panel portraits, mummy of a man from Hawara with Hellenistic portrait replacing traditional mask. |

---

## Hieroglyph Puzzles

### Horus — 𓂀 Wedjat (Eye of Horus)
**Q:** What power does it hold?
**A:** Protection against evil
> "Wedjat" means "the whole one" — Horus's eye healed after his battle with Set. The six parts encode six senses AND six mathematical fractions. One of the most powerful amulets in ancient Egypt.

### Isis — 𓋹 Ankh (Key of Life)
**Q:** What is its meaning?
**A:** Eternal life and immortality
> The hieroglyph for "life". Only gods and pharaohs held it. Isis used it to resurrect Osiris. Early Christians in Egypt adopted a modified Ankh as the Coptic cross.

### Osiris — 𓊽 Djed Pillar (Backbone of Osiris)
**Q:** What does it represent?
**A:** Stability and resurrection
> Osiris's spine, raised after death. The "Raising of the Djed" ceremony was performed annually by the pharaoh. The four bands represent the four cardinal directions.

---

## God Voices

| God | Voice gender | Preferred voice (Web Speech API) |
|-----|-------------|----------------------------------|
| Horus | Male | Google UK English Male → Daniel → Alex → Fred |
| Isis | Female | Google UK English Female → Samantha → Karen → Victoria |
| Osiris | Male | Same as Horus |

Voice is enhancement-only — if the browser doesn't support it, all text appears manually via button taps.

---

## State Machine

```
intro → horus → isis → osiris → complete
```

- `intro`: Only Horus is unlocked
- `horus`: Isis unlocks after Horus is first visited
- `isis`: Osiris unlocks after Isis is first visited
- `complete`: All three visited; ending screen shown

### Task Progress (per god)

```javascript
taskProgress: { horus: 1, isis: 2 }
// 0 = not started
// 1 = Task 1 complete (scan done)
// 2 = Both tasks complete
```

Saved to `localStorage`. Used to resume mid-encounter correctly when the player leaves and returns.

### Clues

Each god gives the player a clue on first encounter. Clues are displayed in the Home screen's clue panel and passed to Gemini as context for future encounters.

---

## Wireframes

Hand-drawn wireframes in `/wireframes/` (Steps 2–9):

| File | Step | Content |
|------|------|---------|
| IMG_0208 | Step 2 | Difficulty selection |
| IMG_0209 | Step 3 | Gods of Egypt unlock order |
| IMG_0210 | Step 4 | Horus welcome + Task 1 assignment |
| IMG_0211 | Step 5 | Museum floor map with path |
| IMG_0212 | Step 6 | Task 1 complete + About the artifact |
| IMG_0213 | Step 7 | Task 2 — hieroglyph puzzle |
| IMG_0214 | Step 8 | Task 2 complete + About the symbol |
| IMG_0215 | Step 9 | Isis — same workflow |

---

## Planned Features

### Gemini Vision (scan)
Replace the simulated scan with a real camera feed. The visitor points their phone at an artifact, Gemini Vision identifies it, and the encounter begins. Entry point: `APP.startScan()` in `app.js`.

### Random Artifact Selection
Each session, the app searches the Met API for a different Egyptian artifact associated with each god. Gemini's system prompt and the task assignment speech update automatically from the artifact's metadata. Fixed IDs remain as fallback.

### Generative Hieroglyph Puzzles
Gemini picks a different hieroglyph from a curated pool each session and generates the puzzle (question, options, explanation, 5 symbol facts). Keeps repeat visitors engaged with new educational content.

### Google Cloud TTS
Replace `VOICE.speakLines()` in `voice.js` with Google Cloud Text-to-Speech for higher-quality, more dramatic god voices. No other files need to change.

### Hard Mode — Pattern Unlock
A third task per god: the player must identify a repeating visual pattern across all three artifacts, connecting them to the overarching mystery.

---

## Known Limitations (Hackathon Build)

- Scan is simulated — no real camera integration yet (Gemini Vision is the planned upgrade)
- Gemini dialogue requires an API key dropped into `gemini.js`; without it, all static dialogue is shown
- Voice quality depends on the browser's available voices; Chrome on desktop has the best selection
- Hard mode shows the same content as Medium (pattern unlock not yet built)
- Met API images load on boot; if offline, fallback placeholder icons are shown

---

*Built for the Google Hackathon — Statement 3: New Forms of Gameplay, Intelligent Worlds*
