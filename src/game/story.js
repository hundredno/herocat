// Storyline: who says what, and what the player should do next.
// Lines are [speakerId, text] pairs.

export const CAVES = [
  { id: 'cave1', name: 'Rat Burrow', side: 'left', boss: 'brute' },
  { id: 'cave2', name: 'Crystal Hollow', side: 'middle', boss: 'queen' },
  { id: 'cave3', name: 'The Deep Dark', side: 'right', boss: 'gnawfang' },
];

export const SPEAKERS = {
  story: { name: 'Story', face: '📜', color: '#6c5ce7' },
  pip: { name: 'Pip', face: '🐱', color: '#f39c34' },
  elder: { name: 'Elder Mittens', face: '😺', color: '#7f8c8d' },
  biscuit: { name: 'Biscuit', face: '😸', color: '#e17055' },
  smith: { name: 'Smith Whiskers', face: '😼', color: '#8d6e63' },
  tom: { name: 'Tom', face: '🙀', color: '#2d3436' },
  luna: { name: 'Luna', face: '😻', color: '#b2bec3' },
  gnawfang: { name: 'Gnawfang the Rat King', face: '🐀', color: '#c0392b' },
  brute: { name: 'Big Rat Brute', face: '🐀', color: '#8e6e53' },
  queen: { name: 'Spider Queen', face: '🕷️', color: '#6c3483' },
};

/** Cave i opens once i Sun Gems are back in the Lantern Tower. */
export const isCaveUnlocked = (s, i) => s.gemsPlaced >= i;

export const carryingGem = (s) => s.gemsFound > s.gemsPlaced;

export function objective(s) {
  if (carryingGem(s)) return 'Bring the Sun Gem back to the Lantern Tower';
  switch (s.gemsPlaced) {
    case 0:
      return 'Find the 1st Sun Gem in the Rat Burrow (left cave)';
    case 1:
      return 'Find the 2nd Sun Gem in Crystal Hollow (middle cave)';
    case 2:
      return 'Defeat Gnawfang in the Deep Dark (right cave)';
    default:
      return 'Whiskerwood is saved! Keep training, HeroCat';
  }
}

export const LOCKED_HINTS = [
  '',
  'A huge boulder blocks Crystal Hollow. Return the 1st Sun Gem to the Lantern Tower first.',
  'A huge boulder blocks the Deep Dark. Return the 2nd Sun Gem to the Lantern Tower first.',
];

