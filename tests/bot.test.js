import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/bot/autoplay.js';
import { CAVE_MONSTERS, bossReady, farmCave, goldGoal, maxedOut, nextPurchase, storyCave, upgrades } from '../src/bot/brain.js';
import { dangerRadius, escapeMove, fightStep, noticeWindups, swordReach } from '../src/bot/fight.js';
import { CollisionWorld } from '../src/engine/collision.js';
import { ENEMIES } from '../src/game/balance.js';
import { newState } from '../src/game/state.js';
import { DEF as CAVE1 } from '../src/world/caves/cave1.js';
import { DEF as CAVE2 } from '../src/world/caves/cave2.js';
import { DEF as CAVE3 } from '../src/world/caves/cave3.js';

const pro = PROFILES.pro;
const state = (over = {}) => ({ ...newState(), ...over });

describe('bot: what to buy', () => {
  it('starts by training HP, the best value for the first 50 gold', () => {
    const s = state();
    expect(upgrades(s)[0]).toMatchObject({ kind: 'train', id: 'hp', cost: 50 });
    expect(nextPurchase(s)).toBeNull(); // no gold yet: keep saving
    expect(goldGoal(s)).toBe(50);
    expect(nextPurchase(state({ gold: 60 }))).toMatchObject({ kind: 'train', id: 'hp' });
  });

  it('never offers locked, owned or weaker gear', () => {
    const s = state({ gold: 9999, weapons: ['bamboo', 'moonsteel'], weapon: 'moonsteel' });
    const ids = upgrades(s).map((u) => u.id);
    expect(ids).not.toContain('club'); // weaker than Moonsteel
    expect(ids).not.toContain('sunfire'); // locked until Whiskerwood is saved
    expect(ids).not.toContain('moonsteel'); // owned, and never sold
  });

  it('is maxed out with both stats at Lv 7 and the best gear', () => {
    const top = { hpLevel: 7, damageLevel: 7, finished: true, gemsFound: 3, gemsPlaced: 3, smithRescued: true, kills: 100 };
    const gear = { weapons: ['bamboo', 'sunfire'], weapon: 'sunfire', helmets: ['crown'], helmet: 'crown', armors: ['sun'], armor: 'sun' };
    expect(maxedOut(state({ ...top, ...gear }))).toBe(true);
    expect(maxedOut(state({ ...top, ...gear, armors: ['crystal'], armor: 'crystal' }))).toBe(false);
  });
});

describe('bot: when to fight bosses and where to farm', () => {
  it('takes on the Big Rat Brute right away but not Gnawfang', () => {
    expect(bossReady('brute', state(), pro)).toBe(true);
    expect(bossReady('gnawfang', state(), pro)).toBe(false);
    const strong = state({
      hpLevel: 5,
      damageLevel: 5,
      weapons: ['bamboo', 'moonsteel'],
      weapon: 'moonsteel',
      helmets: ['iron'],
      helmet: 'iron',
      armors: ['chain'],
      armor: 'chain',
    });
    expect(bossReady('gnawfang', strong, pro)).toBe(true);
  });

  it('farms the deepest open cave it can handle', () => {
    expect(farmCave(state(), pro)).toBe(0);
    expect(farmCave(state({ gemsFound: 2, gemsPlaced: 2 }), pro)).toBe(0); // too weak for spiders and golems
    expect(farmCave(state({ gemsFound: 3, gemsPlaced: 3, hpLevel: 6, armors: ['chain'], armor: 'chain' }), pro)).toBe(2);
    expect(storyCave(state({ gemsFound: 1 }))).toBe(1);
    expect(storyCave(state({ gemsFound: 3 }))).toBe(-1);
  });

  it('knows which monsters live in each cave (matches the maps)', () => {
    const KEYS = { r: 'rat', b: 'bat', s: 'slime', p: 'spider', g: 'golem', G: 'ratGuard' };
    [CAVE1, CAVE2, CAVE3].forEach((def, i) => {
      const found = new Set([...def.map].filter((c) => KEYS[c]).map((c) => KEYS[c]));
      expect([...found].sort()).toEqual([...CAVE_MONSTERS[i]].sort());
    });
  });
});

describe('bot: fighting', () => {
  const hero = { x: 0, z: 0, dmg: 6, cooldown: 0 };
  const rat = (over) => ({ id: 1, type: 'rat', ...ENEMIES.rat, hp: 18, state: 'chase', timer: 0, ...over });
  const open = new CollisionWorld(4);

  it('notices a red circle only after its reaction time', () => {
    const mem = new Map();
    const e = rat({ state: 'windup', timer: 0.5 });
    expect(noticeWindups(mem, [e], 10, pro, () => 0)).toEqual([]);
    expect(noticeWindups(mem, [e], 10 + pro.reaction + 0.01, pro, () => 0)).toEqual([e]);
    expect(noticeWindups(mem, [{ ...e, state: 'recover' }], 11, pro, () => 0)).toEqual([]);
    expect(mem.size).toBe(0);
  });

  it('steps out of a filling circle, and not into a wall', () => {
    const e = rat({ x: 1.2, z: 0, state: 'windup', timer: 0.35 });
    const dir = escapeMove(hero, [e], [], open, pro);
    const reach = 5.2 * 0.55 * 0.8;
    expect(Math.hypot(dir.x * reach - e.x, dir.z * reach - e.z)).toBeGreaterThan(dangerRadius(e, pro.margin));
    // a wall right behind the hero: it has to go sideways
    const walled = new CollisionWorld(4);
    walled.addBox(-6, -6, -0.7, 6);
    const side = escapeMove(hero, [e], [], walled, pro);
    expect(Math.abs(side.z)).toBeGreaterThan(Math.abs(side.x));
  });

  it('hits while the monster recovers, waits outside its circle while it winds up', () => {
    const steer = () => ({ x: 1, z: 0 });
    const near = rat({ x: swordReach(rat()) - 0.2, z: 0, state: 'recover' });
    expect(fightStep({ hero, enemies: [near], target: near, noticed: [], world: open, steer, prof: pro })).toMatchObject({ attack: true });
    const winding = rat({ x: dangerRadius(rat(), pro.margin) + 0.5, z: 0, state: 'windup', timer: 0.3 });
    expect(fightStep({ hero, enemies: [winding], target: winding, noticed: [winding], world: open, steer, prof: pro })).toMatchObject({ move: null, attack: false });
  });

  it('finishes off a monster that will fall before it strikes', () => {
    const weak = rat({ x: 1.4, z: 0, state: 'windup', timer: 0.4, hp: 5 });
    const r = fightStep({ hero, enemies: [weak], target: weak, noticed: [weak], world: open, steer: () => null, prof: pro });
    expect(r).toMatchObject({ attack: true, dodging: false });
  });
});
