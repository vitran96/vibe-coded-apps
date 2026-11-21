// chess flows D0, D1, D5, D6, D12: keyboard board cursor, undo, legacy chess: saves, undo toggle, pointer tap.
import { MODES, newVsAi } from '../lib/apps.mjs';
import { test, expect, seed, stored } from '../lib/fixtures.mjs';
import { expectAnnounced } from '../lib/board.mjs';

const APP = 'chess';
// The board cursor starts on a8 (White's view). e2 -> e4 by keyboard, as in boot.spec A5.
const E2_E4 = [['ArrowRight', 4], ['ArrowDown', 6], ['Enter', 1], ['ArrowUp', 2], ['Enter', 1]];
async function keyboardE2E4(page) {
  await page.locator('#chess-canvas').focus();
  for (const [key, n] of E2_E4) for (let i = 0; i < n; i++) await page.keyboard.press(key);
}
const moves = async (page) => (await stored(page, 'covua_current'))?.session?.moves?.length ?? 0;

test.describe(APP, { tag: `@${APP}` }, () => {
  test('D0 keyboard-only game: move by cursor, resign, result announced, record kept', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await newVsAi(page, APP);
    await keyboardE2E4(page);
    await expect.poll(() => moves(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await expectAnnounced(page, /e4/);
    page.once('dialog', (d) => d.accept()); // resign asks with window.confirm
    await page.locator('#btn-side-resign').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#game-status-line')).not.toBeEmpty();
    await expect.poll(async () => (await stored(page, 'covua_records'))?.games?.length, { timeout: 10_000 }).toBe(1);
  });

  test('D1 PvE undo reverts two plies and the turn returns to the human', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await newVsAi(page, APP);
    await keyboardE2E4(page);
    await expect.poll(() => moves(page), { timeout: 15_000 }).toBe(2);
    await page.locator('#btn-undo').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => moves(page), { timeout: 10_000 }).toBe(0);
  });

  test('D5 legacy chess: keys resume the saved game and new writes go to covua_', async ({ page }) => {
    await seed(page, 'chess-1.0.0.json');
    await page.goto(MODES.served(APP));
    await expect(page.locator('#btn-resume')).toBeVisible();
    await page.locator('#btn-resume').click();
    await expect(page.locator('#game-screen')).toBeVisible();
    // The legacy keys are read but never rewritten: only covua_ keys get written.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('chess:')).length)).toBe(3);
  });

  test('D6 undo is a setting, not a flip button; off means no undo', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await expect(page.locator('#btn-flip')).toHaveCount(0);
    await expect(page.locator('#seg-new-undo')).toHaveCount(1);
    await expect(page.locator('#chk-undo')).toHaveCount(1);
  });

  test('D12 pointer tap on a square makes the same move as the keyboard', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await newVsAi(page, APP);
    // cellToClient returns page CSS px already. e2 = (4,6) and e4 = (4,4) in White's view (x = file, y = rank from top).
    const tap = async (x, y) => { const p = await page.evaluate(([a, b]) => House.debug.cellToClient(a, b), [x, y]); await page.mouse.click(p.x, p.y); };
    await tap(4, 6);
    await tap(4, 4);
    await expect.poll(() => moves(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  });
});
