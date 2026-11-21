// Keyboard board helpers for the per-app flows (D0-D12). State is read from text a screen reader gets, never pixels.
import { expect } from './fixtures.mjs';

// Press an arrow `n` times. dx/dy in cells; positive x = right, positive y = down.
export async function walk(page, dx, dy) {
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
}

// Live regions as one string (#live, #game-status-line, #app-toast, House announcer).
export const liveText = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]')].map((e) => e.textContent.trim()).join('\n'));

export async function expectAnnounced(page, re) {
  await expect.poll(() => liveText(page), { timeout: 15_000 }).toMatch(re);
}
