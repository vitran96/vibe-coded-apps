// B1-B13: the house kit behaves the same in every app (language, theme, storage, shortcuts, sheets, a11y, phone).
import AxeBuilder from '@axe-core/playwright';
import { allApps, MODES, newVsAi } from '../lib/apps.mjs';
import { houseOf } from '../lib/house-adapters.mjs';
import { test, expect } from '../lib/fixtures.mjs';
import { canvasColours } from '../lib/canvas.mjs';

const THEMES = ['giay', 'dem', 'sonmai', 'bien'];
const HOUSE_STORAGE_FAILED = /Không lưu được dữ liệu|Saving isn't available/;
const CLEAR_SPY = () => {
  window.__clearCalls = 0;
  const clear = Storage.prototype.clear;
  Storage.prototype.clear = function () { window.__clearCalls++; return clear.call(this); };
};

// Close every open sheet with Esc (native <dialog> behaviour, rule 6).
async function closeAll(page) {
  for (let i = 0; i < 4 && (await page.locator('dialog[open]').count()); i++) await page.keyboard.press('Escape');
}

for (const app of allApps()) {
  const h = houseOf(app);

  test.describe(app, { tag: `@${app}` }, () => {
    test('B1 fresh storage: Vietnamese and light theme, Settings in Vietnamese', async ({ page }) => {
      await page.goto(MODES.served(app));
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'giay');
      await h.openSettings(page);
      await expect(page.locator('dialog[open]')).toContainText('Trò chơi');
    });

    test('B2 English switch updates lang and strings, and persists after reload', async ({ page }) => {
      await page.goto(MODES.served(app));
      await h.openSettings(page);
      await h.pickLang(page, 'en');
      await h.commit(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await closeAll(page);
      await h.openSettings(page);
      await expect(page.locator('dialog[open]')).toContainText('Sound');
      await closeAll(page);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('house:prefs')).lang)).toBe('en');
    });

    test('B3 forced light theme: OS dark mode is ignored, also when it changes at runtime', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(MODES.served(app));
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'giay');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'giay');
      const rgb = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number));
      expect(rgb[0] + rgb[1] + rgb[2], 'body background is light').toBeGreaterThan(600);
    });

    test('B4 each of the 4 themes persists and the board is still drawn', async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(MODES.served(app));
      for (const id of THEMES) {
        await h.openSettings(page);
        await h.pickTheme(page, id);
        await h.commit(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', id);
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', id);
        await newVsAi(page, app);
        const canvas = page.locator('canvas:visible').first();
        await expect.poll(() => canvasColours(page, canvas), { message: `board colours in ${id}`, timeout: 15_000 }).toBeGreaterThanOrEqual(16);
        await page.reload();
      }
    });

    test('B5 reset removes only own keys; foreign keys and house:prefs stay; localStorage.clear is never called', async ({ page }) => {
      await page.addInitScript(CLEAR_SPY);
      await page.goto(MODES.served(app));
      await page.evaluate(() => {
        localStorage.setItem('other_x', '1');
        localStorage.setItem('house:prefs', JSON.stringify({ v: 1, theme: 'dem', lang: 'vi' }));
      });
      await newVsAi(page, app);
      await closeAll(page);
      await h.openSettings(page);
      await h.resetData(page);
      await page.waitForLoadState('load');
      const keys = await page.evaluate(() => Object.keys(localStorage));
      expect(await page.evaluate(() => localStorage.getItem('other_x'))).toBe('1');
      expect(keys).toContain('house:prefs');
      for (const k of keys) expect(k === 'other_x' || k === 'house:prefs' || k.startsWith(h.prefix), k).toBe(true);
      expect(await page.evaluate(() => window.__clearCalls)).toBe(0);
    });

    test('B6 failing storage: game stays playable and the user is told once', async ({ page }) => {
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
      });
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      const canvas = page.locator('canvas:visible').first();
      await expect.poll(() => canvasColours(page, canvas), { timeout: 15_000 }).toBeGreaterThanOrEqual(16);
      await expect.poll(() => page.evaluate(() => document.body.textContent), { timeout: 10_000 }).toMatch(HOUSE_STORAGE_FAILED);
    });

    test('B7 shortcuts N H S ? open their sheet; keys are ignored while a sheet is open', async ({ page }) => {
      for (const [key, sel] of Object.entries(h.shortcuts)) {
        await page.goto(MODES.served(app));
        await closeAll(page);
        await page.keyboard.press(key);
        await expect(page.locator(sel), `key ${key}`).toBeVisible();
      }
      await page.goto(MODES.served(app));
      await h.openSettings(page);
      await page.keyboard.press('h');
      await expect(page.locator(h.shortcuts.h)).toBeHidden();
    });

    test('B7 key M toggles sound and the Settings checkbox follows', async ({ page }) => {
      await page.goto(MODES.served(app));
      await closeAll(page);
      const before = await h.toggles(page);
      await page.keyboard.press('m');
      const after = await h.toggles(page);
      expect(after.sfx).toBe(!before.sfx);
    });

    test('B8 Esc closes the sheet and focus returns to the button that opened it', async ({ page }) => {
      await page.goto(MODES.served(app));
      await closeAll(page);
      const opener = page.locator(h.opener);
      await opener.click();
      await expect(page.locator('dialog[open]').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(opener, 'focus back on the opener').toBeFocused();
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        return { focusVisible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineWidth };
      });
      expect(ring.focusVisible, 'Tab reaches a focusable element with a visible ring').toBe(true);
      expect(ring.outline).not.toBe('0px');
      const positive = await page.evaluate(() => [...document.querySelectorAll('[tabindex]')].filter((e) => +e.tabIndex > 0).length);
      expect(positive, 'no positive tabindex').toBe(0);
    });

    test('B9 a live region announces the first human move', async ({ page }) => {
      test.fixme(!h.keyMove, 'no keyboard move recipe yet (per-app flow D, P4)');
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      await h.keyMove(page);
      await expect.poll(() => page.evaluate(() =>
        [...document.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]')].some((e) => e.textContent.trim()),
      )).toBe(true);
    });

    test('B10 phone: no horizontal scroll, board visible, 44px targets, safe-area padding (portrait + landscape)', { tag: '@viewport' }, async ({ page }) => {
      await page.goto(MODES.served(app));
      await newVsAi(page, app);
      await closeAll(page);
      for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const board = await page.locator('canvas:visible').first().boundingBox();
        expect(board, 'board is visible').not.toBeNull();
        expect(board.x >= 0 && board.y >= 0 && board.x + board.width <= width && board.y + board.height <= height, `board fits ${width}x${height}`).toBe(true);
        const small = await page.evaluate(() => {
          const sel = 'button, [role="button"], input, select, a.btn';
          const out = [];
          for (const el of document.querySelectorAll(sel)) {
            if (!el.offsetParent) continue;
            const hit = el.matches('input[type="checkbox"], input[type="radio"]') ? el.closest('label') || el : el;
            const r = hit.getBoundingClientRect();
            if (r.width < 44 || r.height < 44) out.push(`${hit.id || hit.className || hit.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
          return out;
        });
        expect(small, `targets under 44px at ${width}x${height}`).toEqual([]);
      }
      const safeArea = await page.evaluate(() => [...document.styleSheets].some((s) => {
        try { return [...s.cssRules].some((r) => r.cssText.includes('safe-area-inset')); } catch { return false; }
      }));
      expect(safeArea, 'safe-area inset used in CSS').toBe(true);
    });

    test('B11 reduced motion: no running animation after a sheet opens', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(MODES.served(app));
      await closeAll(page);
      await h.openSettings(page);
      const running = await page.evaluate(() => document.getAnimations().map((a) => a.effect?.getTiming().duration).filter((d) => d > 1));
      expect(running).toEqual([]);
    });

    test('B12 defaults: music off, sound effects on, timer off', async ({ page }) => {
      await page.goto(MODES.served(app));
      const t = await h.toggles(page);
      expect(t).toEqual({ music: false, sfx: true, timerOff: true });
    });

    test('B13 axe: no serious or critical violation on each sheet, in all 4 themes', async ({ page }) => {
      test.setTimeout(240_000);
      for (const id of THEMES) {
        await page.goto(MODES.served(app));
        await page.evaluate((theme) => localStorage.setItem("house:prefs", JSON.stringify({ v: 1, theme, lang: "vi" })), id);
        await page.reload();
        for (const screen of ['start', 'settings', 'history', 'help', 'newgame']) {
          await closeAll(page);
          if (screen === 'settings') await h.openSettings(page);
          else if (screen !== 'start') await page.keyboard.press({ history: 'h', help: '?', newgame: 'n' }[screen]);
          const { violations } = await new AxeBuilder({ page }).analyze();
          const bad = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
          expect(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`), `${id} / ${screen}`).toEqual([]);
        }
      }
    });
  });
}
