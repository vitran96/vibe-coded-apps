// A1-A6: every app boots with no external requests, works offline, looks the same at every URL,
// draws its board, answers the computer, and shows no raw i18n keys.
import { allApps, MODES, newVsAi } from '../lib/apps.mjs';
import { test, expect } from '../lib/fixtures.mjs';
import { canvasColours } from '../lib/canvas.mjs';
import { houseOf } from '../lib/house-adapters.mjs';

// A5: one human move by keyboard, then the computer's reply changes the board. Only chess has a recipe yet.
const AI_REPLY = {
  chess: async (page) => {
    const boardText = () => page.locator('#board-text').innerText();
    const before = await boardText();
    await page.locator('#chess-canvas').focus();
    // Cursor starts on a8 (top-left, White's view): e2 is 4 right, 6 down; e4 is 2 up.
    for (const [key, n] of [['ArrowRight', 4], ['ArrowDown', 6], ['Enter', 1], ['ArrowUp', 2], ['Enter', 1]]) {
      for (let i = 0; i < n; i++) await page.keyboard.press(key);
    }
    await expect.poll(boardText, { timeout: 15_000 }).not.toBe(before);
    const afterHuman = await boardText();
    await expect.poll(boardText, { timeout: 15_000 }).not.toBe(afterHuman);
  },
};
AI_REPLY['chinese-chess'] = async (page) => {
  const text = () => page.locator('#board-text').innerText();
  const before = await text();
  await houseOf('chinese-chess').keyMove(page);
  await expect.poll(text, { timeout: 15_000 }).not.toBe(before);
  const afterHuman = await text();
  await expect.poll(text, { timeout: 15_000 }).not.toBe(afterHuman);
};
const NO_RECIPE = 'no keyboard move recipe yet (per-app flow D, P4)';

for (const app of allApps()) {
  test.describe(app, { tag: `@${app}` }, () => {
    test('A1 boots with network blocked, zero external requests', async ({ page, context }) => {
      await page.goto(MODES.served(app));
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await expect(page.getByRole('button').first()).toBeVisible();
      await expect(context.pages()).toHaveLength(1);
    });

    test('A2 loads fully offline from file://', async ({ page, context }) => {
      await context.setOffline(true);
      await page.goto(MODES.file(app));
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await expect(page.getByRole('button').first()).toBeVisible();
    });

    test('A3 same start screen at every URL form', async ({ page }) => {
      test.setTimeout(180_000); // five full page loads of a 1.5 MB single file
      const seen = {};
      for (const [mode, url] of Object.entries(MODES)) {
        await page.goto(url(app));
        await expect(page.getByRole('button').first()).toBeVisible();
        seen[mode] = await page.getByRole('button').allInnerTexts();
      }
      for (const mode of Object.keys(MODES)) expect(seen[mode], mode).toEqual(seen.served);
    });

    test('A4 WebGL board is drawn after a new game', async ({ page }) => {
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      const canvas = page.locator('canvas:visible').first();
      await expect(canvas).toBeVisible();
      await expect.poll(() => canvasColours(page, canvas), { timeout: 15_000 }).toBeGreaterThanOrEqual(16);
    });

    test('A5 computer replies after one human move', async ({ page }) => {
      test.fixme(!AI_REPLY[app], NO_RECIPE);
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      await AI_REPLY[app](page);
    });

    test('A6 no raw i18n keys on screen', async ({ page }) => {
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/\b(game|house|theme|reason)\.[a-z][\w.]*/);
    });
  });
}
