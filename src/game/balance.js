// Every tunable number in the game lives here.

export const BASE_HP = 10;
export const BASE_DAMAGE = 5;

export const MAX_LEVEL = 7;
// Gold needed to reach Lv 2, 3, 4, 5, 6, 7 (each is the price of that one step).
export const UPGRADE_COSTS = [50, 100, 250, 500, 1000, 2500];
// Bonus at Lv 1..7 (index = level - 1).
export const HP_BONUS = [0, 5, 10, 20, 35, 55, 80];
export const DAMAGE_BONUS = [0, 2, 4, 7, 11, 16, 22];

// price: null means it can't be bought, only found.
export const WEAPONS = {
  bamboo: { name: 'Bamboo Sword', damage: 1, price: null, source: 'A gift from Elder Mittens' },
  club: { name: 'Wooden Club', damage: 3, price: 80, source: "Sold at Biscuit's shop" },
  claw: { name: 'Iron Claw-Blade', damage: 6, price: 300, needsSmith: true, source: 'Forged by Smith Whiskers' },
  moonsteel: { name: 'Moonsteel Sword', damage: 12, price: null, source: 'Hidden in a chest in the Deep Dark' },
};

export const HELMETS = {
  leaf: { name: 'Leaf Cap', hp: 3, price: null, source: 'Hidden in a chest in the Rat Burrow' },
  acorn: { name: 'Acorn Helm', hp: 8, price: 200, source: "Sold at Biscuit's shop" },
  iron: { name: 'Iron Helm', hp: 15, price: 600, needsSmith: true, source: 'Forged by Smith Whiskers' },
  crown: { name: 'Golden Crown-Helm', hp: 30, price: null, source: "Gnawfang's treasure" },
};

export const PLAYER = {
  speed: 5.2,
  radius: 0.45,
  attackCooldown: 0.42, // seconds between swings
  swingTime: 0.24,
  hitTime: 0.07, // when in the swing the hit lands
  attackRange: 1.7,
  attackHalfArc: (80 * Math.PI) / 180,
  autoAimRange: 3.2,
  iframes: 0.9,
};

// When you faint you keep this share of your gold.
export const FAINT_GOLD_KEPT = 0.5;

// range: distance at which the enemy stops to wind up.
// reach: radius of the red attack circle; standing inside it when it fills = hit.
export const ENEMIES = {
  rat: { name: 'Cave Rat', hp: 12, dmg: 1, gold: [5, 8], speed: 2.8, radius: 0.45, aggro: 7, range: 1.1, reach: 1.6, windup: 0.6, recover: 0.9 },
  bat: { name: 'Bat', hp: 8, dmg: 2, gold: [6, 10], speed: 3.6, radius: 0.4, aggro: 8, range: 1.0, reach: 1.5, windup: 0.5, recover: 1.0, flying: true },
  slime: { name: 'Slime', hp: 30, dmg: 3, gold: [15, 20], speed: 2.2, radius: 0.55, aggro: 7, range: 1.2, reach: 1.8, windup: 0.7, recover: 0.9 },
  spider: { name: 'Spider', hp: 45, dmg: 5, gold: [25, 35], speed: 3.8, radius: 0.55, aggro: 8, range: 1.2, reach: 1.8, windup: 0.55, recover: 0.8 },
  ratGuard: { name: 'Rat Guard', hp: 40, dmg: 6, gold: [20, 30], speed: 3.2, radius: 0.5, aggro: 9, range: 1.2, reach: 1.8, windup: 0.6, recover: 0.8 },
  golem: { name: 'Stone Golem', hp: 120, dmg: 9, gold: [60, 80], speed: 1.9, radius: 0.8, aggro: 7, range: 1.6, reach: 2.4, windup: 0.9, recover: 1.1 },
  brute: {
    name: 'Big Rat Brute', hp: 60, dmg: 3, gold: [60, 60], speed: 2.6, radius: 0.9, aggro: 9,
    range: 1.8, reach: 2.6, windup: 0.85, recover: 1.0, boss: true,
  },
  queen: {
    name: 'Spider Queen', hp: 220, dmg: 7, gold: [250, 250], speed: 3.0, radius: 1.1, aggro: 10,
    range: 2.0, reach: 3.0, windup: 0.8, recover: 0.9, boss: true,
    summon: { type: 'spider', count: 2, at: [0.66, 0.33] },
  },
  gnawfang: {
    name: 'Gnawfang the Rat King', hp: 700, dmg: 14, gold: [1000, 1000], speed: 2.8, radius: 1.3, aggro: 11,
    range: 2.2, reach: 3.4, windup: 0.9, recover: 0.8, boss: true,
    summon: { type: 'ratGuard', count: 2, at: [0.75, 0.5, 0.25] },
    enrageAt: 0.5, // below half HP he gets faster
  },
};

export const SUN_GEM_COLORS = [0xff8a3d, 0xffd23f, 0xff5c8a];
