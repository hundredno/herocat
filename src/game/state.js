import { ARMOR, BASE_DAMAGE, BASE_HP, DAMAGE_BONUS, HELMETS, HP_BONUS, MAX_LEVEL, WEAPONS } from './balance.js';

export const SAVE_KEY = 'herocat.save.v1';
const SAVE_VERSION = 1;
const CHEST_IDS = ['cave1', 'cave2', 'cave3'];
export const DEFAULT_NAME = 'Pip';
export const NAME_MAX = 12;

/** Player-typed hero name → safe display text (still needs escaping before going into HTML). */
export function cleanName(raw) {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  // Drop control, zero-width and text-direction characters (keeps the joiner emoji sequences use).
  const text = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const name = Array.from(text).slice(0, NAME_MAX).join('').trim();
  return name || DEFAULT_NAME;
}

export function newState() {
  return {
    v: SAVE_VERSION,
    name: DEFAULT_NAME,
    gold: 0,
    hpLevel: 1,
    damageLevel: 1,
    weapons: ['bamboo'],
    weapon: 'bamboo',
    helmets: [],
    helmet: null,
    armors: [],
    armor: null,
    gemsFound: 0, // Sun Gems taken from bosses
    gemsPlaced: 0, // Sun Gems returned to the Lantern Tower
    chests: {},
    smithRescued: false,
    introSeen: false,
    helpSeen: false,
    cavesVisited: {},
    finished: false,
    kills: 0,
  };
}

export function hpParts(s) {
  const training = HP_BONUS[s.hpLevel - 1];
  const helmet = s.helmet ? HELMETS[s.helmet].hp : 0;
  return { base: BASE_HP, training, helmet, total: BASE_HP + training + helmet };
}

export function damageParts(s) {
  const training = DAMAGE_BONUS[s.damageLevel - 1];
  const weapon = WEAPONS[s.weapon].damage;
  return { base: BASE_DAMAGE, training, weapon, total: BASE_DAMAGE + training + weapon };
}

/** Share of each hit that armor stops (0..1). */
export const damageBlock = (s) => (s.armor ? ARMOR[s.armor].block : 0);

export const maxHp = (s) => hpParts(s).total;
export const totalDamage = (s) => damageParts(s).total;

const int = (v, min, max, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback);

/** Turns anything (old save, hand-edited JSON) into a valid state. */
export function sanitize(raw) {
  const s = newState();
  if (!raw || typeof raw !== 'object') return s;
  s.name = cleanName(raw.name);
  s.gold = int(raw.gold, 0, 1e9, 0);
  s.hpLevel = int(raw.hpLevel, 1, MAX_LEVEL, 1);
  s.damageLevel = int(raw.damageLevel, 1, MAX_LEVEL, 1);
  if (Array.isArray(raw.weapons)) s.weapons = [...new Set(['bamboo', ...raw.weapons.filter((id) => id in WEAPONS)])];
  s.weapon = s.weapons.includes(raw.weapon) ? raw.weapon : 'bamboo';
  if (Array.isArray(raw.helmets)) s.helmets = [...new Set(raw.helmets.filter((id) => id in HELMETS))];
  s.helmet = s.helmets.includes(raw.helmet) ? raw.helmet : null;
  if (Array.isArray(raw.armors)) s.armors = [...new Set(raw.armors.filter((id) => id in ARMOR))];
  s.armor = s.armors.includes(raw.armor) ? raw.armor : null;
  s.gemsFound = int(raw.gemsFound, 0, 3, 0);
  s.gemsPlaced = int(raw.gemsPlaced, 0, s.gemsFound, 0);
  for (const id of CHEST_IDS) if (raw.chests?.[id] === true) s.chests[id] = true;
  for (const id of CHEST_IDS) if (raw.cavesVisited?.[id] === true) s.cavesVisited[id] = true;
  s.smithRescued = raw.smithRescued === true;
  s.introSeen = raw.introSeen === true;
  s.helpSeen = raw.helpSeen === true;
  s.finished = raw.finished === true;
  s.kills = int(raw.kills, 0, 1e9, 0);
  return s;
}

export const serialize = (s) => JSON.stringify(s);

export function deserialize(text) {
  try {
    return sanitize(JSON.parse(text));
  } catch {
    return null;
  }
}

// Storage can be missing or throw (private mode, blocked cookies), so every access is guarded.
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function hasSave(store = storage()) {
  try {
    return !!store?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function loadGame(store = storage()) {
  try {
    const text = store?.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function saveGame(state, store = storage()) {
  try {
    store?.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store = storage()) {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
