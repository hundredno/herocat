import { describe, expect, it } from 'vitest';
import { newState } from '../src/game/state.js';
import { CAVES, SCRIPTS, SPEAKERS, fillName, isCaveUnlocked, objective, villagerLines } from '../src/game/story.js';

describe('story progression', () => {
  it('opens caves one Sun Gem at a time', () => {
    const s = newState();
    expect([0, 1, 2].map((i) => isCaveUnlocked(s, i))).toEqual([true, false, false]);
    s.gemsFound = 1;
    expect(isCaveUnlocked(s, 1)).toBe(false); // must place it first
    s.gemsPlaced = 1;
    expect([0, 1, 2].map((i) => isCaveUnlocked(s, i))).toEqual([true, true, false]);
    s.gemsFound = s.gemsPlaced = 2;
    expect(isCaveUnlocked(s, 2)).toBe(true);
  });

  it('always tells the player what to do next', () => {
    const s = newState();
    expect(objective(s)).toMatch(/Rat Burrow/);
    s.gemsFound = 1;
    expect(objective(s)).toMatch(/Lantern Tower/);
    s.gemsPlaced = 1;
    expect(objective(s)).toMatch(/Crystal Hollow/);
    s.gemsFound = s.gemsPlaced = 2;
    expect(objective(s)).toMatch(/Gnawfang/);
    s.gemsFound = s.gemsPlaced = 3;
    expect(objective(s)).toMatch(/saved/);
  });

  it('every line has a known speaker', () => {
    const lines = [];
    const walk = (v) => (Array.isArray(v) && typeof v[0] === 'string' ? lines.push(v) : Object.values(v).forEach(walk));
    walk(SCRIPTS);
    expect(lines.length).toBeGreaterThan(20);
    for (const [who] of lines) expect(SPEAKERS[who], who).toBeTruthy();
    expect(CAVES).toHaveLength(3);
  });

  it("uses the player's chosen name instead of a fixed one", () => {
    const text = JSON.stringify([SCRIPTS, SPEAKERS, [0, 1, 2, 3].map((n) => villagerLines('tom', { gemsPlaced: n }))]);
    expect(text).not.toMatch(/\bPip\b/);
    expect(text).toMatch(/\{name\}/);
    expect(fillName(SCRIPTS.prologue[4][1], 'Mochi')).toMatch(/^Mochi! /);
    expect(fillName(SPEAKERS.pip.name, 'Mochi')).toBe('Mochi');
  });
});
