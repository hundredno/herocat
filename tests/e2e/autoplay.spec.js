import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The bot plays a fresh game on the virtual clock (faster than real time, nothing drawn) through
// the real controls: keyboard on desktop, the touch joystick and sword button on the phone.
// It must beat the Big Rat Brute and bring the 1st Sun Gem home without errors or getting stuck.
const CLOCK = readFileSync(new URL('../../scripts/record/clock.js', import.meta.url), 'utf8');

test('the autoplay bot brings the first Sun Gem home', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(CLOCK);
  await page.goto('/?autoplay=pro&seed=1&read=skip&goal=gem1&check');
  await expect.poll(() => page.evaluate(() => !!window.__bot?.ready), { intervals: [100] }).toBe(true);
  await page.evaluate(() => {
    window.__clock.hooks.beforeFrame = () => (window.__bot.game.noRender = true);
  });
  let stats = null;
  for (let i = 0; i < 40 && !stats?.done; i++) stats = await page.evaluate(() => window.__clock.advance(600).then(() => window.__bot.stats()));
  const events = await page.evaluate(() => window.__bot.drain().events);
  expect(errors).toEqual([]);
  expect(events.filter((e) => ['stuck', 'invariant'].includes(e.event))).toEqual([]);
  expect(stats).toMatchObject({ done: true, gemsPlaced: 1 });
  expect(events.some((e) => e.event === 'bossDefeated' && e.type === 'brute')).toBe(true);
});

// Recordings are planned with fast runs that draw nothing (--dry, playtests), then captured
// drawing every frame. Drawing makes three.js use random numbers too, so this checks the
// virtual clock keeps the game's luck, and so the whole run, the same either way.
test('the same seed plays the same game whether frames are drawn or not', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser is enough');
  test.setTimeout(120_000);
  const run = async (draw) => {
    const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
    await page.addInitScript(CLOCK);
    await page.goto('/?autoplay=pro&seed=4&read=skip&rec');
    await expect.poll(() => page.evaluate(() => !!window.__bot?.ready), { intervals: [100] }).toBe(true);
    const trace = [];
    for (let i = 0; i < 30; i++) {
      trace.push(
        await page.evaluate(async (d) => {
          window.__clock.hooks.beforeFrame = () => (window.__bot.game.noRender = !d);
          await window.__clock.advance(60);
          const g = window.__bot.game;
          return [g.level.id, g.player.x.toFixed(4), g.player.z.toFixed(4), g.state.gold, g.state.kills];
        }, draw),
      );
    }
    await page.close();
    return trace;
  };
  const drawn = await run(true);
  expect(drawn.at(-1)[0]).toBe('cave1'); // far enough to have fought with random gold drops
  expect(await run(false)).toEqual(drawn);
});
