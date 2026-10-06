import { describe, expect, it } from 'vitest';
import { angleDiff, goldAfterFainting, inAttackArc, rollGold, splitCoins } from '../src/game/combat.js';
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
