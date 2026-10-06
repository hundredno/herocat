import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/world/cave.js';
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

  it('is closed by walls on the border', () => {
    for (let i = 0; i < m.w; i++) expect(m.isFloor(i, 0) || m.isFloor(i, m.h - 1)).toBe(false);
    for (let j = 0; j < m.h; j++) expect(m.isFloor(0, j) || m.isFloor(m.w - 1, j)).toBe(false);
  });
});
