// dialogue.js — Pre-written god dialogue (swap this file for Gemini API later)

const DIALOGUE = {
  horus: {
    name: "Horus",
    title: "God of the Sky, Protector of Kings",
    color: "#C8A84B",

    // Welcome speech — played on first encounter
    intro: [
      "You dare approach me? You, a mortal who wanders these halls like all the others?",
      "Perhaps you are different. The seal is broken. Osiris weakens. And yet — you are here.",
      "I am Horus. Eye of the Falcon. Protector of the Pharaohs. I will test your worth.",
      "There are two tasks before you. Pass them both and I will send you onward."
    ],

    // Task 1 assignment — shown after intro
    task1Assign: "Your first task: find my falcon form in Gallery 127. I am among the deity statuettes — small, made of faience, shaped by hands that knew what I was. The gallery holds two exquisite statuettes of deities. I am one of them. I have shown you my image. Go.",

    // Educational facts shown after Task 1 scan (About the artifact)
    task1Facts: [
      "This is a faience Horus falcon, housed in Gallery 127 — the Lila Acheson Wallace Galleries of Egyptian Art.",
      "It dates to 664–332 B.C., the Late Period, when artists looked back to ancient traditions and crafted works of remarkable sensitivity.",
      "Faience — a glazed composition the Egyptians called tjehenet, meaning 'brilliant' — was sacred. Its blue-green colour symbolised life, fertility, and the divine.",
      "The falcon was the living form of Horus. Every pharaoh was Horus incarnate — king and god as one, from the first breath of their reign to the last.",
      "Gallery 127 is known for its Dynasty 26 royal sculpture and objects that once graced temples and shrines — among them, two exquisite statuettes of deities."
    ],

    // Task 2 bridge — introduces the hieroglyph puzzle
    task2Intro: "Now you have seen my image. But do you understand my symbol? Look closely — this is the test that matters.",

    clue: "The Eye of Horus was split. Isis knows where the pieces fell. Find her in Gallery 134 — she holds the child.",
    hint: "Isis is in Gallery 134 — the Ptolemaic galleries. She stands holding Horus, made of faience."
  },

  isis: {
    name: "Isis",
    title: "Goddess of Magic, Mother of Horus",
    color: "#4B7EC8",

    // Welcome speech
    intro: [
      "The falcon sent you. I felt it.",
      "I am Isis. I have searched ten thousand years for what was taken from me.",
      "I know grief that would break a mortal mind. But you — you came. That matters.",
      "Osiris was struck down. His power scattered across this world. The fragments are encoded — in the old language."
    ],

    // Task 1 assignment
    task1Assign: "Your first task: find my figure in Gallery 134 — the Ptolemaic galleries. I stand holding Horus, my son. I am made of faience, from the era of 332 to 30 B.C. The gallery holds delicate deity figurines and the memory of great queens. I have shown you my image. Go.",

    // Educational facts after Task 1 scan
    task1Facts: [
      "This is a faience statuette of Isis with the infant Horus, housed in Gallery 134 — the Lila Acheson Wallace Galleries of Egyptian Art.",
      "It dates to 332–30 B.C., the Ptolemaic era — when Egypt was ruled by the descendants of Alexander the Great's general, and Greek and Egyptian traditions merged.",
      "Gallery 134 is home to delicate faience inlays, deity figurines, and depictions of famous queens: Berenike II, Arsinoe II, and Cleopatra VII.",
      "Isis was the most widely worshipped goddess in the ancient world. Her cult spread from Egypt across the Roman Empire — temples to Isis stood in Rome, London, and Pompeii.",
      "She is shown nursing Horus — the image of divine mother and child. This pose would later influence early Christian depictions of the Virgin Mary and the infant Jesus."
    ],

    // Task 2 bridge
    task2Intro: "I taught the old language to those who would listen. Now I will teach you one symbol. It is the most important one. Look.",

    clue: "The ankh — ☥ — is the key. Carry it with you. When Osiris speaks in riddles, the answer is always life.",
    hint: "Osiris is back in Gallery 127 — beside where you found Horus. He was there all along."
  },

  osiris: {
    name: "Osiris",
    title: "God of the Dead, Lord of the Underworld",
    color: "#4BC87A",

    // Welcome speech
    intro: [
      "You... came.",
      "I did not think anyone would come.",
      "I am Osiris. I was mighty once. Lord of all that grows and all that ends.",
      "Something was taken. And I have been fading. But you are here now."
    ],

    // Task 1 assignment
    task1Assign: "Return to Gallery 127. I was there beside Horus all along — but you could not see me until Isis taught you the old language. Find my statuette: copper and gold leaf, donated in my name. I have shown you my image. Look deeper this time.",

    // Educational facts after Task 1 scan
    task1Facts: [
      "This is a statuette of Osiris with the epithets Neb Ankh ('Lord of Life') and Khentyimentiu ('Foremost of the Westerners'), donated by a worshipper named Padihorpare.",
      "It dates to ca. 588–526 B.C. and is crafted from cupreous metal with gold leaf — a votive offering placed in a temple to honour Osiris.",
      "Gallery 127 reflects a period when Dynasty 26 artists combined elements from centuries of Egyptian art into new, sensitive creations with brilliant surface treatments.",
      "'Neb Ankh' — Lord of Life. Even in death, Osiris governed life itself. The Nile flooded in his name. The grain grew from his body. The dead were judged by his law.",
      "He was donated by a private individual — not a pharaoh, not a priest. An ordinary person who believed, who gave what they had, and placed it here for eternity."
    ],

    // Task 2 bridge
    task2Intro: "You carry the words Horus and Isis gave you. Now decode my symbol — the oldest one of all. It is the pillar that holds the sky.",

    clue: "The mystery is solved. Osiris is restored — not by magic, but by the act of listening. The seal holds.",
    hint: ""
  }
};

