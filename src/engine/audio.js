// Sound effects synthesized with the Web Audio API: tones and filtered noise, no audio files,
// so they add nothing to the download. Browsers only allow sound after the player taps or
// presses a key, so the AudioContext is created on the first input.

const PREF_KEY = 'herocat.sound'; // a per-device setting, kept out of the game save
const MAX_DIST = 24; // world sounds farther than this from the hero are skipped

const up = (f, semitones) => f * 2 ** (semitones / 12);
const wobble = (amount = 0.08) => 1 + (Math.random() * 2 - 1) * amount; // small pitch variety

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
    /* storage blocked: the setting just won't be remembered */
  }
}

/** Builds one sound's notes and noise bursts, all routed to that sound's output. */
class Voice {
  constructor(ctx, out, noiseBuf, t0) {
    this.ctx = ctx;
    this.out = out;
    this.noiseBuf = noiseBuf;
    this.t0 = t0;
    this.end = t0;
  }

  /** Volume envelope: quick fade in, exponential fade out. */
  env(start, dur, vol, attack) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(attack, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(this.out);
    this.end = Math.max(this.end, start + dur);
    return g;
  }

  /** An oscillator gliding from f0 to f1 Hz. lp: optional low-pass cutoff to soften it. */
  tone(type, f0, f1, at, dur, vol, { attack = 0.005, lp } = {}) {
    const { ctx } = this;
    const start = this.t0 + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    let node = osc;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      osc.connect(f);
      node = f;
    }
    node.connect(this.env(start, dur, vol, attack));
    osc.start(start);
    osc.stop(start + dur + 0.02);
    return this;
  }

  /** Filtered white noise (whooshes, thuds, sparkles) with a cutoff gliding from f0 to f1. */
  noise(type, f0, f1, at, dur, vol, { q = 1, attack = 0.003 } = {}) {
    const { ctx } = this;
    const start = this.t0 + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, start + dur);
    src.connect(f);
    f.connect(this.env(start, dur, vol, attack));
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
    return this;
  }

  /** A run of notes, `gap` seconds apart. */
  notes(type, freqs, gap, dur, vol, at = 0, opts) {
    freqs.forEach((f, i) => this.tone(type, f, f, at + i * gap, dur, vol, opts));
    return this;
  }
}

// C major-ish note frequencies (Hz) for jingles.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/**
 * Every sound in the game. vol: loudness in the mix (balanced by rendering each one and
 * measuring its peak). gap: minimum seconds between two plays (stops pile-ups when many
 * coins or monsters fire at once). play(voice, opts, sound) schedules the notes.
 */
