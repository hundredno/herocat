import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/engine/navgrid.js';
import { PLAYER } from '../src/game/balance.js';
import { caveCollision, parseMap } from '../src/world/cave.js';
import { DEF as cave1 } from '../src/world/caves/cave1.js';
import { DEF as cave2 } from '../src/world/caves/cave2.js';
import { DEF as cave3 } from '../src/world/caves/cave3.js';

const find = (m, ch) => {
  const out = [];
  for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (m.at(i, j) === ch) out.push([i, j]);
  return out;
};

describe.each([cave1, cave2, cave3])('$name map', (def) => {
  const m = parseMap(def.map);

  it('has one start, exit and boss, with the exit right below the start', () => {
    const [p] = find(m, 'P');
    expect(find(m, 'P')).toHaveLength(1);
    expect(find(m, 'X')).toEqual([[p[0], p[1] + 1]]);
    expect(find(m, 'B')).toHaveLength(1);
    expect(find(m, 'C')).toHaveLength(1);
  });

  it('every floor tile is reachable from the start', () => {
    const [[si, sj]] = find(m, 'P');
    const seen = new Set([`${si},${sj}`]);
    const queue = [[si, sj]];
    while (queue.length) {
      const [i, j] = queue.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${i + di},${j + dj}`;
        if (!seen.has(k) && m.isFloor(i + di, j + dj)) {
          seen.add(k);
          queue.push([i + di, j + dj]);
        }
      }
    }
    let floors = 0;
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (m.isFloor(i, j)) floors++;
    expect(seen.size).toBe(floors);
  });

  // Tiles alone aren't enough: a rock or crystal can block a gap that looks open on the map.
  it('the hero fits past every rock and crystal to the boss, chest, smith and exit', () => {
    const { collision } = caveCollision(m);
    const nav = new NavGrid(collision, { minX: (-m.w * 2) / 2, minZ: (-m.h * 2) / 2, maxX: (m.w * 2) / 2, maxZ: (m.h * 2) / 2 }, 0.5, PLAYER.radius);
    const [[pi, pj]] = find(m, 'P');
    nav.setGoals([{ x: m.wx(pi), z: m.wz(pj) }]);
    // how close you must get: boss spawn, chest trigger, smith talk range, exit trigger
    const reach = { B: 1, C: 1.3, S: 2.2, X: 0.9 };
    for (const [ch, r] of Object.entries(reach)) {
      for (const [i, j] of find(m, ch)) {
        const x = m.wx(i);
        const z = m.wz(j);
        let ok = false;
        for (let dz = -r; dz <= r && !ok; dz += 0.25) {
          for (let dx = -r; dx <= r && !ok; dx += 0.25) {
            const k = nav.at(x + dx, z + dz);
            if (Math.hypot(dx, dz) <= r && k >= 0 && nav.dist[k] < Infinity) ok = true;
          }
        }
        expect(ok, `${def.name}: can't reach '${ch}' at row ${j}, column ${i}`).toBe(true);
      }
    }
  });

  it('is closed by walls on the border', () => {
    for (let i = 0; i < m.w; i++) expect(m.isFloor(i, 0) || m.isFloor(i, m.h - 1)).toBe(false);
    for (let j = 0; j < m.h; j++) expect(m.isFloor(0, j) || m.isFloor(m.w - 1, j)).toBe(false);
  });
});
