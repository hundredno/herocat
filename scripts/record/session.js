// Shared plumbing for the bot scripts: build + serve the game, launch Chrome with the virtual
// clock, open /?autoplay…, and talk to the bot running in the page.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const CLOCK = readFileSync(new URL('./clock.js', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Builds the production bundle (unless skipped) and serves it on a free port. outDir: build
 * somewhere other than dist/ (so a long recording can keep running while another one builds).
 */
export async function serve({ skipBuild = false, port = 4180, outDir = 'dist' } = {}) {
  if (!skipBuild) await build({ logLevel: 'warn', build: { outDir } });
  const server = await preview({ logLevel: 'warn', build: { outDir }, preview: { port, strictPort: false, host: '127.0.0.1' } });
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.close() };
}

// Headless Chrome on the real GPU when it can get one; SwiftShader otherwise.
const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'];

export async function launch({ gpuArgs = GPU_ARGS, headless = true } = {}) {
  return chromium.launch({
    channel: 'chrome',
    headless,
    args: [...gpuArgs, '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
}

/**
 * Opens the game with the bot. view: { width, height, dpr, touch }. params: URL params
 * (autoplay=profile, seed, driver, read, goal, rec, check…). save: a save to start from.
 * initScripts: more browser scripts to run before the page's own (e.g. the recording overlay).
 */
export async function openGame(browser, baseUrl, { view = { width: 1280, height: 720, dpr: 1 }, params = {}, save = null, initScripts = [] } = {}) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.dpr ?? 1,
    hasTouch: !!view.touch,
    isMobile: !!view.touch,
  });
  await context.addInitScript(CLOCK);
  for (const script of initScripts) await context.addInitScript(script);
  await context.addInitScript(
    ({ save }) => {
      try {
        localStorage.clear();
        localStorage.setItem('herocat.sound', '1');
        if (save) localStorage.setItem('herocat.save.v1', JSON.stringify(save));
      } catch {
        /* ignore */
      }
    },
    { save },
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${baseUrl}?${new URLSearchParams({ autoplay: 'pro', ...params })}`);
  // Can't use waitForFunction: its polling relies on page timers, which are virtual now.
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(() => !!window.__bot?.ready)) break;
    if (errors.length) throw new Error(`page error while loading:\n${errors.join('\n')}`);
    await sleep(50);
  }
  const cdp = await context.newCDPSession(page);
  // Emulation is per CDP session: without this, screenshots from this session come out at
  // CSS-pixel size instead of device pixels (1280×720 instead of 2560×1440 at dpr 2).
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: view.dpr ?? 1, mobile: !!view.touch });
  return { context, page, cdp, errors };
}

/** Full-page screenshot as a JPEG buffer (CDP is faster than page.screenshot). */
export async function grab(cdp, quality = 92) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

export const advance = (page, n) => page.evaluate((k) => window.__clock.advance(k), n);

/** Runs frames until the bot is done (or a limit), without drawing. onBatch(stats, drained) after each batch. */
export async function runTurbo(page, { maxMinutes = 120, batch = 900, onBatch } = {}) {
  await page.evaluate(() => {
    window.__clock.hooks.beforeFrame = () => (window.__bot.game.noRender = true);
  });
  const all = { events: [], sounds: [] };
  for (;;) {
    await advance(page, batch);
    const [stats, drained] = await page.evaluate(() => [window.__bot.stats(), window.__bot.drain()]);
    all.events.push(...drained.events);
    all.sounds.push(...drained.sounds);
    onBatch?.(stats, drained);
    if (stats.done || stats.t > maxMinutes * 60) return { stats, ...all };
  }
}
