// Node self-test for the house helpers that run without a browser. Usage: node shared/house/self-test.mjs
// DOM-only parts (announce, dialogs, boardCursor, unlock listeners) are not covered here: check them in a browser.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = dirname(fileURLToPath(import.meta.url));
const sandbox = (extra = {}) => {
  const events = [];
  const ctx = vm.createContext({
    House: {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent: (e) => events.push(e.type),
    addEventListener() {},
    ...extra,
  });
  ctx.events = events;
  return ctx;
};
const load = (file, ctx) => { vm.runInContext(readFileSync(join(dir, file), 'utf8'), ctx, { filename: file }); return ctx; };

class MemStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
class FullStorage extends MemStorage {
  setItem() { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); }
}
class BlockedStorage {
  get length() { throw new Error('blocked'); }
  getItem() { throw new Error('blocked'); }
  setItem() { throw new Error('blocked'); }
  removeItem() { throw new Error('blocked'); }
  key() { throw new Error('blocked'); }
}

// vm objects have another realm's prototypes, so compare by JSON content.
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('store: legacy fallback, new key wins, remove clears both', () => {
  const ls = new MemStorage();
  const { House } = load('house-store.js', sandbox({ localStorage: ls }));
  const s = House.store('covua_', { legacy: ['chess:'] });
  ls.setItem('chess:old', JSON.stringify({ v: 1, a: 2 }));
  same(s.get('old'), { v: 1, a: 2 });
  s.set('old', { v: 2 });
  same(s.get('old'), { v: 2 });
  s.remove('old');
  assert.equal(s.get('old', 'none'), 'none');
  assert.equal(ls.getItem('chess:old'), null);
});

test('store: clearOwn removes only own and legacy keys', () => {
  const ls = new MemStorage();
  const { House } = load('house-store.js', sandbox({ localStorage: ls }));
  const s = House.store('covua_', { legacy: ['chess:'] });
  ['covua_a', 'chess:x', 'caro_z', 'house:prefs', 'cotuong_q'].forEach((k) => ls.setItem(k, '1'));
  s.clearOwn();
  same([...ls.m.keys()].sort(), ['caro_z', 'cotuong_q', 'house:prefs']);
});

test('store: corrupt JSON gives the fallback, no event', () => {
  const ls = new MemStorage();
  const ctx = load('house-store.js', sandbox({ localStorage: ls }));
  const s = ctx.House.store('covua_');
  ls.setItem('covua_bad', '{oops');
  assert.equal(s.get('bad', 'fb'), 'fb');
  same(ctx.events, []);
});

test('store: failed write returns false and fires one event per page', () => {
  const ctx = load('house-store.js', sandbox({ localStorage: new FullStorage() }));
  const s = ctx.House.store('covua_');
  assert.equal(s.set('a', 1), false);
  assert.equal(s.set('b', 2), false);
  same(ctx.events, ['housestoragefail']);
});

test('store: blocked storage never throws', () => {
  const ctx = load('house-store.js', sandbox({ localStorage: new BlockedStorage() }));
  const s = ctx.House.store('covua_', { legacy: ['chess:'] });
  assert.equal(s.get('x', 5), 5);
  assert.equal(s.set('x', 1), false);
  s.remove('x');
  s.clearOwn();
});

test('store: empty prefix is refused', () => {
  const ctx = load('house-store.js', sandbox({ localStorage: new MemStorage() }));
  assert.throws(() => ctx.House.store(''), /empty prefix/);
});

test('a11y: board cursor steps clamp at edges and jump', () => {
  const { House } = load('house-a11y.js', sandbox());
  const step = House.boardStep;
  same(step(0, 0, 'ArrowLeft', 8, 8), { x: 0, y: 0 });
  same(step(7, 7, 'ArrowRight', 8, 8), { x: 7, y: 7 });
  same(step(0, 0, 'ArrowDown', 8, 8), { x: 0, y: 1 });
  same(step(3, 4, 'Home', 8, 8), { x: 0, y: 4 });
  same(step(3, 4, 'End', 8, 8), { x: 7, y: 4 });
  same(step(3, 4, 'PageUp', 8, 8), { x: 3, y: 0 });
  same(step(3, 4, 'PageDown', 8, 8), { x: 3, y: 7 });
  assert.equal(step(3, 4, 'a', 8, 8), null);
});

test('audio: sfx respects the on flag and plays through House.play', () => {
  class FakeCtx {
    constructor() { this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() { return this; } }; }
    resume() {}
  }
  const played = [];
  const ctx = load('house-audio.js', sandbox({ AudioContext: FakeCtx }));
  ctx.House.play = (c, o, name) => played.push(name);
  ctx.House.audio.play('tap');
  ctx.House.audio.sfx.on = false;
  ctx.House.audio.play('win');
  same(played, ['tap']);
});

test('audio: bgm builds once, starts, pauses when hidden, stops', async () => {
  const calls = [];
  class Volume {
    constructor(db) { this.volume = { value: db }; }
    toDestination() { calls.push('dest'); return this; }
  }
  const Tone = {
    Volume,
    Transport: {
      bpm: { value: 0 }, swing: 0,
      start() { calls.push('start'); }, stop() { calls.push('stop'); }, pause() { calls.push('pause'); },
    },
    start: async () => { calls.push('tone.start'); },
  };
  const listeners = [];
  const doc = { hidden: false, addEventListener(t, f) { if (t === 'visibilitychange') listeners.push(f); } };
  let bus = null;
  const ctx = load('house-audio.js', sandbox({ Tone, document: doc }));
  const bgm = ctx.House.bgm({ bpm: 74, swing: 0.12, build(T, b) { calls.push('build'); bus = b; } });
  const fire = () => listeners.forEach((f) => f());

  await bgm.set(true);
  assert.equal(Tone.Transport.bpm.value, 74);
  assert.equal(Tone.Transport.swing, 0.12);
  assert.equal(calls.filter((c) => c === 'build').length, 1);
  assert.ok(calls.includes('start'));

  calls.length = 0;
  await bgm.set(true);
  assert.equal(calls.filter((c) => c === 'build').length, 0, 'build runs only once');

  doc.hidden = true; fire();
  assert.ok(calls.includes('pause'));
  doc.hidden = false; calls.length = 0; fire();
  assert.ok(calls.includes('start'), 'resumes on return');

  await bgm.set(false);
  assert.ok(calls.includes('stop'));
  calls.length = 0; doc.hidden = true; fire(); doc.hidden = false; fire();
  same(calls, [], 'does not restart after stop');

  bgm.volume(0);
  assert.equal(bus.volume.value, -Infinity);
  bgm.volume(0.5);
  assert.ok(Math.abs(bus.volume.value + 6.02) < 0.01);
});

test('audio: bgm stays silent when Tone.js is missing or blocked', async () => {
  const ctx = load('house-audio.js', sandbox({ document: { addEventListener() {} } }));
  await ctx.House.bgm({ build() { throw new Error('must not build'); } }).set(true);
  const Tone = { start: () => Promise.reject(new Error('no gesture')), Transport: { start() { throw new Error('must not start'); } } };
  const ctx2 = load('house-audio.js', sandbox({ Tone, document: { addEventListener() {} } }));
  await ctx2.House.bgm({ build() { throw new Error('must not build'); } }).set(true);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} house self-tests passed`);
process.exit(failed ? 1 : 0);
