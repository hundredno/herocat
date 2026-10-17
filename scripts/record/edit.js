// Turns a finished capture into the videos that get posted:
//   youtube   cold open (a slice of the final boss fight) + the full run, and chapters for the description
//   x         a ~50 s highlight cut at 1920×1080 with big captions (X autoplays without sound)
//   thumbnail a 1280×720 YouTube thumbnail made from a boss-fight frame
//
//   node scripts/record/edit.js youtube   --from recordings/youtube-seed10
//   node scripts/record/edit.js x         --from recordings/youtube-seed10
//   node scripts/record/edit.js thumbnail --from recordings/youtube-seed10
// Captions and text are drawn by Chrome (same font as the game) and laid over with ffmpeg.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { chapterList, clock, storyBeats } from './cuts.js';

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: 'string', default: 'recordings/youtube-seed10' },
    out: { type: 'string', default: 'recordings/final' },
    // thumbnail: seconds into the Gnawfang fight, the point of the frame (fractions) to centre on the right half, and zoom
    at: { type: 'string', default: '31.5' },
    focus: { type: 'string', default: '0.377,0.41' },
    zoom: { type: 'string', default: '2.1' },
  },
});
const what = positionals[0] ?? 'youtube';
const src = `${a.from}/final.mp4`;
const events = JSON.parse(readFileSync(`${a.from}/events.json`, 'utf8'));
const stats = JSON.parse(readFileSync(`${a.from}/stats.json`, 'utf8'));
mkdirSync(`${a.out}/cards`, { recursive: true });

const find = (pred) => events.find(pred);
const last = (pred) => events.findLast(pred);
const bossFight = (type) => last((e) => e.event === 'boss' && e.type === type);

async function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  const [code] = await once(p, 'close');
  if (code) throw new Error(`ffmpeg failed (${code})`);
}

/** ffmpeg input options for `len` seconds of the capture from `at` (frame-accurate: it decodes from the keyframe before). */
const slice = (at, len) => ['-ss', at.toFixed(3), '-t', String(len), '-i', src];

/** H.264 encoder options for the long YouTube re-encode: NVENC when this machine has it (minutes), else x264 (much slower). */
async function h264Encoder() {
  const probe = spawn('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=s=256x256', '-frames:v', '1', '-c:v', 'h264_nvenc', '-f', 'null', '-'], { stdio: 'ignore' });
  const [code] = await once(probe, 'close');
  if (code === 0) return ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '18', '-b:v', '0'];
  console.log('no NVENC here: encoding with x264, which takes a while');
  return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
}

const FONT = `ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, sans-serif`;

/** Renders HTML text to transparent PNGs, one per { name, html }, at width × height. */
async function cards(list, width, height) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  for (const c of list) {
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;background:transparent;font-family:${FONT};color:#fff">${c.html}</body></html>`,
    );
    await page.screenshot({ path: `${a.out}/cards/${c.name}.png`, omitBackground: true });
  }
  await browser.close();
}

const caption = (text, top = 74) => `<div style="position:absolute;left:0;right:0;top:${top}%;text-align:center">
  <span style="display:inline-block;padding:14px 34px 18px;border-radius:24px;background:rgba(29,23,51,.78);font-size:58px;font-weight:900;
  letter-spacing:-.01em;box-shadow:0 10px 30px rgba(0,0,0,.35)">${text}</span></div>`;

// ---------------------------------------------------------------- YouTube: cold open + full run
async function youtube() {
  const g = bossFight('gnawfang');
  const start = g.v + 14;
  const len = 11;
  await cards(
    [
      {
        name: 'coming-up',
        // bottom centre: the HUD has the HP bar and objective top left, the boss bar top centre
        html: `<div style="position:absolute;left:0;right:0;top:1150px;text-align:center"><span style="display:inline-block;padding:18px 40px 22px;border-radius:26px;
          background:rgba(29,23,51,.8);font-size:60px;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.35)">Coming up: <span style="color:#ffd35c">the Rat King</span></span></div>`,
      },
    ],
    2560,
    1440,
  );
  const out = `${a.out}/herocat-youtube-full-playthrough.mp4`;
  // Each piece is its own seeked input: feeding one input to several branches makes ffmpeg hold
  // every decoded frame between them in memory.
  await ffmpeg([
    ...slice(start, len),
    '-i',
    src,
    '-i',
    `${a.out}/cards/coming-up.png`,
    '-filter_complex',
    [
      `[0:v][2:v]overlay=0:0,fade=t=in:st=0:d=0.4,fade=t=out:st=${len - 0.5}:d=0.5[cv]`,
      `[0:a]afade=t=in:st=0:d=0.3,afade=t=out:st=${len - 0.6}:d=0.6[ca]`,
      `[cv][ca][1:v][1:a]concat=n=2:v=1:a=1[v][a]`,
    ].join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    ...(await h264Encoder()),
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '320k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    out,
  ]);
  const beats = storyBeats(events).map((b) => ({ ...b, v: events.find((e) => e.now === b.now)?.v ?? 0 }));
  const shifted = beats.map((b) => ({ ...b, v: b.v + len }));
  shifted.unshift({ v: len, title: 'New game: a cat named Pip' });
  const chapters = chapterList(shifted, 'Preview: the Rat King', stats.duration + len);
  writeFileSync(`${a.out}/youtube-chapters.txt`, `${chapters.join('\n')}\n`);
  console.log(`${out}\n${chapters.join('\n')}`);
}

