import { describe, expect, it } from 'vitest';
import { cleanName, deserialize, hasSave, loadGame, newState, saveGame, serialize } from '../src/game/state.js';

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
    s.name = 'Mochi';
    s.armors.push('sweater');
    s.armor = 'sweater';
    s.helpSeen = true;
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

  it('loads saves from before names and armor existed', () => {
    const old = { v: 1, gold: 320, hpLevel: 3, weapons: ['bamboo', 'club'], weapon: 'club', helmets: ['leaf'], helmet: 'leaf', gemsFound: 1, gemsPlaced: 1, introSeen: true, kills: 40 };
    const s = deserialize(JSON.stringify(old));
    expect(s).toMatchObject({ name: 'Pip', armors: [], armor: null, helpSeen: false, gold: 320, hpLevel: 3, weapon: 'club', helmet: 'leaf', gemsPlaced: 1, kills: 40 });
  });

  it('drops armor you do not own or that does not exist', () => {
    expect(deserialize(JSON.stringify({ armors: ['sweater', 'tank'], armor: 'chain' }))).toMatchObject({ armors: ['sweater'], armor: null });
  });

  it('cleans up the hero name', () => {
    expect(cleanName('  Mochi  ')).toBe('Mochi');
    expect(cleanName('Sir   Fluff')).toBe('Sir Fluff');
    expect(cleanName('')).toBe('Pip');
    expect(cleanName('   ')).toBe('Pip');
    expect(cleanName(undefined)).toBe('Pip');
    expect(cleanName(42)).toBe('Pip');
    expect(cleanName('Abcdefghijklmnop')).toBe('Abcdefghijkl');
    expect(cleanName('🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱')).toBe('🐱'.repeat(12));
    expect(cleanName('Ti\u0000ger\u202e')).toBe('Tiger');
    expect(cleanName('<b>Tom</b>')).toBe('<b>Tom</b>'); // kept as text; escaped when shown
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(hasSave(broken)).toBe(false);
    expect(loadGame(broken)).toBeNull();
    expect(saveGame(newState(), broken)).toBe(false);
  });
});
