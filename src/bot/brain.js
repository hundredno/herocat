// The bot's big decisions, as pure functions of the save state: what to buy, which cave to
// farm, and whether it is strong enough for a boss. Unit-tested in tests/bot.test.js.
import { ARMOR, DAMAGE_BONUS, ENEMIES, HELMETS, HP_BONUS, MAX_LEVEL, WEAPONS } from '../game/balance.js';
import { isUnlocked, upgradeCost } from '../game/economy.js';
import { damageBlock, maxHp, totalDamage } from '../game/state.js';

/** Regular monsters in each cave (from the maps in src/world/caves/). */
export const CAVE_MONSTERS = [
  ['rat', 'bat'],
  ['slime', 'spider', 'bat'],
  ['ratGuard', 'golem', 'spider', 'bat'],
];
export const CAVE_BOSSES = ['brute', 'queen', 'gnawfang'];

/** How strong the hero is in a fight: damage dealt × hits it can take. */
export const power = (dmg, hp, block) => (dmg * hp) / (1 - block);

/**
 * Every purchase on sale right now that makes the hero stronger, best value (strength gained
 * per gold) first. kind: 'train' (id 'hp' | 'damage'), 'weapon', 'helmet' or 'armor'.
 */
export function upgrades(s) {
  const dmg = totalDamage(s);
  const hp = maxHp(s);
  const block = damageBlock(s);
  const base = Math.log(power(dmg, hp, block));
  const out = [];
  const add = (kind, id, cost, d, h, b) => {
    const gain = Math.log(power(dmg + d, hp + h, block + b)) - base;
    if (gain > 1e-9) out.push({ kind, id, cost, gain, value: gain / cost });
  };
  for (const [id, key, bonus] of [
    ['hp', 'hpLevel', HP_BONUS],
    ['damage', 'damageLevel', DAMAGE_BONUS],
  ]) {
    const lvl = s[key];
    const cost = upgradeCost(lvl);
    if (cost === null) continue;
    const step = bonus[lvl] - bonus[lvl - 1];
    add('train', id, cost, id === 'damage' ? step : 0, id === 'hp' ? step : 0, 0);
  }
  const gear = [
    ['weapon', WEAPONS, 'weapons', (it) => it.damage, (v) => [v, 0, 0]],
    ['helmet', HELMETS, 'helmets', (it) => it.hp, (v) => [0, v, 0]],
    ['armor', ARMOR, 'armors', (it) => it.block, (v) => [0, 0, v]],
  ];
  for (const [kind, items, owned, stat, delta] of gear) {
    const current = s[kind] ? stat(items[s[kind]]) : 0;
    for (const [id, it] of Object.entries(items)) {
      if (it.price === null || s[owned].includes(id) || !isUnlocked(s, kind, id)) continue;
      if (stat(it) > current) add(kind, id, it.price, ...delta(stat(it) - current));
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/** What to buy right now, or null (keep saving). Buys a cheaper deal only if it's nearly as good. */
export function nextPurchase(s) {
  const list = upgrades(s);
  if (!list.length) return null;
  const best = list[0];
  if (best.cost <= s.gold) return best;
  return list.find((o) => o.cost <= s.gold && o.value >= best.value * 0.6) ?? null;
}

/** Gold to have before the next shopping trip (Infinity when there's nothing left to buy). */
export function goldGoal(s) {
  const list = upgrades(s);
  return list.length ? list[0].cost : Infinity;
}

/** Everything bought that matters: both stats at max level and the best weapon, helmet and armor. */
export function maxedOut(s) {
  return s.hpLevel >= MAX_LEVEL && s.damageLevel >= MAX_LEVEL && upgrades(s).length === 0;
}

/**
 * Rough fight model. Swings needed for the boss and its helpers, the boss's attack cycles that
 * takes, and the damage expected from the share of strikes this player fails to dodge.
 * prof: { hitsPerCycle, hitChance, addHits, risk } (see autoplay.js PROFILES).
 */
export function bossDamageEstimate(type, s, prof) {
  const b = ENEMIES[type];
  const dmg = totalDamage(s);
  const block = damageBlock(s);
  const swings = Math.ceil(b.hp / dmg);
  const cycles = swings / prof.hitsPerCycle;
  let taken = cycles * prof.hitChance * b.dmg * (1 - block);
  if (b.summon) {
    const add = ENEMIES[b.summon.type];
    const n = b.summon.at.length * b.summon.count;
    taken += n * (Math.ceil(add.hp / dmg) / prof.hitsPerCycle) * prof.hitChance * add.dmg * (1 - block) * prof.addHits;
  }
  return taken;
}

export function bossReady(type, s, prof) {
  return bossDamageEstimate(type, s, prof) <= prof.risk * maxHp(s);
}

/** Can the hero farm this cave's regular monsters without much risk? */
export function caveSafe(i, s, prof) {
  const hardest = Math.max(...CAVE_MONSTERS[i].map((t) => ENEMIES[t].dmg));
  const hits = maxHp(s) / (hardest * (1 - damageBlock(s)));
  return hits >= prof.farmHits;
}

/** Which cave to grind gold in: the deepest open one whose monsters are safe to fight. */
export function farmCave(s, prof) {
  const open = Math.min(2, s.gemsPlaced);
  for (let i = open; i > 0; i--) if (caveSafe(i, s, prof)) return i;
  return 0;
}

/** The cave whose boss is next in the story, or -1 once all three are beaten. */
export const storyCave = (s) => (s.gemsFound < 3 ? s.gemsFound : -1);
