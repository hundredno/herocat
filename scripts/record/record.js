// Records a video of the bot playing: steps the game frame by frame on the virtual clock,
// screenshots every frame into ffmpeg, then renders the game's sounds offline and mixes them in.
//
//   node scripts/record/record.js --video youtube --seed 10
//   node scripts/record/record.js --video short --seed 7 --save recordings/youtube-seed10/saves/save-deep-dark.json
//   options: --fps 60  --skip-build  --preview (half resolution, 30 fps: quick look)  --max-minutes 90
//            --dry (no pictures or sound: just the timeline, video length and chapters, in seconds)
//            --build-dir dist-rec (build there instead of dist/, e.g. while another recording runs)
//
// Output in recordings/<video>-seed<N>/: final.mp4, chapters.txt, events.json, stats.json, saves.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { GAME_URL, SPEED_PRESETS, SpeedControl, chapterList, clock, soundsForVideo, storyBeats, videoTime } from './cuts.js';
import { grab, launch, openGame, serve } from './session.js';

const PRESETS = {
  youtube: {
    view: { width: 1280, height: 720, dpr: 2 },
    params: { autoplay: 'pro', driver: 'keys', read: 'full', goal: 'max', dpr: '2' },
    speeds: SPEED_PRESETS.youtube,
    stats: true,
    chapters: true,
    intro: ['Full game · start to max level', 'Played by an autoplay bot using the normal keyboard controls'],
    tag: '🤖 AUTOPLAY BOT',
    tail: 0.5,
    end: ['HeroCat!', 'Free in your browser · PC, tablet & phone · no download', GAME_URL],
    endSeconds: 6,
  },
  short: {
    view: { width: 540, height: 960, dpr: 2, touch: true },
    params: { autoplay: 'pro', driver: 'touch', read: 'skip', goal: 'gem3', finale: 'none', hold: '0.3', dpr: '2', zoom: '1.6' },
    speeds: SPEED_PRESETS.short,
    fromPlay: true,
    hook: ['Can a tiny cat beat the Rat King? 🐱⚔️🐀', 3.2],
    bossCaption: true,
    tag: '🤖 autoplay',
    tail: 2.2,
    end: ['HeroCat!', 'Free in your browser · no download', GAME_URL],
    endSeconds: 3.5,
  },
};

const { values: a } = parseArgs({
  options: {
    video: { type: 'string', default: 'youtube' },
    seed: { type: 'string', default: '1' },
    fps: { type: 'string', default: '60' },
    save: { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
    'build-dir': { type: 'string', default: 'dist' },
    preview: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
    'max-minutes': { type: 'string', default: '120' },
    out: { type: 'string' },
  },
});
const preset = PRESETS[a.video];
if (!preset) throw new Error(`unknown --video ${a.video}`);
const fps = a.preview ? 30 : Number(a.fps);
const view = a.preview ? { ...preset.view, dpr: 1 } : preset.view;
const params = { ...preset.params, seed: a.seed, rec: '' };
if (a.preview) params.dpr = '1';
const outDir = a.out ?? `recordings/${a.video}-seed${a.seed}${a.preview ? '-preview' : ''}`;
mkdirSync(`${outDir}/saves`, { recursive: true });
const save = a.save ? JSON.parse(readFileSync(a.save, 'utf8')) : null;

// ---------------------------------------------------------------- browser + ffmpeg
const server = await serve({ skipBuild: a['skip-build'], outDir: a['build-dir'] });
const browser = await launch();
const overlay = readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');
const { page, cdp, errors } = await openGame(browser, server.url, { view, params, save, initScripts: [overlay] });

const ff = a.dry
  ? null
  : spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(fps),
        '-c:v',
        'mjpeg',
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-preset',
        a.preview ? 'veryfast' : 'slow',
        '-crf',
        '16',
        '-profile:v',
        'high',
        '-pix_fmt',
        'yuv420p',
        '-g',
        String(fps * 2),
        `${outDir}/video.mp4`,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );

// One video frame: run `n` game frames (only the last is drawn), apply overlay commands first.
const STEP = async ({ n, cmds, dry }) => {
  for (const c of cmds) window.__overlay[c.fn](...c.args);
  const bot = window.__bot;
  window.__clock.hooks.beforeFrame = (i, k) => (bot.game.noRender = dry || i < k - 1);
  const now = (await window.__clock.advance(n)) / 1000;
  const d = bot.drain();
  return { now, events: d.events, sounds: d.sounds, songs: d.songs, intent: bot.intent, notableAt: bot.notableAt, done: bot.done, stats: bot.stats() };
};

