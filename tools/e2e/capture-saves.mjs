#!/usr/bin/env node
// One-off capture of real localStorage from released builds in git history, for the legacy-save specs (D3, D5, D7).
// Old builds load Three.js / Tone.js from a CDN, so this run needs network. Output: saves/<app>-<ver>.json.
// Run by hand when a save format changes: node tools/e2e/capture-saves.mjs [caro|chess|chinese-chess]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT } from './lib/apps.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'saves');
const TARGETS = [
  { app: 'caro', ver: '1.1.0', commit: '68768b0', run: (p) => caroRun(p, 'vn') },
  { app: 'caro', ver: '1.1.0-eng', commit: '68768b0', run: (p) => caroRun(p, 'eng') },
  { app: 'caro', ver: '1.0.0', commit: '13470d5', run: (p) => caroRun(p, null) }, // last build with caro. keys (no APP_VERSION constant)
  // Versions by storage prefix: chess 1.0.0 wrote chess: keys until d53f8fb; chinese-chess 1.0.0 wrote co-tuong: until a7f311e.
  // Not reproducible in 2026-11 runs (no move without the 1.1.0 cursor; no start screen at a7f311e): saves/chess-1.0.0.json and chinese-chess-1.1.0.json are hand-built from the legacy code.
  // Not reproducible in 2026-11 runs (no move without the 1.1.0 cursor; no start screen at a7f311e): saves/chess-1.0.0.json and chinese-chess-1.1.0.json are hand-built from the legacy code.
  { app: 'chess', ver: '1.0.0', commit: 'd53f8fb', run: chessRun },
  { app: 'chinese-chess', ver: '1.0.0', commit: 'a7f311e', run: chineseRun },
  { app: 'chinese-chess', ver: '1.1.0', commit: '3b353a6', run: chineseRun },
];

const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 16 << 20 });

// Keyboard moves on the caro board, relative to wherever the cursor is.
async function caroPlace(page, cells) {
  let cur = { x: 0, y: 0 };
  for (const [x, y] of cells) {
    for (let i = 0; i < Math.abs(x - cur.x); i++) await page.keyboard.press(x > cur.x ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.abs(y - cur.y); i++) await page.keyboard.press(y > cur.y ? 'ArrowDown' : 'ArrowUp');
    cur = { x, y };
    await page.keyboard.press('Enter');
  }
}

// The menu opens by itself on first boot; open it only when it is closed.
async function caroMenu(page, id) {
  if (!(await page.locator('#dlg-menu').isVisible())) await page.locator('#btn-menu').click();
  await page.locator(id).click();
}

async function caroRun(page, lang) {
  if (lang) { // 1.0.0 has no language setting
    await caroMenu(page, '#mn-settings');
    await page.locator(`input[name="st_lang"][value="${lang}"]`).check({ force: true });
    await page.locator('#form-settings button[type="submit"]').click();
  }
  await caroMenu(page, '#mn-vs-player');
  await page.locator('#canvas-host').focus();
  // Five in a row for X (row 0), O on row 1: one finished game = one record.
  const win = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0]];
  await caroPlace(page, win);
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  // A second game left in progress with two stones.
  await caroMenu(page, '#mn-vs-player');
  await page.locator('#canvas-host').focus();
  await caroPlace(page, [[0, 0], [1, 0]]);
  await page.waitForTimeout(300);
}

async function chessRun(page) {
  await page.locator('#btn-play').click();
  await page.locator('#btn-start-game').click();
  await page.locator('#btn-side-resign').click(); // ends the game: one record
  await page.locator('#btn-side-menu').click();
  await page.locator('#btn-menu-new').click();
  await page.locator('#btn-start-game').click(); // a second game left in progress
  await page.waitForTimeout(300);
}

async function chineseRun(page) {
  await page.locator('#btn-start-play').click();
  await page.locator('#btn-newgame-start').click();
  await page.locator('#btn-action-resign').click();
  await page.locator('#btn-resign-confirm').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#btn-start-play').click();
  await page.locator('#btn-newgame-start').click();
  await page.waitForTimeout(300);
}

async function dump(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

async function main() {
  const only = process.argv[2];
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const t of TARGETS.filter((x) => !only || x.app === only)) {
      const dir = mkdtempSync(join(tmpdir(), `e2e-old-${t.app}-`));
      const file = join(dir, 'index.html');
      writeFileSync(file, git(['show', `${t.commit}:${t.app}/index.html`]));
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(file).href);
      await t.run(page);
      const keys = await dump(page);
      const saved = Object.keys(keys).filter((k) => /^(caro|covua|chess|co-tuong|cotuong)/.test(k) || k.startsWith('house'));
      const subset = Object.fromEntries(saved.map((k) => [k, keys[k]]));
      writeFileSync(join(OUT, `${t.app}-${t.ver}.json`), `${JSON.stringify({ source: `git ${t.commit}:${t.app}/index.html`, localStorage: subset }, null, 2)}\n`);
      console.log(`${t.app} ${t.ver} (${t.commit}): ${saved.length} keys`, saved, errors.length ? `pageerrors: ${errors.join('; ')}` : '');
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
