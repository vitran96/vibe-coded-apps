// TEMPLATE for a new app (copy to specs/<app>.spec.mjs and replace every <APP>). Not run by the suite (playwright.config testIgnore).
// Needs: a keyboard path for one legal move (House.boardCursor), a finished game, and the live region the app announces in.
import { MODES, newVsAi } from '../lib/apps.mjs';
import { test, expect, stored } from '../lib/fixtures.mjs';
import { walk, expectAnnounced } from '../lib/board.mjs';

const APP = '<APP>';
const MOVE = [{ x: 0, y: 0 }]; // cells to press Enter on, relative to the cursor's start (fill in)

test.describe(APP, () => {
  test('D0 keyboard-only game: move, result announced', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await newVsAi(page, APP);
    await page.locator('canvas:visible').first().focus();
    for (const c of MOVE) { await walk(page, c.x, c.y); await page.keyboard.press('Enter'); }
    await expectAnnounced(page, /\S/); // replace with the app's turn/result text, e.g. /your turn/i
  });
});