// Artifact IDs from the Met Museum Open API (verified, on-view, with images)
const MET_ARTIFACTS = {
  horus:  550936,  // Horus Falcon — faience, 664–332 B.C., Gallery 127
  isis:   548310,  // Statuette of Isis with the infant Horus — faience, 332–30 B.C., Gallery 134
  osiris: 546747   // Statuette of Osiris (Neb Ankh) — cupreous metal, gold leaf, ca. 588–526 B.C., Gallery 127
};

// Real Met Museum gallery locations (Lila Acheson Wallace Galleries of Egyptian Art)
const GALLERY_INFO = {
  horus: {
    gallery: 'Gallery 127',
    wing: 'Lila Acheson Wallace Galleries of Egyptian Art',
    hint: 'Look for the small faience falcon among the deity statuettes. The gallery description notes two exquisite statuettes of deities — Horus is one of them.',
    directions: 'From the Great Hall, enter the Egyptian Art wing on the ground floor. Follow the galleries through to 127 — known for its Dynasty 26 royal sculpture and shrine objects.'
  },
  isis: {
    gallery: 'Gallery 134',
    wing: 'Lila Acheson Wallace Galleries of Egyptian Art',
    hint: 'Find the faience statuette of Isis holding the infant Horus. She stands among the Ptolemaic deity figurines in faience and bronze.',
    directions: 'Continue through the Egyptian Art galleries. Gallery 134 is the Ptolemaic gallery — home to delicate faience inlays, deity figurines, and depictions of famous queens.'
  },
  osiris: {
    gallery: 'Gallery 127',
    wing: 'Lila Acheson Wallace Galleries of Egyptian Art',
    hint: 'Return to Gallery 127 and look to the western shelves — the series of amulets and small sculptures. Find the copper and gold-leaf Osiris among them.',
    directions: 'Return to Gallery 127 where you found Horus. Osiris was there all along — on the western shelves, among the small sculptures and amulets.'
  }
};