// ---------------------------------------------------------------- capture
const frameTimes = [];
const frameSpeeds = [];
const events = [];
const sounds = [];
const songs = [];
const speedCtl = new SpeedControl(preset.speeds);
const shown = new Set();
let cmds = [];
let speed = 1;
let capturing = !preset.fromPlay;
let doneFrame = null;
let endFrames = null;
let lastStats = '';
let deepDarkSave = null;
const started = Date.now();

const chapterCard = (e, st) => {
  const first = (key) => !shown.has(key) && shown.add(key);
  const caves = { cave1: ['Chapter 1', 'The Rat Burrow'], cave2: ['Chapter 2', 'Crystal Hollow'], cave3: ['Chapter 3', 'The Deep Dark'] };
  if (e.event === 'level' && caves[e.level] && first(e.level)) return [...caves[e.level], ''];
  if (e.event === 'boss' && first(`boss:${e.type}`)) {
    const names = { brute: 'Big Rat Brute', queen: 'Spider Queen', gnawfang: 'Gnawfang the Rat King' };
    return [e.type === 'gnawfang' ? 'Final boss' : 'Boss', names[e.type], `HP Lv ${e.hpLv} · Damage Lv ${e.dmgLv}`];
  }
  if (e.event === 'finished' && first('finished')) return ['The end?', 'Whiskerwood is saved!', clock(st.playTime) + ' of play'];
  if (e.event === 'level' && shown.has('finished') && e.level !== 'village' && first('post')) return ['Post-game', 'Training to max level', 'Every weapon, helmet and armor'];
  if (e.event === 'goal' && first('goal')) return ['Max level!', 'HP Lv 7 · Damage Lv 7', 'Sunfire Blade · Sunguard Armor'];
  return null;
};

for (let k = 0; ; k++) {
  const r = await page.evaluate(STEP, { n: speed * Math.round(60 / fps), cmds, dry: a.dry });
  cmds = [];
  events.push(...r.events);
  sounds.push(...r.sounds);
  songs.push(...r.songs);
  if (errors.length) throw new Error(`page error:\n${errors.join('\n')}`);

  if (!capturing && r.stats.mode === 'play') capturing = true;
  if (capturing) {
    frameTimes.push(r.now);
    frameSpeeds.push(speed);
    if (ff) {
      const jpg = await grab(cdp, 90);
      if (!ff.stdin.write(jpg)) await once(ff.stdin, 'drain');
    }
    if (frameTimes.length === 1) {
      if (preset.intro) cmds.push({ fn: 'card', args: ['', preset.intro[0], preset.intro[1], 6, 'intro'] });
      if (preset.hook) cmds.push({ fn: 'hook', args: preset.hook });
      if (preset.tag) cmds.push({ fn: 'tag', args: [preset.tag] });
    }
  }

  for (const e of r.events) {
    if (preset.chapters) {
      const card = chapterCard(e, r.stats);
      if (card) cmds.push({ fn: 'card', args: [...card, 3.6] });
    }
    if (preset.bossCaption && e.event === 'boss' && !shown.has('bossCap')) {
      shown.add('bossCap');
      cmds.push({ fn: 'hook', args: ['FINAL BOSS!', 2.2] });
    }
    if (preset.bossCaption && e.event === 'bossDefeated' && e.type === 'gnawfang') cmds.push({ fn: 'hook', args: ['YOU WIN! 🎉', 2.4] });
    if (e.event === 'level' && e.level === 'cave3') deepDarkSave = await page.evaluate(() => window.__bot.save());
    if (e.event === 'bossDefeated' && e.type === 'gnawfang' && deepDarkSave) writeFileSync(`${outDir}/saves/save-deep-dark.json`, JSON.stringify(deepDarkSave));
    if (e.event === 'finished') writeFileSync(`${outDir}/saves/save-finished.json`, JSON.stringify(await page.evaluate(() => window.__bot.save())));
  }

  if (preset.stats && r.stats.mode !== 'title' && k % 15 === 0) {
    const st = r.stats;
    const items = [
      ['⏱', clock(st.playTime)],
      ['⚔', String(st.kills)],
      ['🪙', String(st.goldEarned)],
      ['Lv', `${st.hpLevel}/${st.damageLevel}`],
    ];
    const key = JSON.stringify(items);
    if (key !== lastStats) {
      lastStats = key;
      cmds.push({ fn: 'stats', args: [items] });
    }
  }

  if (r.done && doneFrame === null) doneFrame = frameTimes.length;
  if (doneFrame !== null && endFrames === null && frameTimes.length - doneFrame >= preset.tail * fps) {
    endFrames = frameTimes.length;
    cmds.push({ fn: 'end', args: preset.end });
  }
  if (endFrames !== null && frameTimes.length - endFrames >= preset.endSeconds * fps) break;

  const next = doneFrame !== null ? 1 : speedCtl.next(r.intent, r.now, r.notableAt, r.stats.finished);
  if (next !== speed) cmds.push({ fn: 'speed', args: [next] });
  speed = next;

  if (k % (fps * 20) === 0) {
    const v = frameTimes.length / fps;
    console.log(
      `video ${clock(v)} · game ${clock(r.now)} · ${r.stats.level} · gems ${r.stats.gemsPlaced}/3 · Lv ${r.stats.hpLevel}/${r.stats.damageLevel} · ${((Date.now() - started) / Math.max(1, frameTimes.length)).toFixed(0)} ms/frame`,
    );
  }
  if (r.now > Number(a['max-minutes']) * 60) {
    console.warn('stopping: reached --max-minutes');
    break;
  }
}
const duration = frameTimes.length / fps;
if (a.dry) {
  const beats = storyBeats(events).map((b) => ({ ...b, v: videoTime(frameTimes, fps, b.now) }));
  const faints = events.filter((e) => e.event === 'faint').length;
  const fights = events.filter((e) => e.event === 'bossDefeated').map((e) => `${e.type} ${e.time}s ${Math.ceil(e.hp)}/${e.maxHp}`);
  console.log(`seed ${a.seed}: video ${clock(duration)} · game ${clock(frameTimes.at(-1))} · faints ${faints} · ${fights.join(' · ')}`);
  console.log(chapterList(beats, 'Title', duration).join('\n'));
  writeFileSync(`${outDir}/dry.json`, JSON.stringify({ seed: a.seed, duration, events }));
  await browser.close();
  await server.close();
  process.exit(0);
}
ff.stdin.end();
await once(ff, 'close');
console.log(`captured ${frameTimes.length} frames (${clock(duration)}) in ${clock((Date.now() - started) / 1000)}`);

