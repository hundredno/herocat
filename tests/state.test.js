import { describe, expect, it } from 'vitest';
import { deserialize, hasSave, loadGame, newState, saveGame, serialize } from '../src/game/state.js';

function memoryStore() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('save data', () => {
  it('round-trips', () => {
    const store = memoryStore();
    const s = newState();
    s.gold = 77;
    s.weapons.push('club');
    s.weapon = 'club';
    s.chests.cave1 = true;
    expect(hasSave(store)).toBe(false);
    saveGame(s, store);
    expect(hasSave(store)).toBe(true);
    expect(loadGame(store)).toEqual(s);
  });

  it('repairs bad or tampered saves', () => {
    const s = deserialize(JSON.stringify({ gold: -5, hpLevel: 99, weapon: 'laser', weapons: ['laser'], helmet: 'crown', gemsPlaced: 3, gemsFound: 1 }));
    expect(s.gold).toBe(0);
    expect(s.hpLevel).toBe(7);
    expect(s.weapon).toBe('bamboo');
    expect(s.weapons).toEqual(['bamboo']);
    expect(s.helmet).toBeNull();
    expect(s.gemsPlaced).toBe(1);
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(serialize(newState()))).toEqual(newState());
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(hasSave(broken)).toBe(false);
    expect(loadGame(broken)).toBeNull();
    expect(saveGame(newState(), broken)).toBe(false);
  });
});
