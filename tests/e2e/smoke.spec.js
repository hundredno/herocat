import { expect, test } from '@playwright/test';

test('title is interactive fast and shows the version', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await expect(page.locator('#btn-new')).toBeVisible();
  await expect(page.locator('#title')).toHaveClass(/ready/, { timeout: 4000 });
  expect(Date.now() - start).toBeLessThan(4000);
  await expect(page.locator('#version')).toHaveText(/^v\.([0-9a-f]{4}|dev)$/);
});

test('a new game starts with 10 HP and 6 damage', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#title')).toHaveClass(/ready/);
  await page.locator('#btn-new').click();

  // the prologue tells the story; skip it
  const dialogue = page.locator('.dialogue');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText(/Whiskerwood/);
  await page.locator('.dlg-skip').click();
  await expect(dialogue).toBeHidden();

  await expect(page.locator('.hp-text')).toHaveText('10 / 10');
  await expect(page.locator('.dmg')).toHaveText('6');
  await expect(page.locator('.gold')).toHaveText('0');
  await expect(page.locator('.obj-text')).toContainText('Rat Burrow');

  // the hero panel explains where the 6 comes from
  await page.locator('.hud-btn[data-b="bag"]').click();
  await expect(page.locator('.panel')).toContainText('5 base + 0 training (Lv 1) + 1 Bamboo Sword');
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-wrap')).toBeHidden();

  // progress is saved, so reloading offers Continue
  await page.reload();
  await expect(page.locator('#btn-continue')).toBeVisible();
  expect(errors).toEqual([]);
});
