// caro flows D0-D4 and D12: keyboard-only play, undo, legacy saves, camera invariant, pointer tap.
import { MODES, newVsAi } from '../lib/apps.mjs';
import { test, expect, seed, stored } from '../lib/fixtures.mjs';
import { walk, expectAnnounced } from '../lib/board.mjs';

const APP = 'caro';
const CENTRE = { x: 15, y: 15 }; // 30x30 board, cursor starts in the middle (caro/src/input.js)
const open = async (page) => {
  await page.goto(MODES.served(APP));
  if (!(await page.locator('#dlg-menu').isVisible())) await page.locator('#btn-menu').click();
};
// Place stones at absolute cells, moving the cursor from its last cell.
async function place(page, cells, from = CENTRE) {
  let cur = from;
  for (const c of cells) {
    await walk(page, c.x - cur.x, c.y - cur.y);
    await page.keyboard.press('Enter');
    cur = c;
  }
  return cur;
}
const row = (y, x0, n) => Array.from({ length: n }, (_, i) => ({ x: x0 + i, y }));

test.describe(APP, { tag: `@${APP}` }, () => {
  test('D0 keyboard-only game: win by five, result announced, record kept', async ({ page }) => {
    await open(page);
    await page.locator('#mn-vs-player').click();
    await page.locator('#canvas-host').focus();
    const x = row(15, 15, 5);
    const o = row(16, 15, 4);
    // X and O alternate: X makes five on row 15.
    const seq = x.flatMap((c, i) => (i < 4 ? [c, o[i]] : [c]));
    await place(page, seq);
    await expectAnnounced(page, /\S/);
    await expect.poll(async () => (await stored(page, 'caro_records'))?.items?.length, { timeout: 15_000 }).toBe(1);
  });

  test('D1 PvE undo takes back the human move and the computer reply (two plies)', async ({ page }) => {
    await open(page);
    await newVsAi(page, APP);
    await page.locator('#canvas-host').focus();
    await place(page, [CENTRE]);
    await expect.poll(async () => (await stored(page, 'caro_current'))?.moves?.length, { timeout: 15_000 }).toBe(2);
    await page.keyboard.press('u');
    await expect.poll(async () => (await stored(page, 'caro_current'))?.moves?.length ?? 0, { timeout: 10_000 }).toBe(0);
  });

  test('D2 PvP five in a row in caro rule mode', async ({ page }) => {
    await open(page);
    await page.locator('#mn-vs-player').click();
    await page.locator('#canvas-host').focus();
    await place(page, row(15, 15, 5).flatMap((c, i) => (i < 4 ? [c, { x: c.x, y: 16 }] : [c])));
    await expect.poll(async () => (await stored(page, 'caro_records'))?.items?.[0]?.result?.winner, { timeout: 15_000 }).toBe(1);
    expect((await stored(page, 'caro_records')).items[0].session.rules.mode).toBe('caro');
  });

  test('D3 legacy 1.1.0 Vietnamese save: UI vi, game resumes with two stones, one record', async ({ page }) => {
    await seed(page, 'caro-1.1.0.json');
    await page.goto(MODES.served(APP));
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect.poll(async () => (await stored(page, 'caro_current'))?.moves?.length).toBe(2);
    expect((await stored(page, 'caro_records')).items.length).toBe(1);
  });

  test('D3 legacy 1.1.0 English save: UI en', async ({ page }) => {
    await seed(page, 'caro-1.1.0-eng.json');
    await page.goto(MODES.served(APP));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('D3 legacy 1.0.0 caro. keys: records load', async ({ page }) => {
    await seed(page, 'caro-1.0.0.json');
    await page.goto(MODES.served(APP));
    await expect.poll(async () => (await stored(page, 'caro_records'))?.items?.length ?? (await stored(page, 'caro.records'))?.items?.length).toBeGreaterThan(0);
  });

  test('D4 camera: a centre move never pans; a move next to the edge does', async ({ page }) => {
    await open(page);
    await page.locator('#mn-vs-player').click();
    await page.locator('#canvas-host').focus();
    const cam = () => page.evaluate(() => House.debug.camera());
    // The camera eases in after the board appears: wait until it stops moving before measuring.
    await expect.poll(async () => { const a = await cam(); await page.waitForTimeout(200); return JSON.stringify(a) === JSON.stringify(await cam()); }, { timeout: 15_000 }).toBe(true);
    const before = await cam();
    await place(page, [CENTRE]);
    expect(await cam()).toEqual(before);
    await place(page, [{ x: 0, y: 0 }], CENTRE); // corner: within 1.2 cells of the edge
    await expect.poll(cam).not.toEqual(before);
  });

  test('D12 pointer tap on a cell places the same stone as the keyboard', async ({ page }) => {
    await open(page);
    await page.locator('#mn-vs-player').click();
    const p = await page.evaluate(([x, y]) => House.debug.cellToClient(x, y), [CENTRE.x, CENTRE.y]); // page CSS px
    await page.mouse.click(p.x, p.y);
    await expect.poll(async () => (await stored(page, 'caro_current'))?.moves?.length, { timeout: 10_000 }).toBe(1);
  });
});
