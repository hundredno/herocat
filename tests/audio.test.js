import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/engine/audio.js';

/** Every sound name the game code asks for, e.g. sound.play('coin') or play(x ? 'bossHit' : 'hit'). */
function soundsUsedInCode() {
  const used = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.endsWith('audio.js')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/sound\.play\(([^)]*)\)/g)) {
          for (const q of m[1].matchAll(/'(\w+)'/g)) used.add(q[1]);
        }
      }
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  return used;
}

/** Just enough of the Web Audio API to run the recipes and catch values real browsers reject. */
function fakeAudio() {
  const problems = [];
  const param = (name) => ({
    value: 0,
    setValueAtTime(v, t) {
      if (!Number.isFinite(v) || !Number.isFinite(t)) problems.push(`${name}.setValueAtTime(${v}, ${t})`);
    },
    exponentialRampToValueAtTime(v, t) {
      // real browsers throw on 0 or negative targets
      if (!(v > 0) || !Number.isFinite(t)) problems.push(`${name}.exponentialRamp(${v}, ${t})`);
    },
  });
  const node = (extra = {}) => ({ connect: () => {}, disconnect: () => {}, ...extra });
  const ctx = {
    currentTime: 1,
    state: 'running',
    createGain: () => node({ gain: param('gain') }),
    createOscillator: () => node({ type: 'sine', frequency: param('frequency'), start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param('filter'), Q: param('Q') }),
    createBufferSource: () => node({ buffer: null, start() {}, stop() {} }),
  };
  return { ctx, problems };
}

describe('sound effects', () => {
  it('every sound the game plays exists, and every sound is used', () => {
    const used = soundsUsedInCode();
    for (const name of used) expect(SOUNDS, `missing sound '${name}'`).toHaveProperty(name);
    for (const name of Object.keys(SOUNDS)) expect(used.has(name), `sound '${name}' is never played`).toBe(true);
  });

  it('every recipe builds with values the Web Audio API accepts', async () => {
    const { ctx, problems } = fakeAudio();
    // Voice isn't exported; build one the same way Sound.play does.
    const { Sound } = await import('../src/engine/audio.js');
    const fakeSound = Object.create(Sound.prototype);
    Object.assign(fakeSound, { ctx, master: { connect() {} }, noiseBuf: {}, enabled: true, last: new Map(), listener: { x: 0, z: 0 }, combo: 0, lastCoin: -1 });
    globalThis.setTimeout ??= () => {};
    for (const name of Object.keys(SOUNDS)) {
      fakeSound.last.clear();
      expect(() => fakeSound.play(name, { voice: 500, x: 3, z: 4 }), name).not.toThrow();
    }
    expect(problems).toEqual([]);
  });
});
