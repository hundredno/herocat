import { describe, expect, it } from 'vitest';
import { ARMOR, WEAPONS } from '../src/game/balance.js';
import { buy, canBuy, canUpgrade, equip, grantItem, unlockedForSale, upgrade, upgradeCost } from '../src/game/economy.js';
import { damageBlock, maxHp, newState, totalDamage } from '../src/game/state.js';

describe('upgrades', () => {
  it('costs 50/100/250/500/1000/2500 to reach Lv 2..7', () => {
    expect([1, 2, 3, 4, 5, 6].map(upgradeCost)).toEqual([50, 100, 250, 500, 1000, 2500]);
    expect(upgradeCost(7)).toBeNull();
  });

  it('spends gold and raises the level', () => {
    const s = newState();
    s.gold = 160;
    expect(upgrade(s, 'hp').ok).toBe(true);
    expect(s.hpLevel).toBe(2);
    expect(s.gold).toBe(110);
    expect(upgrade(s, 'hp').ok).toBe(true);
    expect(s.hpLevel).toBe(3);
    expect(s.gold).toBe(10);
    expect(upgrade(s, 'hp')).toMatchObject({ ok: false, reason: 'gold', cost: 250 });
  });

  it('stops at level 7', () => {
    const s = newState();
    s.gold = 1e6;
    for (let i = 0; i < 10; i++) upgrade(s, 'damage');
    expect(s.damageLevel).toBe(7);
    expect(s.gold).toBe(1e6 - 4400);
    expect(canUpgrade(s, 'damage')).toMatchObject({ ok: false, reason: 'max' });
  });

  it('upgrades change HP and damage', () => {
    const s = newState();
    s.gold = 100;
    upgrade(s, 'hp');
    upgrade(s, 'damage');
    expect(maxHp(s)).toBe(15);
    expect(totalDamage(s)).toBe(8);
  });
});

describe('gear', () => {
  it('weapons cost more than they used to', () => {
    expect(WEAPONS.club.price).toBe(150);
    expect(WEAPONS.claw.price).toBe(750);
    expect(Object.keys(WEAPONS)).toHaveLength(8);
  });

  it('buys and auto-equips a stronger weapon', () => {
    const s = newState();
    s.gold = 100;
    expect(canBuy(s, 'weapon', 'club')).toMatchObject({ ok: false, reason: 'gold', cost: 150 });
    s.gold = 170;
    expect(buy(s, 'weapon', 'club').ok).toBe(true);
    expect(s.gold).toBe(20);
    expect(s.weapon).toBe('club');
    expect(totalDamage(s)).toBe(8);
    expect(canBuy(s, 'weapon', 'club').reason).toBe('owned');
  });

  it('smith items stay locked until the smith is rescued', () => {
    const s = newState();
    s.gold = 5000;
    expect(canBuy(s, 'weapon', 'claw')).toMatchObject({ reason: 'locked', hint: expect.stringMatching(/Smith Whiskers/) });
    s.smithRescued = true;
    expect(buy(s, 'weapon', 'claw').ok).toBe(true);
  });

  it('new weapons and armor unlock with story progress and monster count', () => {
    const s = newState();
    s.gold = 1e5;
    const locked = (kind, id) => canBuy(s, kind, id).reason === 'locked';
    expect(locked('weapon', 'fishbone')).toBe(true);
    expect(locked('armor', 'leather')).toBe(true);
    expect(locked('armor', 'sweater')).toBe(false);
    s.gemsFound = 1; // Big Rat Brute beaten
    expect(locked('weapon', 'fishbone')).toBe(false);
    expect(locked('armor', 'leather')).toBe(false);
    expect(locked('weapon', 'crystal')).toBe(true);
    s.gemsFound = 2; // Spider Queen beaten
    expect(locked('weapon', 'crystal')).toBe(false);
    expect(locked('armor', 'crystal')).toBe(false);
    expect(locked('weapon', 'sunfire')).toBe(true);
    s.finished = true;
    expect(locked('weapon', 'sunfire')).toBe(false);
    expect(locked('armor', 'sun')).toBe(false);

    s.kills = 23;
    expect(canBuy(s, 'weapon', 'hammer').hint).toBe('Defeat 75 monsters (23/75)');
    s.kills = 75;
    expect(locked('weapon', 'hammer')).toBe(false);
  });

  it('lists what is unlocked, so new items can be announced', () => {
    const s = newState();
    expect([...unlockedForSale(s)]).toEqual([]);
    s.gemsFound = 1;
    expect([...unlockedForSale(s)].sort()).toEqual(['armor:leather', 'weapon:fishbone']);
  });

  it('found-only items cannot be bought', () => {
    const s = newState();
    s.gold = 5000;
    expect(canBuy(s, 'weapon', 'moonsteel').reason).toBe('notForSale');
    expect(canBuy(s, 'helmet', 'leaf').reason).toBe('notForSale');
  });

  it('helmets add HP and can be swapped', () => {
    const s = newState();
    grantItem(s, 'helmet', 'leaf');
    expect(s.helmet).toBe('leaf');
    expect(maxHp(s)).toBe(13);
    grantItem(s, 'helmet', 'crown');
    expect(maxHp(s)).toBe(40);
    expect(equip(s, 'helmet', 'leaf')).toBe(true);
    expect(maxHp(s)).toBe(13);
    expect(equip(s, 'helmet', 'iron')).toBe(false);
  });

  it('armor blocks a share of each hit and the better piece is auto-equipped', () => {
    const s = newState();
    expect(damageBlock(s)).toBe(0);
    s.gold = 600;
    expect(buy(s, 'armor', 'sweater').ok).toBe(true);
    expect(s.armor).toBe('sweater');
    expect(damageBlock(s)).toBe(0.1);
    s.gemsFound = 1;
    expect(buy(s, 'armor', 'leather').ok).toBe(true);
    expect(s.armor).toBe('leather');
    expect(s.gold).toBe(600 - ARMOR.sweater.price - ARMOR.leather.price);
    expect(equip(s, 'armor', 'sweater')).toBe(true);
    expect(damageBlock(s)).toBe(0.1);
    expect(equip(s, 'armor', 'sun')).toBe(false);
  });

  it('a chest item you already own becomes gold', () => {
    const s = newState();
    s.gold = 300;
    buy(s, 'helmet', 'acorn');
    expect(grantItem(s, 'helmet', 'acorn', 150)).toEqual({ item: false, gold: 150 });
    expect(s.gold).toBe(250);
  });
});
