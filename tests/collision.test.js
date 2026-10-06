import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/engine/collision.js';

describe('collision', () => {
  it('pushes a circle out of a box', () => {
    const w = new CollisionWorld();
    w.addBox(0, 0, 2, 2);
    const e = { x: -0.2, z: 1, radius: 0.5 };
    expect(w.resolve(e)).toBe(true);
    expect(e.x).toBeCloseTo(-0.5);
    expect(e.z).toBeCloseTo(1);
  });

  it('pushes a circle whose center is inside a box out the nearest side', () => {
    const w = new CollisionWorld();
    w.addBox(0, 0, 10, 10);
    const e = { x: 9.5, z: 5, radius: 0.5 };
    w.resolve(e);
    expect(e.x).toBeCloseTo(10.5);
  });

  it('pushes circles apart and ignores disabled shapes', () => {
    const w = new CollisionWorld();
    const c = w.addCircle(0, 0, 1);
    const e = { x: 1, z: 0, radius: 0.5 };
    w.resolve(e);
    expect(e.x).toBeCloseTo(1.5);
    c.enabled = false;
    const f = { x: 0.2, z: 0, radius: 0.5 };
    expect(w.resolve(f)).toBe(false);
  });

  it('handles shapes spanning many cells and negative coordinates', () => {
    const w = new CollisionWorld(2);
    w.addBox(-20, -1, 20, 1);
    const e = { x: -13.3, z: 1.2, radius: 0.5 };
    w.resolve(e);
    expect(e.z).toBeCloseTo(1.5);
  });
});
