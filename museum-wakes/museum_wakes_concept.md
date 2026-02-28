# The Museum Wakes — Hackathon Concept Doc
*Google Hackathon | Statement 3: New forms of gameplay, intelligent worlds, dynamic player experiences*

---

## The Pitch

> "We don't build audio guides. We build worlds."

The Met has 30,000 Egyptian artifacts. Most visitors walk past them in 20 minutes. We make them stay for hours.

Turn a real physical museum into a Da Vinci Code-style mystery. The visitor IS the main character. No prior knowledge of history or hieroglyphs needed — Gemini bridges the gap through story.

---

## The Story Hook

> *The museum is closing. But something is wrong. The seal on the Triadic Gods has been broken — Osiris's power is fading. Isis is searching. Horus is watching you.*
>
> *You have one night to restore the balance. Each god has a piece of the answer. But they will only speak if you find them first.*

---

## The Experience

- Visitor opens a web app on their phone
- Walks up to an exhibit → proximity/camera detects it
- The artifact's character speaks to them (earbuds, invisible to other visitors)
- Each encounter gives a clue, a riddle, a piece of the story
- Visitor collects narrative fragments across the museum to solve the central mystery

**Non-intrusive:** phone + earbuds only. Zero disruption to other visitors.
**Zero prior knowledge needed:** the story IS the education.

---

## Demo: The Triadic Gods (Met Museum Egyptian Collection)

| God | Personality | Role in the quest |
|---|---|---|
| **Horus** | Warrior, protector, suspicious | Tests you — are you worthy? Gives the first clue |
| **Isis** | Wise, maternal, sorrowful | Shares the secret of Osiris's fall. Teaches hieroglyphs as "keys" |
| **Osiris** | Weakened, speaks in riddles | Final encounter — restore him to complete the story |

---

## Tech Stack

| Need | Google Tool |
|---|---|
| Artwork recognition | Gemini Vision |
| Character voice + dialogue | Gemini API |
| Artwork data (free, no scraping) | Met Museum Open API |
| Voice output | Google Text-to-Speech |
| Personalization | Gemini adapts to language, age, choices |
| Proximity / location | Google Nearby or GPS/BLE |

### Met Museum Open API
- Free, public, no copyright issues
- Every artwork: ID, title, image, description, date, materials
- Horus, Isis, Osiris all in their Egyptian collection
- Could scale to all 30,000 artifacts overnight

---

## Demo Flow

```
Visitor points phone at artwork
        ↓
Camera captures image
        ↓
Met API identifies the piece (or Gemini Vision does)
        ↓
Gemini generates the god's voice in character
        ↓
Visitor hears/reads the god speaking — story advances
        ↓
Next artifact. Next chapter.
```

---

## Platform
- **Visitor experience:** Phone web app (no install, just open a link)
- **Demo/presentation:** Laptop

---

## Why This Wins

1. Solves a real problem (boring permanent collections) at a world-famous venue
2. Fully legitimate — built on Met's public API
3. Extensible — any museum, any collection, any language, zero content authoring
4. Previous hackathon finalist work (proximity-based museum engagement) directly extends this
5. Narrative layer makes it unforgettable vs. a standard audio guide

---

## Next Step (when ready to build)

Need a **Gemini API key** from Google AI Studio:
1. Go to aistudio.google.com
2. Sign in with Google account
3. Click Get API key
4. Free tier is fine for the demo

Once key is ready → start coding immediately.

---

*Saved: Feb 25 2026 — concept discussion, not yet built*
