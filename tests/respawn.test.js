import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/game/balance.js';
import { Respawns } from '../src/game/respawn.js';

const enemy = (type, spawn) => ({ def: ENEMIES[type], spawn });

describe('respawning', () => {
  it('brings a rat back to its spawn point after 10 s of game time', () => {
    const r = new Respawns();
    const sp = { type: 'rat', x: 3, z: 4 };
    const back = [];
    expect(r.add(enemy('rat', sp))).toBe(true);
    for (let i = 0; i < 299; i++) r.update(1 / 30, (p) => back.push(p));
    expect(back).toEqual([]);
    r.update(1 / 30, (p) => back.push(p));
    expect(back).toEqual([sp]);
    r.update(20, (p) => back.push(p));
    expect(back).toHaveLength(1);
  });

  it('never brings back summoned helpers or monsters without a respawn time', () => {
    const r = new Respawns();
    expect(r.add(enemy('ratGuard', null))).toBe(false);
    expect(r.add(enemy('bat', null))).toBe(false);
    expect(r.add(enemy('spider', { type: 'spider', x: 0, z: 0 }))).toBe(false);
    expect(r.queue).toHaveLength(0);
  });

  it('forgets pending respawns when you leave the cave', () => {
    const r = new Respawns();
    r.add(enemy('bat', { type: 'bat', x: 0, z: 0 }));
    r.clear();
    let n = 0;
    r.update(60, () => n++);
    expect(n).toBe(0);
  });
});
