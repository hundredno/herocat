import { FAINT_GOLD_KEPT } from './balance.js';

const TAU = Math.PI * 2;

/** Facing angle convention: 0 looks along +z, PI/2 along +x (matches three.js rotation.y). */
export const angleTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Is a target circle inside the sword swing in front of the attacker? */
export function inAttackArc(ax, az, facing, tx, tz, targetRadius, range, halfArc) {
  const dist = Math.hypot(tx - ax, tz - az);
  if (dist > range + targetRadius) return false;
  if (dist < targetRadius + 0.3) return true; // overlapping: always hit
  return Math.abs(angleDiff(facing, angleTo(ax, az, tx, tz))) <= halfArc;
}

export function rollGold([min, max], rng = Math.random) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Splits a gold amount into up to `maxCoins` coin values that add up to the total. */
export function splitCoins(total, maxCoins = 8) {
  if (total <= 0) return [];
  const n = Math.min(maxCoins, total);
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export const goldAfterFainting = (gold) => Math.floor(gold * FAINT_GOLD_KEPT);

/** HP lost from a hit after armor. Not rounded: small bites still shrink, and the HUD shows whole hearts. */
export const damageTaken = (dmg, block) => dmg * (1 - block);

/** "2", "1.8", "4.3": damage numbers with one decimal only when armor made them fractional. */
export const formatDamage = (n) => String(Math.round(n * 10) / 10);
