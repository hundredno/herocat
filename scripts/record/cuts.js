// Pure editing logic for the recordings: playback speed, game time → video time, which sounds
// to keep when fast-forwarding, and the YouTube chapter list. Unit-tested in tests/record.test.js.

/** Where the game is played (end cards, descriptions). */
export const GAME_URL = 'cat.maize.live';

/** Fast-forward per bot intent (see autoplay.js), for each video. */
export const SPEED_PRESETS = {
  youtube: { story: 1, shop: 1, travel: 2, farm: 6, postgame: 14 },
  short: { story: 1, shop: 1, travel: 3, farm: 3, postgame: 3 },
};

/**
 * Picks how many game frames each video frame covers. Speeds up gently, drops back to 1× fast,
 * and holds 1× for `hold` game-seconds after anything notable (a toast, a purchase, a boss).
 */
export class SpeedControl {
  constructor(preset, { hold = 2.5, up = 0.25, down = 1.5 } = {}) {
    this.preset = preset;
    this.hold = hold;
    this.up = up;
    this.down = down;
    this.speed = 1;
  }

  /** intent: the bot's intent; now / notableAt: game seconds; postgame: the story is finished. */
  next(intent, now, notableAt, postgame = false) {
    let target = this.preset[intent] ?? 1;
    if (intent === 'farm' && postgame) target = this.preset.postgame;
    if (now - notableAt < this.hold) target = 1;
    if (target > this.speed) this.speed = Math.min(target, this.speed + this.up);
    else this.speed = Math.max(target, this.speed - this.down);
    return Math.max(1, Math.round(this.speed));
  }
}

/**
 * Game time → video time. frameTimes[k] is the game time (s) shown by video frame k (at `fps`).
 * Something that happened between frames k-1 and k lands proportionally between them.
 */
export function videoTime(frameTimes, fps, t) {
  const n = frameTimes.length;
  if (!n || t <= frameTimes[0]) return 0;
  if (t >= frameTimes[n - 1]) return (n - 1) / fps;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frameTimes[mid] < t) lo = mid;
    else hi = mid;
  }
  const span = frameTimes[hi] - frameTimes[lo];
  return (lo + (span > 0 ? (t - frameTimes[lo]) / span : 1)) / fps;
}

// While fast-forwarding, these are noise; rewards and big moments always play.
const BUSY_SOUNDS = new Set(['swing', 'warn', 'warnBig', 'hurt', 'blip', 'whoosh', 'click']);

/**
 * Moves sounds onto the video timeline. In sped-up stretches (speedAt(t) > 1) busy sounds are
 * dropped and each sound plays at most once per `gap` video-seconds, so it doesn't turn into a buzz.
 */
export function soundsForVideo(sounds, frameTimes, fps, speedAt, gap = 0.12) {
  const out = [];
  const last = new Map();
  for (const s of sounds) {
    const v = videoTime(frameTimes, fps, s.t);
    if (speedAt(s.t) > 1) {
      if (BUSY_SOUNDS.has(s.name)) continue;
      if (v - (last.get(s.name) ?? -1) < gap) continue;
    }
    last.set(s.name, v);
    out.push({ ...s, t: v });
  }
  return out;
}

export const clock = (seconds) => {
  const t = Math.max(0, Math.floor(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const CAVE_NAMES = { cave1: 'The Rat Burrow', cave2: 'Crystal Hollow', cave3: 'The Deep Dark' };
const BOSS_NAMES = { brute: 'Boss: the Big Rat Brute', queen: 'Boss: the Spider Queen', gnawfang: 'Final boss: Gnawfang the Rat King' };

/**
 * Story beats from the bot's events: the first visit to each cave, each boss fight that was won,
 * the village saved, the post-game, and max level. Each has the game time it happened (`now`).
 */
export function storyBeats(events) {
  const beats = [];
  const seen = new Set();
  const once = (key, now, title) => {
    if (seen.has(key)) return;
    seen.add(key);
    beats.push({ now, title });
  };
  const won = new Set(events.filter((e) => e.event === 'bossDefeated').map((e) => e.type));
  // the boss fight that was won is the last one started for that boss
  const lastFight = {};
  for (const e of events) if (e.event === 'boss' && e.type) lastFight[e.type] = e;
  for (const e of events) {
    if (e.event === 'level' && CAVE_NAMES[e.level]) once(e.level, e.now, CAVE_NAMES[e.level]);
    if (e.event === 'boss' && won.has(e.type) && lastFight[e.type] === e) once(`boss:${e.type}`, e.now, BOSS_NAMES[e.type]);
    if (e.event === 'finished') once('finished', e.now, 'Whiskerwood is saved!');
    if (e.event === 'goal') once('goal', e.now, 'Max level: everything bought');
  }
  const finished = beats.find((b) => b.title === 'Whiskerwood is saved!');
  if (finished) {
    const after = events.find((e) => e.now > finished.now + 1 && e.event === 'level');
    if (after) once('post', after.now, 'Post-game: training to Lv 7');
  }
  return beats.sort((a, b) => a.now - b.now);
}

/**
 * YouTube chapters: "0:00 Title" lines. YouTube needs the first at 0:00, at least three, and
 * each at least 10 s long; beats closer than that are merged into the earlier one.
 */
export function chapterList(beats, intro = 'Preview', end = Infinity, minGap = 10) {
  const out = [{ v: 0, title: intro }];
  for (const b of [...beats].sort((x, y) => x.v - y.v)) {
    if (b.v - out[out.length - 1].v >= minGap && end - b.v >= minGap) out.push(b);
  }
  return out.map((c) => `${clock(c.v)} ${c.title}`);
}