export const SOUNDS = {
  // ---- combat
  swing: { vol: 4.5, gap: 0.05, play: (v) => v.noise('bandpass', 2400 * wobble(), 700, 0, 0.14, 0.3, { q: 1.6, attack: 0.03 }) },
  hit: {
    vol: 4,
    gap: 0.03,
    play: (v) => v.tone('triangle', 260 * wobble(), 90, 0, 0.1, 0.4).noise('lowpass', 3000, 700, 0, 0.06, 0.25),
  },
  bossHit: {
    vol: 4,
    gap: 0.03,
    play: (v) => v.tone('triangle', 150 * wobble(), 55, 0, 0.16, 0.5).noise('lowpass', 1800, 400, 0, 0.09, 0.3),
  },
  defeat: {
    vol: 6,
    gap: 0.04,
    play: (v) => v.tone('square', 480 * wobble(), 1100, 0, 0.08, 0.1, { lp: 2500 }).noise('bandpass', 1200, 250, 0.02, 0.22, 0.25, { q: 0.8 }),
  },
  bossDefeat: {
    vol: 2.3,
    play: (v) =>
      v
        .tone('sine', 180, 40, 0, 0.9, 0.6)
        .noise('lowpass', 1200, 80, 0, 0.9, 0.4)
        .notes('triangle', [G5, E5, C5], 0.12, 0.25, 0.12, 0.3),
  },
  hurt: {
    vol: 7,
    gap: 0.1,
    play: (v) => v.tone('square', 300, 110, 0, 0.22, 0.16, { lp: 1400 }).noise('lowpass', 2000, 300, 0, 0.1, 0.25),
  },
  // a monster starts its attack: a soft rising "wheep" so you know to step away
  warn: { vol: 7, gap: 0.25, play: (v) => v.tone('sine', 520, 820, 0, 0.14, 0.07) },
  warnBig: { vol: 3.5, gap: 0.25, play: (v) => v.tone('sawtooth', 140, 260, 0, 0.35, 0.12, { lp: 900, attack: 0.08 }) },
  slam: {
    vol: 3,
    gap: 0.1,
    play: (v) => v.tone('sine', 95, 32, 0, 0.5, 0.7).noise('lowpass', 700, 90, 0, 0.45, 0.45),
  },
  roar: {
    vol: 3,
    play: (v) => v.tone('sawtooth', 120, 70, 0, 0.7, 0.22, { lp: 700, attack: 0.06 }).noise('lowpass', 600, 150, 0, 0.6, 0.25, { attack: 0.06 }),
  },
  pop: {
    vol: 5,
    gap: 0.08,
    play: (v) => v.tone('sine', 280 * wobble(), 760, 0, 0.1, 0.16).noise('bandpass', 2400, 2400, 0, 0.06, 0.06, { q: 2 }),
  },
  faint: { vol: 2, play: (v) => v.notes('triangle', [392, 330, 262, 196], 0.2, 0.32, 0.22) },

  // ---- rewards
  coin: {
    vol: 4,
    gap: 0.05,
    play: (v, o, s) => {
      // quick pickups climb in pitch, like a combo
      s.combo = v.t0 - s.lastCoin < 0.4 ? Math.min(s.combo + 1, 8) : 0;
      s.lastCoin = v.t0;
      const f = up(988, s.combo);
      v.tone('square', f, f, 0, 0.06, 0.08, { lp: 4000 }).tone('square', up(f, 5), up(f, 5), 0.055, 0.14, 0.08, { lp: 4000 });
    },
  },
  chest: {
    vol: 2.4,
    play: (v) => v.tone('sawtooth', 110, 170, 0, 0.3, 0.06, { lp: 600, attack: 0.05 }).notes('sine', [G5, 987.77, 1174.66, 1567.98], 0.07, 0.3, 0.14, 0.2),
  },
  gem: {
    vol: 2,
    play: (v) => v.notes('sine', [C6, 1318.5, 1568, 2093, 2637], 0.08, 0.7, 0.12).tone('triangle', C5, C5, 0, 1.2, 0.12, { attack: 0.1 }),
  },
  gemPlaced: {
    vol: 2,
    play: (v) => {
      for (const f of [261.63, 329.63, 392, C5]) v.tone('sine', f, f, 0, 2, 0.1, { attack: 0.08 });
      v.notes('sine', [C6, 1318.5, 1568, 2093], 0.1, 0.5, 0.08, 0.3);
    },
  },
  heal: {
    vol: 4,
    play: (v) => v.tone('sine', 420, 940, 0, 0.4, 0.14, { attack: 0.05 }).notes('sine', [1318.5, 1760], 0.09, 0.25, 0.07, 0.2),
  },
  levelUp: { vol: 3, play: (v) => v.notes('square', [C5, E5, G5, C6], 0.07, 0.14, 0.08, 0, { lp: 3000 }).tone('sine', C6, C6, 0.28, 0.5, 0.14) },
  buy: {
    vol: 3.3,
    play: (v) => v.notes('square', [988, 1318.5], 0.06, 0.12, 0.07, 0, { lp: 4000 }).tone('sine', 1568, 1568, 0.14, 0.45, 0.12),
  },
  equip: { vol: 7, play: (v) => v.tone('square', 1250, 1250, 0, 0.05, 0.05).tone('square', 1320, 1320, 0.04, 0.06, 0.04).noise('highpass', 3000, 3000, 0, 0.05, 0.12) },
  unlock: { vol: 3, play: (v) => v.tone('sine', 880, 880, 0, 0.18, 0.14).tone('sine', 1320, 1320, 0.12, 0.45, 0.14) },
  fanfare: {
    vol: 2.7,
    play: (v) => {
      v.notes('square', [C5, C5, C5, E5, G5, E5], 0.12, 0.14, 0.07, 0, { lp: 3500 });
      v.tone('square', C6, C6, 0.75, 0.8, 0.08, { lp: 3500 }).tone('triangle', C5, C5, 0.75, 0.9, 0.14);
    },
  },

  // ---- interface
  click: { vol: 5, gap: 0.04, play: (v) => v.tone('triangle', 900, 700, 0, 0.04, 0.1) },
  deny: { vol: 4, gap: 0.5, play: (v) => v.tone('square', 160, 160, 0, 0.09, 0.07, { lp: 1200 }).tone('square', 120, 120, 0.11, 0.14, 0.07, { lp: 1200 }) },
  whoosh: { vol: 5, gap: 0.2, play: (v) => v.noise('bandpass', 300, 2200, 0, 0.4, 0.12, { q: 1.2, attack: 0.15 }) },
  // dialogue "voice": one tiny blip every few letters, pitched per speaker
  blip: { vol: 7, gap: 0.045, play: (v, o) => v.tone('square', (o.voice ?? 600) * wobble(0.06), (o.voice ?? 600) * wobble(0.06), 0, 0.035, 0.035, { lp: 2500 }) },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.enabled = readPref();
    this.last = new Map();
    this.listener = { x: 0, z: 0 }; // where the hero is: world sounds get quieter with distance
    this.combo = 0;
    this.lastCoin = -1;

    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else if (this.enabled) this.ctx.resume().catch(() => {});
    });
  }

  /** Creates / wakes the audio engine. Must run inside a tap or key press (browser rule). */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const ctx = this.ctx;
      // only squashes peaks when lots of sounds stack up (boss fight + coins + hits)
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 10;
      limiter.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(limiter);
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    writePref(on);
    if (on) this.unlock();
    else this.ctx?.suspend().catch(() => {});
  }

  /** opts.x/z: where it happens in the world (quieter and panned with distance from the hero). */
  play(name, opts = {}) {
    const def = SOUNDS[name];
    const ctx = this.ctx;
    if (!def || !this.enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (def.gap && now - (this.last.get(name) ?? -1) < def.gap) return;

    let vol = 1;
    let pan = 0;
    if (opts.x !== undefined) {
      const dx = opts.x - this.listener.x;
      const d = Math.hypot(dx, opts.z - this.listener.z);
      if (d > MAX_DIST) return;
      vol = Math.max(0.15, 1 - d / MAX_DIST);
      pan = Math.max(-0.7, Math.min(0.7, dx / 12));
    }
    this.last.set(name, now);

    const out = ctx.createGain();
    out.gain.value = vol * (def.vol ?? 1);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      p.connect(this.master);
    } else out.connect(this.master);
    const voice = new Voice(ctx, out, this.noiseBuf, now + 0.005);
    def.play(voice, opts, this);
    setTimeout(() => out.disconnect(), (voice.end - now + 0.3) * 1000);
  }
}
