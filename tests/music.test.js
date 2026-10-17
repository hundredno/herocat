import { describe, expect, it } from 'vitest';
import { SONGS, notesBetween, playNote, renderMusic } from '../src/engine/music.js';

/** Enough of the Web Audio API to build every instrument and catch values browsers reject. */
function fakeAudio() {
  const problems = [];
  const param = (name) => ({
    value: 0,
    setValueAtTime(v, t) {
      if (!Number.isFinite(v) || !(t >= 0)) problems.push(`${name}.setValueAtTime(${v}, ${t})`);
    },
    exponentialRampToValueAtTime(v, t) {
      if (!(v > 0) || !(t >= 0)) problems.push(`${name}.exponentialRamp(${v}, ${t})`);
    },
    setTargetAtTime(v, t, c) {
      if (!Number.isFinite(v) || !(t >= 0) || !(c > 0)) problems.push(`${name}.setTarget(${v}, ${t}, ${c})`);
    },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect: () => {}, disconnect: () => {}, ...extra });
  const ctx = {
    createGain: () => node({ gain: param('gain') }),
    createOscillator: () => node({ type: 'sine', frequency: param('frequency'), start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param('filter') }),
    createBufferSource: () =>
      node({
        buffer: null,
        start(t, offset) {
          if (!(t >= 0) || !(offset >= 0)) problems.push(`noise.start(${t}, ${offset})`);
        },
        stop() {},
      }),
  };
  return { ctx, problems };
}

describe('music', () => {
  it('has sane songs: notes inside the loop, playable pitches, positive lengths', () => {
    for (const [name, song] of Object.entries(SONGS)) {
      for (const part of song.parts) {
        for (const [step, midi, len] of part.notes) {
          expect(step, name).toBeGreaterThanOrEqual(0);
          expect(step, name).toBeLessThan(song.bars * 16);
          expect(len, name).toBeGreaterThan(0);
          if (!['kick', 'snare', 'hat'].includes(part.inst)) expect(midi, name).toBeGreaterThanOrEqual(24);
          expect(midi, name).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it('loops: the notes of one loop come back exactly one loop later', () => {
    const song = SONGS.cave;
    const loop = (song.bars * 16 * 60) / song.bpm / 4;
    const first = notesBetween(song, 10, 10, 10 + loop);
    const second = notesBetween(song, 10, 10 + loop, 10 + 2 * loop);
    expect(first.length).toBeGreaterThan(20);
    expect(second.map((n) => n.time - loop)).toEqual(first.map((n) => n.time).map((t) => expect.closeTo(t, 9)));
    expect(notesBetween(song, 10, 0, 10)).toEqual([]); // nothing before it starts
    const times = first.map((n) => n.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('every instrument builds with values the Web Audio API accepts', () => {
    const { ctx, problems } = fakeAudio();
    for (const song of Object.values(SONGS)) for (const n of notesBetween(song, 0.5, 0.5, 30)) playNote(ctx, ctx.createGain(), {}, n);
    renderMusic(
      ctx,
      ctx.createGain(),
      {},
      [
        { t: 0, track: 'village' },
        { t: 12, track: 'cave' },
        { t: 20, track: 'boss' },
      ],
      10,
      40,
      7,
    );
    expect(problems).toEqual([]);
  });
});
