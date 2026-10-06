import { describe, expect, it } from 'vitest';
import { angleDiff, damageTaken, formatDamage, goldAfterFainting, inAttackArc, rollGold, splitCoins } from '../src/game/combat.js';
import { ENEMIES } from '../src/game/balance.js';
import { maxHp, newState, totalDamage } from '../src/game/state.js';

describe('starting hero', () => {
  it('has 10 HP and deals 5 + 1 (bamboo sword) = 6 damage', () => {
    const s = newState();
    expect(maxHp(s)).toBe(10);
    expect(totalDamage(s)).toBe(6);
    expect(s.weapon).toBe('bamboo');
  });
});

describe('attack arc', () => {
  const half = (80 * Math.PI) / 180;
  it('hits enemies in front', () => {
    expect(inAttackArc(0, 0, 0, 0, 1.5, 0.4, 1.7, half)).toBe(true);
  });
  it('misses enemies behind', () => {
    expect(inAttackArc(0, 0, 0, 0, -1.5, 0.4, 1.7, half)).toBe(false);
  });
  it('misses enemies out of range', () => {
    expect(inAttackArc(0, 0, 0, 0, 3, 0.4, 1.7, half)).toBe(false);
  });
  it('always hits enemies overlapping the hero', () => {
    expect(inAttackArc(0, 0, 0, 0, -0.5, 0.4, 1.7, half)).toBe(true);
  });
  it('wraps angles', () => {
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe('gold', () => {
  it('rolls within range', () => {
    expect(rollGold([5, 8], () => 0)).toBe(5);
    expect(rollGold([5, 8], () => 0.9999)).toBe(8);
  });
  it('splits into coins that add up', () => {
    for (const total of [1, 7, 8, 9, 63, 1000]) {
      const coins = splitCoins(total);
      expect(coins.reduce((a, b) => a + b, 0)).toBe(total);
      expect(coins.length).toBeLessThanOrEqual(8);
    }
    expect(splitCoins(0)).toEqual([]);
  });
  it('fainting keeps half the gold', () => {
    expect(goldAfterFainting(101)).toBe(50);
  });
});

describe('armor', () => {
  it('blocks a share of every hit without rounding small bites away', () => {
    expect(damageTaken(2, 0)).toBe(2);
    expect(damageTaken(2, 0.1)).toBeCloseTo(1.8);
    expect(damageTaken(5, 0.15)).toBeCloseTo(4.25);
    expect(damageTaken(14, 0.5)).toBe(7);
  });
  it('shows damage with one decimal only when needed', () => {
    expect(formatDamage(2)).toBe('2');
    expect(formatDamage(damageTaken(2, 0.1))).toBe('1.8');
    expect(formatDamage(4.25)).toBe('4.3');
  });
});

describe('cave monsters', () => {
  it('rats and bats take 3 swings at the starting 6 damage, and come back after 10 s', () => {
    const swings = (type) => Math.ceil(ENEMIES[type].hp / 6);
    expect(swings('rat')).toBe(3);
    expect(swings('bat')).toBe(3);
    expect(ENEMIES.rat.dmg).toBe(2);
    expect(ENEMIES.rat.respawn).toBe(10);
    expect(ENEMIES.bat.respawn).toBe(10);
    expect(ENEMIES.spider.respawn).toBeUndefined();
  });
});