// ---------------------------------------------------------------- sound
const speedAt = (t) => {
  let lo = 0;
  let hi = frameTimes.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frameTimes[mid] < t) lo = mid;
    else hi = mid;
  }
  return frameSpeeds[hi] ?? 1;
};
const onVideo = soundsForVideo(sounds, frameTimes, fps, speedAt);
// Music plays at normal speed on the video's own timeline; only the song changes are mapped.
const songTimeline = [];
for (const s of songs) {
  const v = videoTime(frameTimes, fps, s.t);
  if (songTimeline.length && songTimeline.at(-1).t >= v - 1e-6) songTimeline.pop();
  if (songTimeline.at(-1)?.track !== s.track) songTimeline.push({ t: v, track: s.track });
}
const chunks = [];
for (let from = 0; from < duration; from += 30) {
  const to = Math.min(duration, from + 30);
  const part = onVideo.filter((s) => s.t >= from - 3 && s.t < to);
  const b64 = await page.evaluate(({ part, songs, from, to }) => window.__bot.renderAudio(part, songs, from, to), { part, songs: songTimeline, from, to });
  chunks.push(Buffer.from(b64, 'base64'));
}
const pcm = Buffer.concat(chunks);
const wav = Buffer.alloc(44);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + pcm.length, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(2, 22); // stereo
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(48000 * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(pcm.length, 40);
writeFileSync(`${outDir}/audio.wav`, Buffer.concat([wav, pcm]));

await browser.close();
await server.close();

const mux = spawn(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${outDir}/video.mp4`,
    '-i',
    `${outDir}/audio.wav`,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-b:a',
    '320k',
    '-ar',
    '48000',
    '-shortest',
    '-movflags',
    '+faststart',
    `${outDir}/final.mp4`,
  ],
  { stdio: 'inherit' },
);
await once(mux, 'close');

// ---------------------------------------------------------------- notes for the edit and the copy
const beats = storyBeats(events).map((b) => ({ ...b, v: videoTime(frameTimes, fps, b.now) }));
const stats = events.findLast((e) => e.event === 'done' || e.event === 'goal') ?? null;
writeFileSync(`${outDir}/events.json`, JSON.stringify(events.map((e) => ({ ...e, v: Math.round(videoTime(frameTimes, fps, e.now) * 100) / 100 }))));
writeFileSync(`${outDir}/chapters.txt`, `${chapterList(beats, 'Title', duration).join('\n')}\n`);
writeFileSync(
  `${outDir}/stats.json`,
  JSON.stringify({ seed: a.seed, video: a.video, fps, frames: frameTimes.length, duration, gameSeconds: frameTimes.at(-1), final: stats }, null, 1),
);
console.log(`done: ${outDir}/final.mp4`);
