// The bot's moment-to-moment fighting, as pure functions: notice red circles (after a human
// reaction time), step out of them, and hit back while the monster recovers.
import { PLAYER } from '../game/balance.js';

const DIRS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: Math.sin(a), z: Math.cos(a) };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** How far the sword reaches an enemy, centre to centre (a little short of the real reach). */
export const swordReach = (e) => PLAYER.attackRange + e.radius - 0.15;

/** Hero centres closer than this to a winding-up enemy get hit when its circle fills. */
export const dangerRadius = (e, margin = 0.25) => e.reach + PLAYER.radius * 0.5 + margin;

/**
 * Tracks red circles. Returns the winding-up enemies the bot has noticed: visible for at least
 * prof.reaction seconds and not among the share it misses (1 - prof.dodge).
 */
export function noticeWindups(mem, enemies, t, prof, rng) {
  const live = new Set();
  for (const e of enemies) {
    if (e.state !== 'windup') continue;
    live.add(e.id);
    if (!mem.has(e.id)) mem.set(e.id, { start: t, miss: rng() > prof.dodge });
  }
  for (const id of mem.keys()) if (!live.has(id)) mem.delete(id);
  return enemies.filter((e) => {
    const w = mem.get(e.id);
    return w && !w.miss && t - w.start >= prof.reaction;
  });
}

/** Where to stand: the nearest monster already after us, else the nearest one. Keeps its target. */
export function pickTarget(hero, enemies, current) {
  if (current) {
    const same = enemies.find((e) => e.id === current.id);
    if (same && dist(hero, same) < 10) return same;
  }
  let best = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    const busy = e.state === 'chase' || e.state === 'windup' || e.state === 'recover';
    const score = dist(hero, e) + (busy ? 0 : 3) + (e.boss ? 4 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/**
 * Best of 16 directions out of the red circles that threaten the hero: clear of every circle
 * after about the time left, not into a wall (world.overlaps), not into other monsters' reach.
 * bossZ: prefer ending up south of the boss, where the camera can see the hero.
 */
export function escapeMove(hero, threats, others, world, prof, prev = null, bossZ = null) {
  const horizon = Math.min(0.75, Math.max(...threats.map((e) => e.timer)) + 0.2);
  const reach = PLAYER.speed * horizon * 0.8;
  let best = null;
  let bestScore = -Infinity;
  for (const d of DIRS) {
    let px = hero.x;
    let pz = hero.z;
    let blocked = false;
    for (let k = 1; k <= 6; k++) {
      const nx = hero.x + (d.x * reach * k) / 6;
      const nz = hero.z + (d.z * reach * k) / 6;
      if (world.overlaps(nx, nz, PLAYER.radius * 0.9)) {
        blocked = true;
        break;
      }
      px = nx;
      pz = nz;
    }
    let safety = Infinity;
    for (const e of threats) safety = Math.min(safety, Math.hypot(px - e.x, pz - e.z) - dangerRadius(e, prof.margin));
    let score = Math.min(safety, 1.2) * 4;
    for (const o of others) if (Math.hypot(px - o.x, pz - o.z) < o.range + PLAYER.radius + 0.7) score -= 0.6;
    if (blocked) score -= 0.3;
    if (prev && d.x * prev.x + d.z * prev.z > 0.9) score += 0.25;
    if (bossZ !== null && pz > bossZ) score += 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/**
 * One frame of fighting. Returns { move: unit vector | null, attack, dodging }.
 * steer(x, z): unit vector toward a point along walkable ground (or null).
 */
export function fightStep({ hero, enemies, target, noticed, world, steer, prof, prev = null, bossZ = null }) {
  const threats = noticed.filter((e) => dist(hero, e) < dangerRadius(e, prof.margin) + 0.35);
  if (threats.length) {
    const only = threats.length === 1 ? threats[0] : null;
    // It dies before it strikes: finish it instead of running.
    if (only && only.hp <= hero.dmg && hero.cooldown <= 0.02 && dist(hero, only) <= swordReach(only) && only.timer > PLAYER.hitTime + 0.05) {
      return { move: null, attack: true, dodging: false };
    }
    const others = enemies.filter((e) => !threats.includes(e));
    return { move: escapeMove(hero, threats, others, world, prof, prev, bossZ), attack: false, dodging: true };
  }
  if (!target) return { move: null, attack: false, dodging: false };
  const d = dist(hero, target);
  // Its circle is filling and we're outside: wait for the strike, then go in while it recovers.
  if (target.state === 'windup' && noticed.includes(target) && d >= dangerRadius(target, prof.margin) - 0.1) {
    return { move: null, attack: false, dodging: false };
  }
  if (d <= swordReach(target)) return { move: null, attack: true, dodging: false };
  const dir = steer(target.x, target.z);
  if (dir) {
    // don't walk into a circle we've seen filling
    const nx = hero.x + dir.x * 0.6;
    const nz = hero.z + dir.z * 0.6;
    for (const e of noticed) if (Math.hypot(nx - e.x, nz - e.z) < dangerRadius(e, prof.margin)) return { move: null, attack: false, dodging: false };
  }
  return { move: dir, attack: d <= swordReach(target) + 0.3, dodging: false };
}
