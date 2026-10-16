// Background music, synthesized like the sound effects: a few short looping songs written as
// note lists and played by tiny Web Audio instruments. No files, so nothing extra to download.
// Songs: 'village' (gentle, before the village is saved), 'saved' (happy, after), 'cave' (tense),
// 'boss' (fast). The game picks one each frame; switching crossfades.

const PREF_KEY = 'herocat.music';
const MUSIC_VOL = 0.5; // the whole soundtrack, under the sound effects
const AHEAD = 0.3; // seconds of notes scheduled ahead of time

function readPref() {
  try {
    return globalThis.localStorage?.getItem(PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

function writePref(on) {
  try {
    globalThis.localStorage?.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* not remembered */
  }
}

// ---------------------------------------------------------------- songs
// Notes are [step, midi note, length in steps]; 16 steps to a bar. bar(b, …) places a bar.
const bar = (b, notes) => notes.map(([s, m, l]) => [b * 16 + s, m, l]);
const chord = (b, notes, len = 16) => notes.map((m) => [b * 16, m, len]);
const every = (b, steps, m, l) => steps.map((s) => [b * 16 + s, m, l]);
const bars = (n, fn) => Array.from({ length: n }, (_, b) => fn(b)).flat();

const AM = [57, 60, 64];
const F = [57, 60, 65];
const C = [55, 60, 64];
const G = [55, 59, 62];
const E = [56, 59, 64];

export const SONGS = {
  village: {
    bpm: 92,
    bars: 8,
    parts: [
      { inst: 'pad', vol: 0.022, notes: [AM, F, C, G, AM, F, G, E].flatMap((c, b) => chord(b, c)) },
      {
        inst: 'bass',
        vol: 0.08,
        notes: [45, 41, 48, 43, 45, 41, 43, 40].flatMap((r, b) =>
          bar(b, [
            [0, r, 6],
            [8, r, 6],
          ]),
        ),
      },
      {
        inst: 'lead',
        vol: 0.035,
        notes: [
          ...bar(0, [
            [0, 76, 4],
            [4, 72, 2],
            [6, 74, 2],
            [8, 76, 4],
            [12, 79, 4],
          ]),
          ...bar(1, [
            [0, 77, 6],
            [6, 76, 2],
            [8, 74, 4],
            [12, 72, 4],
          ]),
          ...bar(2, [
            [0, 72, 4],
            [4, 74, 2],
            [6, 76, 2],
            [8, 79, 6],
            [14, 76, 2],
          ]),
          ...bar(3, [
            [0, 74, 8],
            [8, 71, 4],
            [12, 74, 4],
          ]),
          ...bar(4, [
            [0, 72, 4],
            [4, 76, 4],
            [8, 81, 6],
            [14, 79, 2],
          ]),
          ...bar(5, [
            [0, 77, 4],
            [4, 76, 2],
            [6, 77, 2],
            [8, 81, 8],
          ]),
          ...bar(6, [
            [0, 79, 4],
            [4, 77, 2],
            [6, 76, 2],
            [8, 74, 4],
            [12, 71, 4],
          ]),
          ...bar(7, [
            [0, 76, 8],
            [8, 80, 4],
            [12, 83, 4],
          ]),
        ],
      },
      { inst: 'hat', vol: 0.008, notes: bars(8, (b) => every(b, [4, 12], 0, 1)) },
    ],
  },
  saved: {
    bpm: 112,
    bars: 8,
    parts: [
      {
        inst: 'pad',
        vol: 0.02,
        notes: [
          [60, 64, 67],
          [59, 62, 67],
          [60, 64, 69],
          [60, 65, 69],
          [60, 65, 69],
          [59, 62, 67],
          [60, 64, 67],
          [60, 64, 67],
        ].flatMap((c, b) => chord(b, c)),
      },
      {
        inst: 'bass',
        vol: 0.08,
        notes: [48, 43, 45, 41, 41, 43, 48, 48].flatMap((r, b) =>
          bar(b, [
            [0, r, 3],
            [4, r + 12, 2],
            [8, r, 3],
            [12, r + 7, 2],
          ]),
        ),
      },
      {
        inst: 'lead',
        vol: 0.035,
        notes: [
          ...bar(0, [
            [0, 72, 2],
            [2, 76, 2],
            [4, 79, 4],
            [8, 76, 2],
            [10, 79, 2],
            [12, 84, 4],
          ]),
          ...bar(1, [
            [0, 83, 4],
            [4, 79, 4],
            [8, 74, 4],
            [12, 79, 4],
          ]),
          ...bar(2, [
            [0, 81, 4],
            [4, 76, 2],
            [6, 77, 2],
            [8, 79, 6],
            [14, 76, 2],
          ]),
          ...bar(3, [
            [0, 77, 4],
            [4, 76, 4],
            [8, 74, 4],
            [12, 72, 4],
          ]),
          ...bar(4, [
            [0, 81, 4],
            [4, 77, 4],
            [8, 72, 4],
            [12, 77, 4],
          ]),
          ...bar(5, [
            [0, 79, 4],
            [4, 83, 4],
            [8, 86, 6],
            [14, 83, 2],
          ]),
          ...bar(6, [
            [0, 84, 8],
            [8, 79, 4],
            [12, 76, 4],
          ]),
          ...bar(7, [
            [0, 72, 4],
            [4, 76, 4],
            [8, 79, 4],
            [12, 84, 4],
          ]),
        ],
      },
      { inst: 'kick', vol: 0.09, notes: bars(8, (b) => every(b, [0, 8], 0, 1)) },
      { inst: 'snare', vol: 0.025, notes: bars(8, (b) => every(b, [4, 12], 0, 1)) },
      { inst: 'hat', vol: 0.01, notes: bars(8, (b) => every(b, [2, 6, 10, 14], 0, 1)) },
    ],
  },
  cave: {
    bpm: 80,
    bars: 4,
    parts: [
      { inst: 'drone', vol: 0.07, notes: [38, 38, 34, 33].flatMap((r, b) => bar(b, [[0, r, 16]])) },
      {
        inst: 'pluck',
        vol: 0.03,
        notes: [
          [62, 65, 69, 74, 69, 65, 62, 65],
          [62, 65, 69, 74, 77, 74, 69, 65],
          [58, 62, 65, 70, 65, 62, 58, 62],
          [57, 61, 64, 69, 64, 61, 57, 61],
        ].flatMap((arp, b) =>
          bar(
            b,
            arp.map((m, i) => [i * 2, m, 2]),
          ),
        ),
      },
      { inst: 'pluck', vol: 0.018, notes: bar(1, [[10, 93, 2]]) },
      { inst: 'hat', vol: 0.007, notes: bars(4, (b) => every(b, [4, 12], 0, 1)) },
    ],
  },
  boss: {
    bpm: 144,
    bars: 4,
    parts: [
      {
        inst: 'bass',
        vol: 0.085,
        notes: [40, 36, 40, 35].flatMap((r, b) =>
          bar(
            b,
            [0, 0, 12, 0, 7, 0, 10, 12].map((o, i) => [i * 2, r + o, 2]),
          ),
        ),
      },
      {
        inst: 'lead',
        vol: 0.032,
        notes: [
          ...bar(0, [
            [0, 64, 3],
            [3, 67, 3],
            [6, 71, 2],
            [8, 70, 2],
            [10, 69, 2],
            [12, 67, 4],
          ]),
          ...bar(1, [
            [0, 64, 3],
            [3, 67, 3],
            [6, 72, 2],
            [8, 71, 2],
            [10, 67, 2],
            [12, 64, 4],
          ]),
          ...bar(2, [
            [0, 76, 3],
            [3, 79, 3],
            [6, 83, 2],
            [8, 82, 2],
            [10, 81, 2],
            [12, 79, 4],
          ]),
          ...bar(3, [
            [0, 78, 3],
            [3, 75, 3],
            [6, 71, 2],
            [8, 75, 2],
            [10, 78, 2],
            [12, 83, 4],
          ]),
        ],
      },
      { inst: 'kick', vol: 0.11, notes: bars(4, (b) => every(b, [0, 4, 8, 12], 0, 1)) },
      { inst: 'snare', vol: 0.04, notes: bars(4, (b) => every(b, [4, 12], 0, 1)) },
      { inst: 'hat', vol: 0.012, notes: bars(4, (b) => every(b, [2, 6, 10, 14], 0, 1)) },
    ],
  },
};

/** Notes of a song (looping, begun at time `start`) that start in [t0, t1). Times in seconds. */
export function notesBetween(song, start, t0, t1) {
  const step = 60 / song.bpm / 4;
  const loop = song.bars * 16 * step;
  const out = [];
  const last = Math.floor((t1 - start) / loop);
  for (let k = Math.max(0, Math.floor((t0 - start) / loop)); k <= last; k++) {
    const base = start + k * loop;
    for (const part of song.parts) {
      for (const [s, midi, len] of part.notes) {
        const time = base + s * step;
        if (time >= t0 && time < t1) out.push({ time, inst: part.inst, midi, dur: len * step, vol: part.vol });
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

// ---------------------------------------------------------------- instruments

function envelope(ctx, out, t, attack, hold, release, vol) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, hold) + release);
  g.connect(out);
  return g;
}

function tone(ctx, out, type, freq, t, { attack = 0.01, hold = 0, release = 0.15, vol, lp, glide }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + attack + release);
  let node = o;
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.connect(f);
    node = f;
  }
  node.connect(envelope(ctx, out, t, attack, hold, release, vol));
  o.start(t);
  o.stop(t + Math.max(attack, hold) + release + 0.05);
}

function noise(ctx, out, buf, type, freq, t, dur, vol) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f);
  f.connect(envelope(ctx, out, t, 0.002, 0, dur, vol));
  src.start(t, (t * 7.31) % 0.5); // a different slice of noise each hit, but repeatable
  src.stop(t + dur + 0.05);
}

