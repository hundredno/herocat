import { DAMAGE_BONUS, HELMETS, HP_BONUS, MAX_LEVEL, UPGRADE_COSTS, WEAPONS } from './balance.js';

export const STATS = {
  hp: { key: 'hpLevel', bonus: HP_BONUS, label: 'Health', unit: 'HP' },
  damage: { key: 'damageLevel', bonus: DAMAGE_BONUS, label: 'Damage', unit: 'DMG' },
};

const KINDS = {
  weapon: { items: WEAPONS, owned: 'weapons', equipped: 'weapon', power: (it) => it.damage },
  helmet: { items: HELMETS, owned: 'helmets', equipped: 'helmet', power: (it) => it.hp },
};

export const catalog = (kind) => KINDS[kind].items;
export const itemPower = (kind, id) => KINDS[kind].power(KINDS[kind].items[id]);

/** Gold to go from `level` to `level + 1`, or null at max level. */
export function upgradeCost(level) {
  return level >= MAX_LEVEL ? null : UPGRADE_COSTS[level - 1];
}

export function canUpgrade(s, stat) {
  const cost = upgradeCost(s[STATS[stat].key]);
  if (cost === null) return { ok: false, reason: 'max', cost };
  if (s.gold < cost) return { ok: false, reason: 'gold', cost };
  return { ok: true, cost };
}

export function upgrade(s, stat) {
  const check = canUpgrade(s, stat);
  if (!check.ok) return check;
  s.gold -= check.cost;
  s[STATS[stat].key] += 1;
  return check;
}

export function owns(s, kind, id) {
  return s[KINDS[kind].owned].includes(id);
}

export function canBuy(s, kind, id) {
  const item = KINDS[kind].items[id];
  if (owns(s, kind, id)) return { ok: false, reason: 'owned' };
  if (item.price === null) return { ok: false, reason: 'notForSale' };
  if (item.needsSmith && !s.smithRescued) return { ok: false, reason: 'locked', cost: item.price };
  if (s.gold < item.price) return { ok: false, reason: 'gold', cost: item.price };
  return { ok: true, cost: item.price };
}

function addItem(s, kind, id) {
  const k = KINDS[kind];
  s[k.owned].push(id);
  const current = s[k.equipped];
  // Auto-equip when it's stronger than what we hold.
  if (!current || k.power(k.items[id]) > k.power(k.items[current])) s[k.equipped] = id;
}

export function buy(s, kind, id) {
  const check = canBuy(s, kind, id);
  if (!check.ok) return check;
  s.gold -= check.cost;
  addItem(s, kind, id);
  return check;
}

export function equip(s, kind, id) {
  if (!owns(s, kind, id)) return false;
  s[KINDS[kind].equipped] = id;
  return true;
}

/** Chest/boss rewards. Already-owned items turn into gold instead. */
export function grantItem(s, kind, id, goldIfOwned = 0) {
  if (owns(s, kind, id)) {
    s.gold += goldIfOwned;
    return { item: false, gold: goldIfOwned };
  }
  addItem(s, kind, id);
  return { item: true, gold: 0 };
}