export const SCRIPTS = {
  prologue: [
    ['story', 'Whiskerwood is a cozy village of cats. Its Lantern Tower holds three Sun Gems that keep the village warm and bright.'],
    ['story', 'But last night, Gnawfang the Rat King crept in and stole all three Sun Gems!'],
    ['gnawfang', 'Squee-hee-hee! The shiny gems are MINE now! I hid them in my three caves. No silly cat will ever get them back!'],
    ['story', 'Without the Sun Gems, Whiskerwood grows colder and darker every day…'],
    ['elder', 'Pip! You may be small, but you have the bravest heart in all of Whiskerwood.'],
    ['elder', 'Take my old Bamboo Sword. On your own you deal 5 damage, and the sword adds +1. That makes 6!'],
    ['elder', 'The 1st Sun Gem is in the Rat Burrow, the cave on the left. Monsters drop gold coins when you beat them.'],
    ['elder', "Spend your gold at Biscuit's shop to train your HP and damage, and to buy better weapons and helmets."],
    ['pip', "I'll bring all three Sun Gems home. HeroCat is on the job!"],
  ],

  caveIntro: [
    [['pip', "It smells like old cheese in here… Rats! I'll find that Sun Gem."]],
    [['pip', 'Glowing crystals… and sticky webs. I hope the spiders here are friendly.'], ['pip', '(They are not.)']],
    [['pip', 'The Deep Dark. Gnawfang must be waiting at the very end.'], ['pip', 'Deep breath, Pip. You can do this.']],
  ],

  bossIntro: {
    brute: [
      ['brute', 'Oi! Who let a kitten in here? The boss told me to guard this gem.'],
      ['brute', 'You want it? Come and get it!'],
    ],
    queen: [
      ['queen', 'Ssso… a little cat wandered into my web.'],
      ['queen', 'Did you come for the shiny gem, or to become my dinner?'],
    ],
    gnawfang: [
      ['gnawfang', 'YOU! The kitten with the bamboo stick! You took back two of my gems!'],
      ['pip', 'Give back our last Sun Gem, Gnawfang!'],
      ['gnawfang', 'Never! This one stays with ME. Prepare to be squeaked!'],
    ],
  },

  bossDefeated: [
    [
      ['brute', 'Ow, ow, ow! Okay, okay, take the gem! I quit!'],
      ['pip', 'The 1st Sun Gem! Now to bring it back to the Lantern Tower.'],
      ['story', 'A glowing portal appeared. Step into it to return to Whiskerwood.'],
    ],
    [
      ['queen', 'Impossible… beaten by a kitten…'],
      ['pip', 'The 2nd Sun Gem! Just one more to go.'],
      ['story', 'A glowing portal appeared. Step into it to return to Whiskerwood.'],
    ],
    [
      ['gnawfang', 'My gems! My beautiful shiny gems! …FINE! Keep them! Keep my crown too! I never want to see a cat again!'],
      ['story', 'Gnawfang ran away squeaking. Pip found the last Sun Gem and the Golden Crown-Helm!'],
      ['pip', 'The last Sun Gem! Whiskerwood, here I come!'],
    ],
  ],

  gemPlaced: [
    [
      ['elder', 'The 1st Sun Gem! Look, Pip, the sky is already brighter!'],
      ['elder', 'Did you hear that rumble? The boulder in front of Crystal Hollow, the middle cave, has rolled away.'],
      ['elder', "Spiders live in Crystal Hollow and they bite hard. Train at Biscuit's shop if you need to."],
    ],
    [
      ['elder', 'Two Sun Gems! Whiskerwood is getting warmer!'],
      ['elder', 'The way to the Deep Dark, the cave on the right, is open now. Gnawfang himself guards the last gem.'],
      ['elder', 'He is VERY strong. Try to train your HP and damage to level 4 before you face him!'],
    ],
    [
      ['story', 'Pip placed the last Sun Gem in the Lantern Tower…'],
      ['story', 'The tower blazed with golden light, and warmth flowed back into every corner of Whiskerwood!'],
      ['elder', 'You did it, Pip! You are a true hero. From today, everyone will call you… HeroCat!'],
      ['biscuit', 'Free fish snacks for HeroCat, forever!'],
      ['pip', "Hooray! And if any more monsters show up, I'll be ready!"],
    ],
  ],

  smithRescue: [
    ['smith', 'Mmmf! Mmmf! …Phew! Thank you! Those spiders wrapped me up like a fishy burrito!'],
    ['smith', "I'm Smith Whiskers, the best blacksmith in Whiskerwood. I'll head home to Biscuit's shop right away."],
    ['smith', "Visit me there and I'll forge you an Iron Claw-Blade and an Iron Helm!"],
  ],

  shopGreeting: [['biscuit', 'Welcome! Gold for training, gold for gear. Whatever makes you stronger, Pip!']],
};

export function elderLines(s) {
  if (carryingGem(s)) return [['elder', 'You found a Sun Gem! Place it in the Lantern Tower, right behind me.']];
  switch (s.gemsPlaced) {
    case 0:
      return [
        ['elder', 'The Rat Burrow is the cave on the left. Rats and bats live there.'],
        ['elder', 'When a red circle appears under a monster, it is about to attack. Step out of the circle!'],
      ];
    case 1:
      return [['elder', 'Crystal Hollow is the middle cave. Slimes and spiders live there. Someone was heard calling for help inside, too…']];
    case 2:
      return [['elder', 'Gnawfang waits in the Deep Dark, the cave on the right. Train your HP and damage to level 4 before you go!']];
    default:
      return [['elder', 'Thanks to you, Whiskerwood shines again. The caves are still full of monsters if you want to keep training!']];
  }
}

const VILLAGER_LINES = {
  tom: [
    "Brrr! It's so cold since the Sun Gems vanished. My whiskers are frozen!",
    "It's a bit warmer now. Thanks, Pip!",
    'My whiskers have thawed! Go get that last gem!',
    'HeroCat! HeroCat! Can I have your pawtograph?',
  ],
  luna: [
    'Beat monsters to get gold, then visit Biscuit. Training makes you stronger for good!',
    'Tip: hold the attack button to keep swinging your sword.',
    'Hurt? Touch the fountain to heal all your HP.',
    'The village has never looked so bright!',
  ],
};

export const villagerLines = (id, s) => [[id, VILLAGER_LINES[id][Math.min(3, s.gemsPlaced)]]];
