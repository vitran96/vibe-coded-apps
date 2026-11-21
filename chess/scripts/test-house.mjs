// Node test for the shared store (legacy 'chess:' saves) and the board cursor step. Loads the real shared files.
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const shared = fileURLToPath(new URL('../../shared/house/', import.meta.url));
const mem = new Map();
globalThis.localStorage = {
  get length() { return mem.size; },
  key: (i) => [...mem.keys()][i] ?? null,
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.House = {};
for (const f of ['house-store.js', 'house-a11y.js']) runInThisContext(readFileSync(shared + f, 'utf8'));
const { House } = globalThis;

const store = House.store('covua_', { legacy: ['chess:'] });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

ok('reads a 1.0.0 save stored under the legacy chess: prefix', () => {
  mem.clear();
  mem.set('chess:settings', JSON.stringify({ sfx: false }));
  assert.deepStrictEqual(store.get('settings', {}), { sfx: false });
});

ok('a covua_ key wins over the legacy one', () => {
  mem.clear();
  mem.set('chess:current', JSON.stringify('old'));
  mem.set('covua_current', JSON.stringify('new'));
  assert.strictEqual(store.get('current'), 'new');
});

ok('writes only the covua_ prefix', () => {
  mem.clear();
  assert.strictEqual(store.set('records', { v: 1, games: [] }), true);
  assert.deepStrictEqual([...mem.keys()], ['covua_records']);
});

ok('remove clears both prefixes', () => {
  mem.clear();
  mem.set('chess:x', '1');
  mem.set('covua_x', '2');
  store.remove('x');
  assert.strictEqual(mem.size, 0);
});

ok('clearOwn removes only this app and keeps house:prefs and other apps', () => {
  mem.clear();
  for (const k of ['covua_a', 'chess:b', 'house:prefs', 'caro_c', 'cotuong_d']) mem.set(k, '1');
  store.clearOwn();
  assert.deepStrictEqual([...mem.keys()].sort(), ['caro_c', 'cotuong_d', 'house:prefs']);
});

ok('blocked storage never throws: get gives the fallback, set gives false', () => {
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() {} };
  try {
    assert.strictEqual(store.get('settings', 'fallback'), 'fallback');
    assert.strictEqual(store.set('settings', {}), false);
  } finally {
    globalThis.localStorage = real;
  }
});

ok('corrupt JSON falls back instead of throwing', () => {
  mem.clear();
  mem.set('covua_bad', '{not json');
  assert.strictEqual(store.get('bad', 7), 7);
});

ok('board cursor: arrows clamp at the edge, Home/End/PageUp/PageDown jump, other keys are ignored', () => {
  const step = House.boardStep;
  assert.deepStrictEqual(step(0, 0, 'ArrowLeft', 8, 8), { x: 0, y: 0 });
  assert.deepStrictEqual(step(3, 3, 'ArrowDown', 8, 8), { x: 3, y: 4 });
  assert.deepStrictEqual(step(7, 0, 'ArrowRight', 8, 8), { x: 7, y: 0 });
  assert.deepStrictEqual(step(2, 5, 'End', 8, 8), { x: 7, y: 5 });
  assert.deepStrictEqual(step(2, 5, 'PageUp', 8, 8), { x: 2, y: 0 });
  assert.strictEqual(step(2, 5, 'a', 8, 8), null);
});

console.log(`\n${n} house store and cursor tests passed`);
