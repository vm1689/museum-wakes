// puzzles.js — Hieroglyph puzzle definitions

const PUZZLES = {
  horus: {
    bridgeText: "Horus extends his wing. A symbol burns in the air before you.",
    glyph: '𓂀',
    glyphName: 'Wedjat — The Eye of Horus',
    question: 'The Falcon God guards this symbol with his life. What power does it hold?',
    options: [
      { text: 'The power of the sun', correct: false },
      { text: 'Protection against evil', correct: true },
      { text: 'Command over the dead', correct: false },
      { text: 'The gift of flight', correct: false }
    ],
    explanation: 'Correct. The Wedjat eye wards off evil.',
    // Shown on Task 2 completion screen — "About the Eye of Horus"
    symbolFacts: [
      "The Wedjat — 'the whole one' — is the eye of Horus, healed after his battle with Set.",
      "It was one of the most powerful amulets in ancient Egypt, worn to protect against evil, illness, and misfortune.",
      "Pharaohs carried it into battle. Sailors painted it on the bows of their boats.",
      "The six parts of the Wedjat eye represent the six senses — sight, smell, hearing, taste, touch, and thought.",
      "Each fraction also encoded a mathematical value. Together they nearly equal one — the missing piece was said to be supplied by Thoth, god of wisdom."
    ]
  },

  isis: {
    bridgeText: "Isis traces a symbol in the air with her finger. It glows, soft and blue.",
    glyph: '𓋹',
    glyphName: 'Ankh — The Key of Life',
    question: 'Isis placed this in your hands. The gods hold it in every carving, every tomb. What is its meaning?',
    options: [
      { text: 'Death and the underworld', correct: false },
      { text: 'The flooding of the Nile', correct: false },
      { text: 'Eternal life and immortality', correct: true },
      { text: 'The power of magic', correct: false }
    ],
    explanation: 'Correct. The Ankh is the breath of eternal life.',
    // Shown on Task 2 completion screen — "About the Ankh"
    symbolFacts: [
      "The Ankh is the hieroglyph for 'life' — the most recognised symbol from ancient Egypt.",
      "Only gods and pharaohs were depicted holding it. To receive the Ankh was to receive the breath of eternity.",
      "Isis used it to resurrect Osiris, breathing life back into his body with its power.",
      "The loop at the top may represent the rising sun on the horizon — or the union of the male and female principle.",
      "Early Christians in Egypt, the Copts, adopted a modified form of the Ankh as the Coptic cross — the symbol survived three thousand years."
    ]
  },

  osiris: {
    bridgeText: "Osiris lifts his crook. From between worlds, a final symbol forms.",
    glyph: '𓊽',
    glyphName: 'Djed Pillar — The Backbone of Osiris',
    question: 'This is Osiris\'s own symbol — the pillar that holds the sky. What does it represent?',
    options: [
      { text: 'The flooding of the Nile', correct: false },
      { text: 'Stability and resurrection', correct: true },
      { text: 'The wrath of the gods', correct: false },
      { text: 'The passage to the afterlife', correct: false }
    ],
    explanation: 'Correct. The Djed is the pillar of stability and resurrection.',
    // Shown on Task 2 completion screen — "About the Djed"
    symbolFacts: [
      "The Djed is the oldest symbol of Osiris — his spine, raised after death.",
      "It means stability, endurance, and resurrection. The word 'djed' itself means 'stable'.",
      "Each year the pharaoh performed the 'Raising of the Djed' ceremony — lifting the pillar upright to symbolise Osiris rising again and the land being renewed.",
      "The four horizontal bands at the top may represent the four cardinal directions — Osiris holding up the world from all sides.",
      "The Djed appears on the undersides of coffins, amulets, and temple walls across three thousand years of Egyptian history."
    ]
  }
};
