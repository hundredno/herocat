import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/engine/collision.js';
import { NavGrid } from '../src/engine/navgrid.js';
import { guideGoals } from '../src/game/guide.js';
import { newState } from '../src/game/state.js';
import { TILE, caveCollision, parseMap } from '../src/world/cave.js';
import { DEF as cave1 } from '../src/world/caves/cave1.js';
import { DEF as cave2 } from '../src/world/caves/cave2.js';
import { DEF as cave3 } from '../src/world/caves/cave3.js';

describe('where the guide arrow points', () => {
  const village = { kind: 'village' };
  const cave = (index) => ({ kind: 'cave', index });

  it('leads through the story in the village', () => {
    const s = newState();
    expect(guideGoals(s, village)).toEqual(['cave0']);
    s.gemsFound = 1;
    expect(guideGoals(s, village)).toEqual(['tower']);
    s.gemsPlaced = 1;
    expect(guideGoals(s, village)).toEqual(['cave1']);
    s.gemsFound = s.gemsPlaced = 2;
    expect(guideGoals(s, village)).toEqual(['cave2']);
    s.gemsFound = s.gemsPlaced = 3;
    expect(guideGoals(s, village)).toEqual([]);
  });

  it('leads to the boss, then out of the cave', () => {
    const s = newState();
    expect(guideGoals(s, cave(0))).toEqual(['boss']);
    s.gemsFound = 1;
    expect(guideGoals(s, cave(0))).toEqual(['exit', 'portal']);
    s.gemsPlaced = 1;
    expect(guideGoals(s, cave(0))).toEqual(['exit', 'portal']); // replaying an old cave
    expect(guideGoals(s, cave(1))).toEqual(['boss']);
  });
});

describe('nav grid', () => {
  it('goes around a wall instead of through it', () => {
    // A wall from z=0 to z=6 at x=4..5 with the goal behind it: the way is around the bottom.
    const col = new CollisionWorld();
    col.addBox(4, -10, 5, 6);
    const nav = new NavGrid(col, { minX: 0, minZ: -10, maxX: 10, maxZ: 10 }, 1, 0.45);
    nav.setGoals([{ x: 8.5, z: -8 }]);
    expect(nav.isFree(4.5, 0)).toBe(false);
    const next = nav.next(1.5, -8);
    expect(next).not.toBeNull();
    // From the far side, it heads down toward the gap (z > 6), not straight right.
    expect(next.z).toBeGreaterThan(-8);
  });

  it('points (almost) straight at a goal across open ground', () => {
    const nav = new NavGrid(new CollisionWorld(), { minX: 0, minZ: 0, maxX: 40, maxZ: 40 }, 1, 0.45);
    for (const [gx, gz] of [[35, 3], [20, 2], [38, 30], [3, 5]]) {
      nav.setGoals([{ x: gx, z: gz }]);
      const next = nav.next(10.5, 35.5);
      const want = Math.atan2(gx - 10.5, gz - 35.5);
      const got = Math.atan2(next.x - 10.5, next.z - 35.5);
      expect(Math.abs(got - want)).toBeLessThan((12 * Math.PI) / 180);
    }
  });

  it('picks the nearer of several goals and seeds goals inside obstacles from around them', () => {
    const col = new CollisionWorld();
    col.addCircle(9, 5, 1.5); // the goal sits inside this "tower"
    const nav = new NavGrid(col, { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, 1, 0.45);
    nav.setGoals([{ x: 9, z: 5 }, { x: 0.5, z: 0.5 }]);
    expect(nav.next(1.5, 1.5).dist).toBeLessThan(3);
    expect(nav.next(6.5, 5.5).x).toBeGreaterThan(6.5);
  });
});

/** A cave's real collision (walls, rocks, crystals, …) and where its map letters are. */
function caveWalls(def) {
  const m = parseMap(def.map);
  const { collision: col } = caveCollision(m);
  const at = {};
  for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) at[m.at(i, j)] = { x: m.wx(i), z: m.wz(j) };
  const bounds = { minX: (-m.w * TILE) / 2, minZ: (-m.h * TILE) / 2, maxX: (m.w * TILE) / 2, maxZ: (m.h * TILE) / 2 };
  return { col, at, bounds };
}

describe.each([cave1, cave2, cave3])('following the arrow through $name', (def) => {
  it('walks from the entrance to the boss room without getting stuck', () => {
    const { col, at, bounds } = caveWalls(def);
    const nav = new NavGrid(col, bounds, 1, 0.45);
    nav.setGoals([at.B]);
    const hero = { x: at.P.x, z: at.P.z, radius: 0.45 };
    let steps = 0;
    while (Math.hypot(hero.x - at.B.x, hero.z - at.B.z) > 5 && steps < 3000) {
      const next = nav.next(hero.x, hero.z);
      expect(next, `no path at ${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`).not.toBeNull();
      const d = Math.hypot(next.x - hero.x, next.z - hero.z) || 1;
      hero.x += ((next.x - hero.x) / d) * 0.15;
      hero.z += ((next.z - hero.z) / d) * 0.15;
      col.resolve(hero);
      steps++;
    }
    expect(steps).toBeLessThan(3000);
  });
});
