import { expect, test } from '@playwright/test';

test('title is interactive fast and shows the version', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await expect(page.locator('#btn-new')).toBeVisible();
  await expect(page.locator('#title')).toHaveClass(/ready/, { timeout: 4000 });
  expect(Date.now() - start).toBeLessThan(4000);
  await expect(page.locator('#version')).toHaveText(/^v\.([0-9a-f]{4}|dev)$/);
});

test('a new game asks for a name, shows how to play, and starts with 10 HP and 6 damage', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#title')).toHaveClass(/ready/);
  await page.locator('#btn-new').click();

  // choose a name (prefilled with Pip)
  const name = page.locator('#hero-name');
  await expect(name).toBeVisible();
  await expect(name).toHaveValue('Pip');
  await name.fill('  Mochi  ');
  await page.locator('#btn-start').click();

  // the prologue tells the story with the chosen name; skip it
  const dialogue = page.locator('.dialogue');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText(/Whiskerwood/);
  await page.locator('.dlg-skip').click();
  await expect(dialogue).toBeHidden();

  // then every control is shown before you can move
  const panel = page.locator('.panel');
  await expect(panel).toContainText('How to play');
  await expect(panel.locator('.controls tr')).toHaveCount(6);
  await expect(panel).toContainText('golden arrow');
  await panel.getByRole('button', { name: "Let's go!" }).click();
  await expect(page.locator('.panel-wrap')).toBeHidden();

  await expect(page.locator('.hp-text')).toHaveText('10 / 10');
  await expect(page.locator('.dmg')).toHaveText('6');
  await expect(page.locator('.block')).toHaveText('0%');
  await expect(page.locator('.gold')).toHaveText('0');
  await expect(page.locator('.obj-text')).toContainText('Rat Burrow');

  // the hero panel uses the name and explains where the 6 comes from
  await page.locator('.hud-btn[data-b="bag"]').click();
  await expect(panel.locator('h2')).toHaveText(/Mochi the HeroCat/);
  await expect(panel).toContainText('5 base + 0 training (Lv 1) + 1 Bamboo Sword');
  await expect(panel).toContainText('Blocks 0% of every hit');

  // rename from the hero panel
  await panel.getByRole('button', { name: 'Change name' }).click();
  await panel.locator('input[name="hero-name"]').fill('Captain <b>Paws');
  await panel.locator('input[name="hero-name"]').press('Enter');
  await expect(panel.locator('h2')).toHaveText(/^Captain <b>P the HeroCat/) // 12 characters max, and the tag shows as text;
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-wrap')).toBeHidden();

  // progress is saved, so reloading offers Continue, and the help isn't shown again
  await page.reload();
  await expect(page.locator('#title')).toHaveClass(/ready/);
  await page.locator('#btn-continue').click();
  await expect(page.locator('.hp-text')).toHaveText('10 / 10');
  await page.waitForTimeout(800);
  await expect(page.locator('.panel-wrap')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the shop has tabs, armor, and locked weapons that say how to unlock them', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toHaveClass(/ready/);
  await page.evaluate(() => {
    localStorage.setItem('herocat.save.v1', JSON.stringify({ v: 1, gold: 500, introSeen: true, helpSeen: true }));
  });
  await page.reload();
  await expect(page.locator('#title')).toHaveClass(/ready/);
  await page.locator('#btn-continue').click();
  await expect(page.locator('.hp-text')).toHaveText('10 / 10');

  // walk from the fountain to Biscuit's stall: a step south (clear of the lamp post), then east
  const action = page.locator('.action-btn');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD');
  await expect(action).toContainText('shop', { timeout: 6000 });
  await page.keyboard.up('KeyD');
  await action.click();
  const panel = page.locator('.panel');
  await expect(panel).toContainText("Biscuit's Shop");
  await panel.getByRole('tab', { name: /Weapons/ }).click();
  await expect(panel).toContainText('Fishbone Spear');
  await expect(panel).toContainText('Unlocks when you: Beat the Big Rat Brute');
  await panel.getByRole('tab', { name: /Armor/ }).click();
  await panel.locator('[data-act="buy"][data-id="sweater"]').click();
  await expect(page.locator('.block')).toHaveText('10%');
});
