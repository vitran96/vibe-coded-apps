// chinese-chess flows D0, D7-D11: keyboard play and resign, legacy co-tuong: saves, no flip, translated reasons, live text.
import { MODES } from '../lib/apps.mjs';
import { test, expect, seed, stored } from '../lib/fixtures.mjs';
import { houseOf } from '../lib/house-adapters.mjs';
import { expectAnnounced } from '../lib/board.mjs';

const APP = 'chinese-chess';
const h = houseOf(APP);
const start = async (page) => {
  await page.locator('#btn-start-play').click();
  await page.locator('#btn-newgame-start').click();
};
const records = async (page) => (await stored(page, 'cotuong_records'))?.items?.length ?? 0;

test.describe(APP, { tag: `@${APP}` }, () => {
  test('D0 keyboard-only game: move, resign from the keyboard, result shown, record kept', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await start(page);
    await h.keyMove(page);
    await expectAnnounced(page, /Đen/); // the computer's reply is announced in Vietnamese
    await page.locator('#btn-action-resign').focus();
    await page.keyboard.press('Enter');
    await page.locator('#btn-resign-confirm').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dialog-gameover')).toBeVisible();
    await expect.poll(() => records(page), { timeout: 10_000 }).toBe(1);
  });

  test('D7 legacy co-tuong: keys resume the game and cotuong_prefs migrates to house:prefs', async ({ page }) => {
    await seed(page, 'chinese-chess-1.1.0.json');
    await page.goto(MODES.served(APP));
    await expect(page.locator('#btn-start-resume')).toBeVisible();
    await expect.poll(() => stored(page, 'house:prefs'), { timeout: 10_000 }).toMatchObject({ theme: 'dem' });
    expect(await stored(page, 'cotuong_prefs')).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dem');
  });

  test('D8 no flip button, no draw offer, and no f shortcut', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await expect(page.getByRole('button', { name: /Cầu hoà/ })).toHaveCount(0);
    await expect(page.locator('[id*="flip"]')).toHaveCount(0);
    await start(page);
    await page.locator('#canvas-3d').focus();
    const before = await page.locator('#board-text').innerText();
    await page.keyboard.press('f');
    await expect(page.locator('#board-text')).toHaveText(before);
  });

  test.fixme('D8 choosing Black flips the board so Black is at the bottom', async () => {}); // TODO: needs a side-choice recipe in the new-game sheet (#005)

  test('D9 resign shows a translated reason, never a raw key', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await start(page);
    await page.locator('#btn-action-resign').click();
    await page.locator('#btn-resign-confirm').click();
    const reason = page.locator('#gameover-reason');
    await expect(reason).not.toBeEmpty();
    await expect(reason).not.toContainText('game.reason.');
  });

  test('D10 action buttons have visible text; the move list fills after a ply', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await start(page);
    for (const id of ['#btn-action-newgame', '#btn-action-undo', '#btn-action-resign', '#btn-action-history']) {
      await expect(page.locator(id)).not.toHaveText(/^\s*$/);
    }
    await h.keyMove(page);
    await expect.poll(() => page.locator('#side-movelist-container').innerText(), { timeout: 10_000 }).not.toBe('');
  });

  test('D10 undo off: Undo does not revert and tells the player why', async ({ page }) => {
    await page.goto(MODES.served(APP));
    await h.openSettings(page);
    await page.locator('#settings-undo-toggle').uncheck({ force: true });
    await h.commit(page);
    await start(page);
    await h.keyMove(page);
    await page.locator('#btn-action-undo').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app-toast')).toBeVisible();
    await expect(page.locator('#btn-action-undo')).toHaveAttribute('aria-disabled', 'true');
  });

  test.fixme('D11 history: Chơi tiếp and replay start a live game from a record', async () => {}); // TODO: needs a seeded finished game (records) in a legacy save
});