// ---------------------------------------------------------------- X: ~50 s highlights, captions for muted autoplay
async function x() {
  const v = (pred, offset = 0) => {
    const e = typeof pred === 'function' ? find(pred) : pred;
    if (!e) throw new Error('missing event for the X cut');
    return e.v + offset;
  };
  const brute = bossFight('brute');
  const gnaw = bossFight('gnawfang');
  const won = (type) => find((e) => e.event === 'bossDefeated' && e.type === type);
  const firstBuy = find((e) => (e.event === 'train' || e.event === 'gear') && e.v > brute.v + 5);
  const gem3 = find((e) => e.event === 'gemPlaced' && e.n === 3);
  const post = find((e) => e.event === 'level' && e.v > gem3.v + 20 && e.level !== 'village');
  const goal = find((e) => e.event === 'goal');
  // Boss clips end just after the win (bosses talk for the first seconds of a fight). Captions sit
  // low (74%) unless a dialogue box or panel is there; then at the top, clear of the HUD's corners.
  const segs = [
    { at: v(gnaw, 16), len: 3.5, text: 'A tiny cat vs. the Rat King', top: 40 },
    { at: 1.5, len: 4, text: 'A free 3D game in your browser', top: 3 },
    { at: v((e) => e.event === 'level' && e.level === 'cave1', 9), len: 4, text: 'Beat monsters, collect gold' },
    { at: v(won('brute'), -4.5), len: 5, text: 'Boss 1: the Big Rat Brute' },
    { at: v(firstBuy, -1.5), len: 4, text: "Spend it at Biscuit's shop", top: 3 },
    { at: v(won('queen'), -4.5), len: 5, text: 'Boss 2: the Spider Queen' },
    { at: v(won('gnawfang'), -7.5), len: 8, text: 'Final boss: Gnawfang' },
    { at: v(gem3, 0.3), len: 4.5, text: 'Whiskerwood is saved!', top: 3 },
    { at: v(post, 25), len: 4, text: '…then all the way to max level' },
    { at: v(goal, 4), len: 4, text: 'Lv 7 · every weapon and armor' },
    { at: stats.duration - 4, len: 4, text: '' },
  ];
  await cards(
    segs.map((s, i) => ({ name: `x${i}`, html: s.text ? caption(s.text, s.top) : '' })),
    1920,
    1080,
  );
  const n = segs.length;
  const inputs = [...segs.flatMap((s) => slice(s.at, s.len)), ...segs.flatMap((_, i) => ['-i', `${a.out}/cards/x${i}.png`])];
  const parts = [];
  segs.forEach((s, i) => {
    parts.push(`[${i}:v]scale=1920:1080:flags=lanczos[s${i}]`);
    parts.push(`[s${i}][${n + i}:v]overlay=0:0[v${i}]`);
    parts.push(`[${i}:a]afade=t=in:st=0:d=0.06,afade=t=out:st=${s.len - 0.08}:d=0.08[a${i}]`);
  });
  parts.push(`${segs.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${segs.length}:v=1:a=1[v][a]`);
  const out = `${a.out}/herocat-x.mp4`;
  await ffmpeg([
    ...inputs,
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-maxrate',
    '12M',
    '-bufsize',
    '24M',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '60',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    out,
  ]);
  const total = segs.reduce((t, s) => t + s.len, 0);
  console.log(`${out} (${clock(total)})`);
}

// ---------------------------------------------------------------- thumbnail
async function thumbnail() {
  const g = bossFight('gnawfang');
  const frame = `${a.out}/cards/thumb-frame.png`;
  await ffmpeg(['-ss', String(g.v + Number(a.at)), '-i', src, '-frames:v', '1', frame]);
  const img = readFileSync(frame).toString('base64');
  // place the frame so its focus point lands at (64%, 52%) of the thumbnail, clear of the text
  const [fx, fy] = a.focus.split(',').map(Number);
  const z = Number(a.zoom);
  const left = Math.round(0.64 * 1280 - fx * 1280 * z);
  const top = Math.round(0.52 * 720 - fy * 720 * z);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const stroke = 'paint-order:stroke fill;-webkit-text-stroke:8px #2a1400';
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:720px;overflow:hidden;font-family:${FONT}">
    <img src="data:image/png;base64,${img}" style="position:absolute;left:${left}px;top:${top}px;width:${1280 * z}px">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,10,40,.85) 0%,rgba(20,10,40,.35) 46%,rgba(0,0,0,0) 70%)"></div>
    <div style="position:absolute;left:44px;top:40px;font-size:118px;line-height:.95;font-weight:900;color:#ffd35c;${stroke};text-shadow:0 8px 0 #c45f00,0 14px 30px rgba(0,0,0,.5)">HeroCat!</div>
    <div style="position:absolute;left:48px;top:190px;font-size:82px;line-height:1.02;font-weight:900;color:#fff;${stroke}">TINY CAT<br>vs.<br>RAT KING</div>
    <div style="position:absolute;left:48px;bottom:40px;padding:12px 24px;border-radius:18px;background:#ffd35c;color:#2a2342;font-size:40px;font-weight:900">FULL GAME · MAX LEVEL</div>
  </body></html>`);
  const out = `${a.out}/herocat-youtube-thumbnail.jpg`;
  await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
  await browser.close();
  console.log(out);
}

if (what === 'youtube') await youtube();
else if (what === 'x') await x();
else if (what === 'thumbnail') await thumbnail();
else throw new Error(`unknown: ${what} (youtube | x | thumbnail)`);
