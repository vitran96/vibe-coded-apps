#!/usr/bin/env node
// Old saves must still load: 1.1.0 (caro_ keys, lang 'vn'/'eng') and 1.0.0 (caro. keys) in src/storage.js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const HOUSE = join(HERE, '..', '..', 'shared', 'house');

// Loads the real scripts into a fresh context with the given localStorage contents.
function loadWith(saved) {
  const data = new Map(Object.entries(saved));
  const ls = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  const ctx = vm.createContext({
    console, matchMedia: () => ({ matches: false }),
    navigator: {}, document: {}, localStorage: ls, addEventListener() {},
  });
  ctx.window = ctx;
  for (const [dir, f] of [[HOUSE, 'house-kit.js'], [HOUSE, 'house-store.js'], [SRC, 'constants.js'], [SRC, 'storage.js']]) {
    vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const session = {
  boardSize: 30, mode: 'pvp', rules: { mode: 'caro', exactFive: false, edgeBlocks: false },
  timer: { enabled: false }, players: { 1: 'X', 2: 'O' }, firstPlayer: 1, startedAt: 0,
};
const moves = [{ p: 1, x: 14, y: 14, t: 1000 }, { p: 2, x: 15, y: 14, t: 2000 }];
const record = { id: 'r1', session, moves, result: { winner: 1 } };

// 1.1.0 save: caro_ keys, display.lang 'vn', one game in progress, one record.
const v110 = loadWith({
  caro_settings: JSON.stringify({ v: 1, display: { lang: 'vn', cellSize: 'normal' } }),
  caro_current: JSON.stringify({ session, moves }),
  caro_records: JSON.stringify({ v: 1, items: [record] }),
});
const s110 = vm.runInContext('loadSettings()', v110);
assert.equal(s110.display.lang, 'vi', "1.1.0 lang 'vn' becomes 'vi'");
assert.equal(s110.audio.musicOn, false, 'spa music stays off by default');
const cur = vm.runInContext('store.get(LS.current)', v110);
assert.ok(vm.runInContext('validSession(store.get(LS.current).session)', v110), 'in-progress game is still valid');
assert.equal(cur.moves.length, 2);
assert.equal(vm.runInContext('loadRecords()', v110).length, 1, '1.1.0 records load');

// 1.1.0 English save.
const eng = loadWith({ caro_settings: JSON.stringify({ v: 1, display: { lang: 'eng' } }) });
assert.equal(vm.runInContext('loadSettings()', eng).display.lang, 'en', "1.1.0 lang 'eng' becomes 'en'");

// 1.0.0 save: caro. keys, read through the legacy fallback.
const v100 = loadWith({ 'caro.records': JSON.stringify({ v: 1, items: [record] }), 'caro.settings': JSON.stringify({ v: 1, display: { lang: 'eng' } }) });
assert.equal(vm.runInContext('loadRecords()', v100).length, 1, '1.0.0 records load via caro. fallback');
assert.equal(vm.runInContext('loadSettings()', v100).display.lang, 'en', '1.0.0 settings load via caro. fallback');

// Nothing saved yet, and broken JSON: defaults, no throw.
const empty = loadWith({ caro_records: '{not json' });
assert.equal(vm.runInContext('loadSettings()', empty).display.lang, 'vi');
assert.equal(vm.runInContext('loadRecords()', empty).length, 0);

console.log('save migration: 1.1.0 and 1.0.0 saves load (5 cases)');