/** Plays one note ({ time, inst, midi, dur, vol }) on any audio context. */
export function playNote(ctx, out, noiseBuf, n) {
  const f = 440 * 2 ** ((n.midi - 69) / 12);
  const t = n.time;
  switch (n.inst) {
    case 'lead':
      return tone(ctx, out, 'square', f, t, { attack: 0.012, hold: n.dur * 0.7, release: n.dur * 0.5 + 0.05, vol: n.vol, lp: 2400 });
    case 'bass':
      return tone(ctx, out, 'triangle', f, t, { attack: 0.01, hold: n.dur * 0.6, release: 0.12, vol: n.vol, lp: 900 });
    case 'pad':
      tone(ctx, out, 'triangle', f, t, { attack: 0.35, hold: n.dur * 0.8, release: 0.6, vol: n.vol, lp: 1400 });
      return tone(ctx, out, 'sine', f * 1.004, t, { attack: 0.35, hold: n.dur * 0.8, release: 0.6, vol: n.vol * 0.7 });
    case 'drone':
      return tone(ctx, out, 'sawtooth', f, t, { attack: 0.6, hold: n.dur * 0.85, release: 0.8, vol: n.vol, lp: 380 });
    case 'pluck':
      return tone(ctx, out, 'triangle', f, t, { attack: 0.005, release: Math.min(0.6, n.dur * 1.5), vol: n.vol, lp: 3000 });
    case 'kick':
      return tone(ctx, out, 'sine', 140, t, { attack: 0.003, release: 0.16, vol: n.vol, glide: 42 });
    case 'snare':
      return noise(ctx, out, noiseBuf, 'bandpass', 1900, t, 0.12, n.vol);
    case 'hat':
      return noise(ctx, out, noiseBuf, 'highpass', 7500, t, 0.045, n.vol);
    default:
  }
}

