import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  unsafePath, assertSafeUrl, parseFilesManifest, gameType, launcherRange, normalizeLimit, isNewerVersion, compareVersions
} from '../src/js/safety.js';

describe('Path rule (hardening R1, R2; files-type R9)', () => {
  test('unsafePath rejects every unsafe form and accepts normal paths', () => {
    for (const p of ['', '../x', 'a/../x', '/x', 'C:\\x', 'C:/x', 'a\\b', 'a\\..\\x', 'a\0b']) assert.ok(unsafePath(p), JSON.stringify(p));
    for (const p of ['index.html', 'assets/a b.png', 'a/b/c.js', '..hidden']) assert.equal(unsafePath(p), null, p);
  });
});

describe('files.txt parser (files-type R2, R9)', () => {
  const h = 'a'.repeat(64);
  test('accepts hashed and bare lines, index.html first', () => {
    const e = parseFilesManifest(`${h}  index.html\nassets/x.png\n${h.toUpperCase()}  LICENSE\n`);
    assert.deepEqual(e.map((x) => x.path), ['index.html', 'assets/x.png', 'LICENSE']);
    assert.equal(e[0].sha256, h);
    assert.equal(e[1].sha256, null);
    assert.equal(e[2].sha256, h);
  });

  test('every rejected form fails the whole manifest', () => {
    const bad = {
      empty: '', blank: 'index.html\n\nb.js\n', abs: 'index.html\n/etc/passwd', parent: 'index.html\n../x', back: 'index.html\na\\b',
      colon: 'index.html\nhttps://x/y', drive: 'index.html\nC:/x', dot: 'index.html\n./a', seg: 'index.html\na//b', ctl: 'index.html\na\u0001b',
      dup: 'index.html\na.js\na.js', first: 'a.js\nindex.html', nul: 'index.html\na\0b'
    };
    for (const [name, text] of Object.entries(bad)) {
      assert.throws(() => parseFilesManifest(text), (e) => e.key === 'err_damaged', name);
    }
  });
});

describe('URLs, types, versions', () => {
  test('R21 assertSafeUrl', () => {
    assertSafeUrl('https://a.example/x');
    assertSafeUrl('http://localhost:5173/x');
    assertSafeUrl('http://127.0.0.1/x');
    for (const u of ['http://a.example/x', 'file:///x', 'javascript:alert(1)', 'x']) assert.throws(() => assertSafeUrl(u), (e) => e.key === 'err_unsafe_url', u);
  });

  test('R10 gameType: type field, .zip fallback, html default, unknown refused', () => {
    assert.equal(gameType({ type: 'files', url: 'https://x/a' }), 'files');
    assert.equal(gameType({ type: 'zip' }), 'zip');
    assert.equal(gameType({ url: 'https://x/a.zip' }), 'zip');
    assert.equal(gameType({ url: 'https://x/a.zip?v=2' }), 'zip');
    assert.equal(gameType({ url: 'https://x/caro' }), 'html');
    assert.throws(() => gameType({ type: 'exe' }), (e) => e.key === 'err_unsupported');
  });

  test('R10 no other file guesses the type from a .zip URL', () => {
    for (const f of readdirSync(new URL('../src/js/', import.meta.url))) {
      if (f === 'safety.js') continue;
      assert.ok(!/endsWith\(['"]\.zip['"]\)|isZip/.test(readFileSync(new URL(`../src/js/${f}`, import.meta.url), 'utf8')), f);
    }
  });

  test('ota R7 only a strictly higher version is newer', () => {
    assert.ok(isNewerVersion('2.3.0', '2.2.9'));
    assert.ok(!isNewerVersion('2.2.0', '2.2.0'));
    assert.ok(!isNewerVersion('2.1.0', '2.2.0'));
    assert.ok(!isNewerVersion('x', '2.2.0'));
    assert.ok(compareVersions('2.10.0', '2.9.0') > 0);
  });

  test('ota R17 normalizeLimit and launcherRange: null, -1, absent, min only, max only, both, invalid, boundaries', () => {
    for (const x of [undefined, null, -1, '-1']) assert.equal(normalizeLimit(x), null);
    assert.equal(normalizeLimit('2.0.0'), '2.0.0');
    assert.equal(normalizeLimit('banana'), null);
    const r = (g, v) => launcherRange(g, v);
    assert.equal(r({}, '2.2.0'), 'ok');
    assert.equal(r({ minLauncher: null, maxLauncher: -1 }, '9.9.9'), 'ok');
    assert.equal(r({ minLauncher: '2.3.0' }, '2.2.0'), 'old');
    assert.equal(r({ minLauncher: '2.2.0' }, '2.2.0'), 'ok', 'inclusive');
    assert.equal(r({ maxLauncher: '2.2.0' }, '2.2.0'), 'ok', 'inclusive');
    assert.equal(r({ maxLauncher: '2.2.0' }, '2.2.1'), 'new');
    assert.equal(r({ minLauncher: '2.0.0', maxLauncher: '3.0.0' }, '2.5.0'), 'ok');
    assert.equal(r({ minLauncher: 'banana' }, '2.2.0'), 'ok');
    assert.equal(r({ minLauncher: '9.0.0' }, null), 'ok', 'unknown launcher version: no limit');
  });
});
