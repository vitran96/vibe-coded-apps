#!/usr/bin/env node
// Runs the Caro/Gomoku unit tests in Node. The test body is evaluated inside a vm context that
// holds the same pure code the page loads (shared house kit, src/constants.js, i18n.js, rules.js, ai-engine.js).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const HOUSE = join(HERE, '..', '..', 'shared', 'house');
const ctx = vm.createContext({
  console, crypto: globalThis.crypto, performance: globalThis.performance, setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false }), navigator: {}, document: {},
  INDEX_HTML: readFileSync(join(SRC, 'index.html'), 'utf8'),
});
ctx.window = ctx; // house-kit.js attaches window.House
for (const [dir, f] of [[HOUSE, 'house-kit.js'], [HOUSE, 'house-store.js'], [SRC, 'constants.js'], [SRC, 'i18n.js'], [SRC, 'rules.js'], [SRC, 'ai-engine.js']]) {
  vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
}

function runTests() {
  const R = (mode, o = {}) => ({ mode, edgeBlocks: false, exactFive: false, ...o });
  // Build a board from rows; '.' empty, 'X' = 1, 'O' = 2.
  const mk = (N, rows, ox = 0, oy = 0) => {
    const b = new Int8Array(N * N);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') b[(y + oy) * N + x + ox] = ch === 'X' ? 1 : ch === 'O' ? 2 : 0; }));
    return b;
  };
  const results = [];
  const t = (name, cond) => results.push({ test: name, pass: !!cond });
  const N = 15;
  let b = mk(N, ['XXXXX'], 3, 7);
  t('gomoku horizontal five', checkWin(b, N, 5, 7, 1, R('gomoku')));
  b = mk(N, ['X', 'X', 'X', 'X', 'X'], 2, 2);
  t('gomoku vertical five', checkWin(b, N, 2, 4, 1, R('gomoku')));
  b = mk(N, ['X', '.X', '..X', '...X', '....X'], 1, 1);
  t('gomoku diagonal ↘ five', checkWin(b, N, 3, 3, 1, R('gomoku')));
  b = mk(N, ['....X', '...X', '..X', '.X', 'X'], 4, 4);
  t('gomoku diagonal ↗ five', checkWin(b, N, 6, 6, 1, R('gomoku')));
  t('four is not a win', !checkWin(mk(N, ['XXXX'], 3, 3), N, 4, 3, 1, R('gomoku')));
  b = mk(N, ['XXXXX'], 0, 0);
  t('five at edge (gomoku)', checkWin(b, N, 0, 0, 1, R('gomoku')));
  b = mk(N, ['XXXXXX'], 2, 5);
  t('overline wins when exactFive off', checkWin(b, N, 4, 5, 1, R('gomoku')));
  t('overline loses when exactFive on', !checkWin(b, N, 4, 5, 1, R('gomoku', { exactFive: true })));
  b = mk(N, ['XXXXX'], 2, 5);
  t('exact five wins with exactFive on', checkWin(b, N, 4, 5, 1, R('gomoku', { exactFive: true })));
  b = mk(N, ['OXXXXXO'], 2, 5);
  t('caro: O XXXXX O → no win', !checkWin(b, N, 4, 5, 1, R('caro')));
  t('gomoku: O XXXXX O → win', checkWin(b, N, 4, 5, 1, R('gomoku')));
  b = mk(N, ['OXXXXX.'], 2, 5);
  t('caro: O XXXXX _ → win', checkWin(b, N, 4, 5, 1, R('caro')));
  b = mk(N, ['XXXXX.'], 0, 5);
  t('caro: |XXXXX_ edgeBlocks off → win', checkWin(b, N, 2, 5, 1, R('caro')));
  t('caro: |XXXXX_ edgeBlocks on → win', checkWin(b, N, 2, 5, 1, R('caro', { edgeBlocks: true })));
  b = mk(N, ['XXXXXO'], 0, 5);
  t('caro: |XXXXXO edgeBlocks off → win', checkWin(b, N, 2, 5, 1, R('caro')));
  t('caro: |XXXXXO edgeBlocks on → no win', !checkWin(b, N, 2, 5, 1, R('caro', { edgeBlocks: true })));
  b = mk(N, ['X', '.X', '..X', '...X', '....X', '.....O'], 0, 0);
  t('caro diagonal: edge + O, edgeBlocks on → no win', !checkWin(b, N, 2, 2, 1, R('caro', { edgeBlocks: true })));
  t('caro diagonal: edge + O, edgeBlocks off → win', checkWin(b, N, 2, 2, 1, R('caro')));
  const full = new Int8Array(9 * 9).map((_, i) => 1 + (i % 2));
  t('isDraw on full board', isDraw(full, 9));
  t('not draw on empty board', !isDraw(new Int8Array(81), 9));

  const ai = createAI();
  b = mk(N, ['OXXXX.O'], 2, 5);
  t('AI pattern: caro O XXXX _ O is dead (not a four)', ai.patternAt(b, N, R('caro'), 7, 5, 0, 1) === 0);
  t('AI pattern: gomoku O XXXX _ O → completing is five', ai.patternAt(b, N, R('gomoku'), 7, 5, 0, 1) === 7);
  b = mk(N, ['.XXXX.'], 3, 5);
  t('AI takes immediate win (hard)', (m => m.y === 5 && (m.x === 3 || m.x === 8))(ai.chooseMove({ board: b, N, player: 1, rules: R('gomoku'), difficulty: 'hard', budget: 300 })));
  b = mk(N, ['OOOO.'], 3, 5); b[2 * N + 2] = 1;
  t('AI blocks five (medium)', (m => (m.x === 2 || m.x === 7) && m.y === 5)(ai.chooseMove({ board: b, N, player: 1, rules: R('gomoku'), difficulty: 'medium' })));
  b = mk(N, ['XOOOO.X'], 3, 5); b[1 * N + 1] = 1;
  t('Caro AI: X OOOO _ X is not a five threat for O', ai.patternAt(b, N, R('caro'), 8, 5, 0, 2) !== 7);
  t('Gomoku AI: X OOOO _ X is a five threat for O', ai.patternAt(b, N, R('gomoku'), 8, 5, 0, 2) === 7);
  t('storage prefix is caro_ and keys are plain suffixes', STORAGE_PREFIX === 'caro_' && Object.values(LS).every(k => /^\w+$/.test(k)));
  t('every data-i18n key in index.html is a string in vi and en', (() => { const html = INDEX_HTML; return [...html.matchAll(/data-i18n="([\w.]+)"/g)].every(m => ['vi', 'en'].every(l => typeof I18N[l][m[1]] === 'string' || I18N[l][m[1]] === undefined)); })());

  const failed = results.filter(r => !r.pass);
  console.table(results);
  console.log(failed.length ? `❌ ${failed.length} test(s) failed` : `✅ all ${results.length} tests passed`);
  return { results, failed };
}

const { failed } = vm.runInContext('(' + runTests.toString() + ')()', ctx);
process.exit(failed.length ? 1 : 0);