// ---------------------------------------------------------------- player

export class Music {
  /** sound: the game's Sound (shares its audio context, master volume and noise). */
  constructor(sound) {
    this.sound = sound;
    this.enabled = readPref();
    this.want = null;
    this.current = null; // { name, start, scheduled, gain }
    this.bus = null;
    // Recording: tap({ t, track }) gets every change of song instead of it playing.
    this.tap = null;
    this.clock = null;
  }

  /** Which song should play now (null for none). Cheap to call every frame. */
  set(name) {
    if (name === this.want) return;
    this.want = name;
    this.tap?.({ t: this.clock(), track: name });
  }

  setEnabled(on) {
    this.enabled = on;
    writePref(on);
  }

  /** Call every frame: switches songs and schedules the next notes. */
  update() {
    const ctx = this.sound.ctx;
    if (this.tap || !ctx || ctx.state !== 'running' || !this.sound.master) return;
    const now = ctx.currentTime;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(this.sound.master);
    }
    const on = this.enabled && this.sound.enabled;
    if (on !== this.on) {
      this.on = on;
      this.bus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, now, 0.15);
    }
    if ((this.current?.name ?? null) !== this.want) this.switchTo(this.want, now);
    const cur = this.current;
    if (!cur) return;
    cur.scheduled = Math.max(cur.scheduled, now); // after a stall, skip ahead instead of piling notes up
    const until = now + AHEAD;
    for (const n of notesBetween(SONGS[cur.name], cur.start, cur.scheduled, until)) playNote(ctx, cur.gain, this.sound.noiseBuf, n);
    cur.scheduled = until;
  }

  switchTo(name, now) {
    const ctx = this.sound.ctx;
    if (this.current) {
      const old = this.current.gain;
      old.gain.cancelScheduledValues(now);
      old.gain.setTargetAtTime(0.0001, now, 0.3);
      setTimeout(() => old.disconnect(), 2500);
    }
    this.current = null;
    if (!name || !SONGS[name]) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.6);
    gain.connect(this.bus);
    this.current = { name, start: now + 0.05, scheduled: now + 0.05, gain };
  }
}

/**
 * Renders a song timeline ([{ t, track }], seconds) for the span [from, to) of an offline
 * context whose time 0 is `origin` seconds. Used by the video recorder.
 */
export function renderMusic(ctx, dest, noiseBuf, timeline, from, to, origin) {
  const bus = ctx.createGain();
  bus.gain.value = MUSIC_VOL;
  bus.connect(dest);
  for (let i = 0; i < timeline.length; i++) {
    const seg = timeline[i];
    const end = timeline[i + 1]?.t ?? Infinity;
    if (!SONGS[seg.track] || end <= from || seg.t >= to) continue;
    const gain = ctx.createGain();
    const t0 = Math.max(0, seg.t - origin);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1, t0 + 0.6);
    if (end < to) gain.gain.setTargetAtTime(0.0001, end - origin, 0.3);
    gain.connect(bus);
    for (const n of notesBetween(SONGS[seg.track], seg.t + 0.05, Math.max(seg.t, from - 2), Math.min(end, to))) {
      playNote(ctx, gain, noiseBuf, { ...n, time: n.time - origin });
    }
  }
}
