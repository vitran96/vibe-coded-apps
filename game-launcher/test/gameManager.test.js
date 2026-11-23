import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  CATALOG_URL,
  setCatalogUrl,
  getGamesCacheDir,
  getManifest,
  saveManifest,
  updateManifest,
  fetchRemoteCatalog,
  downloadWithProgress,
  installOrUpdateGame,
  removeGame,
  removeAllGames,
  prepareGameForLaunch,
  getGameName,
  integrityOf
} from '../src/js/gameManager.js';
import { createMockOps, createFetch, sha256Hex } from './helpers.js';

const CACHE = '/mock_appdata/games_cache';
const html = (body) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const zipOf = async (entries) => {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(entries)) zip.file(name, data);
  return zip.generateAsync({ type: 'uint8array' });
};

describe('Game Manager & Cache Operations', () => {
  test('getGamesCacheDir creates cache dir if not exists', async () => {
    const { dirs, ops } = createMockOps();
    const cacheDir = await getGamesCacheDir(ops);
    assert.equal(cacheDir, CACHE);
    assert.ok(dirs.has(CACHE));
  });

  test('getManifest returns defaults if manifest file is missing', async () => {
    const { ops } = createMockOps();
    assert.deepEqual(await getManifest(ops), {
      settings: { skipUpdatePrompt: false, globalAutoUpdate: false },
      games: {}
    });
  });

  test('saveManifest and getManifest serialize and deserialize properly', async () => {
    const { ops } = createMockOps();
    const data = {
      settings: { skipUpdatePrompt: true, globalAutoUpdate: true },
      games: { 'test-game': { version: '1.2.0', installed: true } }
    };
    await saveManifest(data, ops);
    assert.deepEqual(await getManifest(ops), data);
  });

  // R12
  test('R12 saveManifest writes manifest.json.tmp, then renames it over manifest.json', async () => {
    const { calls, files, ops } = createMockOps();
    await saveManifest({ settings: {}, games: {} }, ops);
    const w = calls.findIndex((c) => c[0] === 'write' && c[1] === `${CACHE}/manifest.json.tmp`);
    const r = calls.findIndex((c) => c[0] === 'rename' && c[2] === `${CACHE}/manifest.json`);
    assert.ok(w >= 0 && r > w, 'tmp write then rename');
    assert.ok(files.has(`${CACHE}/manifest.json`) && !files.has(`${CACHE}/manifest.json.tmp`));
  });

  // R13
  test('R13 an invalid manifest.json is kept as manifest.json.bad, defaults are used', async () => {
    const { files, ops } = createMockOps();
    files.set(`${CACHE}/manifest.json`, '{ not json');
    const m = await getManifest(ops);
    assert.deepEqual(m.games, {});
    assert.equal(files.get(`${CACHE}/manifest.json.bad`), '{ not json');
    assert.ok(!files.has(`${CACHE}/manifest.json`));
  });

  // R14
  test('R14 two parallel manifest changes both survive', async () => {
    const { ops } = createMockOps();
    await Promise.all([
      updateManifest((m) => { m.games.a = { installed: true }; }, ops),
      updateManifest((m) => { m.games.b = { installed: true }; }, ops),
      updateManifest((m) => { m.settings.language = 'en'; }, ops)
    ]);
    const m = await getManifest(ops);
    assert.ok(m.games.a && m.games.b);
    assert.equal(m.settings.language, 'en');
  });

  test('getGameName picks localized name, falls back to name', () => {
    const g = { name: 'Chess', names: { vi: 'Cờ vua' } };
    assert.equal(getGameName(g), 'Cờ vua');
    assert.equal(getGameName(g, 'vi-VN'), 'Cờ vua');
    assert.equal(getGameName(g, 'en-US'), 'Chess');
    assert.equal(getGameName({ name: 'X' }), 'X');
  });
});

describe('Downloads (R9, R18-R21)', () => {
  test('downloadWithProgress handles streamed chunks and progress calculation', async () => {
    const chunks = [new Uint8Array([10, 20]), new Uint8Array([30, 40])];
    let n = 0;
    const mockFetch = async () => ({
      ok: true,
      headers: { get: (h) => (h === 'content-length' ? '4' : null) },
      body: { getReader: () => ({ read: async () => (n < 2 ? { done: false, value: chunks[n++] } : { done: true }) }) }
    });
    const progress = [];
    const result = await downloadWithProgress('https://example.com/g.html', (p) => progress.push(p), mockFetch);
    assert.deepEqual(Array.from(result), [10, 20, 30, 40]);
    assert.ok(progress.includes(50) && progress.includes(100));
  });

  test('R9 a cut-off transfer fails', async () => {
    const f = createFetch({ 'https://x.test/a': { bytes: 'x'.repeat(60), contentLength: 100 } });
    await assert.rejects(downloadWithProgress('https://x.test/a', () => {}, f), (e) => e.key === 'err_damaged');
  });

  test('R9 an empty body fails; a compressed transfer is not length-checked', async () => {
    const empty = createFetch({ 'https://x.test/a': { bytes: '', contentLength: 0 } });
    await assert.rejects(downloadWithProgress('https://x.test/a', () => {}, empty), (e) => e.key === 'err_damaged');
    const gz = createFetch({ 'https://x.test/a': { bytes: 'abc', contentLength: 99, headers: { 'content-encoding': 'gzip' } } });
    assert.equal((await downloadWithProgress('https://x.test/a', () => {}, gz)).length, 3);
  });

  test('R17 a network or HTTP failure is a plain network error', async () => {
    const f = createFetch({});
    await assert.rejects(downloadWithProgress('https://x.test/none', () => {}, f), (e) => e.key === 'err_network');
    await assert.rejects(downloadWithProgress('https://x.test/none', () => {}, async () => { throw new TypeError('offline'); }), (e) => e.key === 'err_network');
  });

  test('R19 the default catalog is the Pages URL, is replaceable, and requests are no-cache', async () => {
    assert.equal(CATALOG_URL, 'https://vitran96.github.io/vibe-coded-apps/version.json');
    const f = createFetch({ 'https://other.example/cat.json': '{"games":[{"id":"g"}]}' });
    const cat = await fetchRemoteCatalog('https://other.example/cat.json', async (u, i) => {
      assert.equal(i.headers['Cache-Control'], 'no-cache');
      return { ok: true, json: async () => ({ games: [{ id: 'g' }], from: u }) };
    });
    assert.equal(cat.games[0].id, 'g');
    assert.ok(cat.from.startsWith('https://other.example/cat.json?r='));
    setCatalogUrl('https://other.example/cat.json');
    setCatalogUrl('https://vitran96.github.io/vibe-coded-apps/version.json');
    assert.ok(f);
  });

  test('R19 a game from another host installs', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://games.example.org/chess/': html('hi') });
    await installOrUpdateGame({ id: 'chess', version: '1.0.0', type: 'html', url: 'https://games.example.org/chess/' }, () => {}, ops);
    assert.ok(files.has(`${CACHE}/chess.html`));
  });

  test('R21 only https (or http to this computer) is accepted', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({ 'http://localhost:8080/g': html('ok') });
    for (const url of ['http://example.com/g', 'file:///etc/passwd', 'ftp://x/g', 'not a url', '']) {
      await assert.rejects(installOrUpdateGame({ id: 'g', version: '1', type: 'html', url }, () => {}, ops), (e) => e.key === 'err_unsafe_url', url);
    }
    await installOrUpdateGame({ id: 'g', version: '1', type: 'html', url: 'http://localhost:8080/g' }, () => {}, ops);
    await assert.rejects(fetchRemoteCatalog('http://example.com/v.json', createFetch({})), (e) => e.key === 'err_unsafe_url');
  });

  test('R18 integrityOf: ok, mismatch on size or hash, unchecked without fields', async () => {
    const bytes = new TextEncoder().encode('hello');
    assert.equal(await integrityOf(bytes, {}), 'unchecked');
    assert.equal(await integrityOf(bytes, { sha256: await sha256Hex('hello'), size: 5 }), 'ok');
    assert.equal(await integrityOf(bytes, { size: 4 }), 'mismatch');
    assert.equal(await integrityOf(bytes, { sha256: 'a'.repeat(64) }), 'mismatch');
  });
});

describe('Install, update, swap (R3-R8, R18, R20)', () => {
  const game = (extra = {}) => ({ id: 'g', name: 'G', version: '1.0.0', type: 'html', url: 'https://x.test/g', ...extra });

  test('installOrUpdateGame handles a single-file HTML game', async () => {
    const { files, ops } = createMockOps();
    const body = html('Test HTML Game');
    ops.fetch = createFetch({ 'https://x.test/g': body });
    let done = false;
    await installOrUpdateGame(game({ version: '1.5.0' }), (p) => { if (p === 100) done = true; }, ops);
    assert.ok(done);
    assert.equal(files.get(`${CACHE}/g.html`), body);
    assert.ok(!files.has(`${CACHE}/g.html.tmp`));
    const m = (await getManifest(ops)).games.g;
    assert.deepEqual([m.version, m.installed, m.type], ['1.5.0', true, 'html']);
  });

  test('installOrUpdateGame handles a ZIP bundle', async () => {
    const { files, dirs, ops } = createMockOps();
    const bytes = await zipOf({ 'index.html': html('ZIP Game'), 'data.json': '{"ok":true}' });
    ops.fetch = createFetch({ 'https://x.test/b.zip': bytes });
    await installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip', version: '2.0.0' }), () => {}, ops);
    assert.ok(dirs.has(`${CACHE}/g`) && !dirs.has(`${CACHE}/g.tmp`));
    assert.match(files.get(`${CACHE}/g/index.html`), /__game_g__/);
    assert.ok(files.has(`${CACHE}/g/data.json`));
    const m = (await getManifest(ops)).games.g;
    assert.deepEqual([m.version, m.type, m.entryPoint], ['2.0.0', 'zip', 'index.html']);
  });

  // R3, R6
  test('R3/R6 a zip that fails midway leaves the old folder and manifest untouched, no .tmp left', async () => {
    const { files, dirs, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'index.html': html('v1'), 'old.js': '1' }) });
    await installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip' }), () => {}, ops);
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'index.html': html('v2'), 'new.js': '2' }) });
    const failing = { ...ops, writeFile: async (p) => { if (p.endsWith('new.js')) throw new Error('disk full'); } };
    await assert.rejects(installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip', version: '2.0.0' }), () => {}, failing));
    assert.match(files.get(`${CACHE}/g/index.html`), /v1/);
    assert.ok(files.has(`${CACHE}/g/old.js`));
    assert.ok(!dirs.has(`${CACHE}/g.tmp`));
    assert.equal((await getManifest(ops)).games.g.version, '1.0.0');
  });

  test('R3 a zip without its entry point is rejected and the old copy stays', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'index.html': html('v1') }) });
    await installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip' }), () => {}, ops);
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'readme.txt': 'x' }) });
    await assert.rejects(installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip', version: '2.0.0' }), () => {}, ops), (e) => e.key === 'err_damaged');
    assert.match(files.get(`${CACHE}/g/index.html`), /v1/);
  });

  // R4, R6
  test('R4/R6 an html write that fails leaves the old file and manifest unchanged', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/g': html('v1') });
    await installOrUpdateGame(game(), () => {}, ops);
    ops.fetch = createFetch({ 'https://x.test/g': html('v2') });
    const failing = { ...ops, writeTextFile: async () => { throw new Error('disk full'); } };
    await assert.rejects(installOrUpdateGame(game({ version: '2.0.0' }), () => {}, failing));
    assert.equal(files.get(`${CACHE}/g.html`), html('v1'));
    assert.ok(!files.has(`${CACHE}/g.html.tmp`));
    assert.equal((await getManifest(ops)).games.g.version, '1.0.0');
  });

  test('R4 a download that is not valid UTF-8 is refused', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/g': new Uint8Array([0xff, 0xfe, 0xfd]) });
    await assert.rejects(installOrUpdateGame(game(), () => {}, ops), (e) => e.key === 'err_damaged');
  });

  // R5
  test('R5 files the new version no longer ships are gone', async () => {
    const { files, ops } = createMockOps();
    const z = (entries) => ({ type: 'zip', url: 'https://x.test/b.zip', ...entries });
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'index.html': html('1'), 'a.js': 'a' }) });
    await installOrUpdateGame(game(z({ version: '1.0.0' })), () => {}, ops);
    ops.fetch = createFetch({ 'https://x.test/b.zip': await zipOf({ 'index.html': html('2') }) });
    await installOrUpdateGame(game(z({ version: '2.0.0' })), () => {}, ops);
    assert.ok(!files.has(`${CACHE}/g/a.js`));
  });

  // R7
  test('R7 a type change removes the other type\'s leftovers, both ways', async () => {
    const { files, dirs, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/g': html('h'), 'https://x.test/b.zip': await zipOf({ 'index.html': html('z') }) });
    await installOrUpdateGame(game(), () => {}, ops);
    await installOrUpdateGame(game({ type: 'zip', url: 'https://x.test/b.zip', version: '2.0.0' }), () => {}, ops);
    assert.ok(!files.has(`${CACHE}/g.html`) && dirs.has(`${CACHE}/g`));
    await installOrUpdateGame(game({ version: '3.0.0' }), () => {}, ops);
    assert.ok(files.has(`${CACHE}/g.html`) && !dirs.has(`${CACHE}/g`));
  });

  // R8 (the failing-fetch half: nothing is removed before the new copy is complete)
  test('R8 a failed redownload keeps the playable copy', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ 'https://x.test/g': html('v1') });
    await installOrUpdateGame(game(), () => {}, ops);
    ops.fetch = createFetch({});
    await assert.rejects(installOrUpdateGame(game(), () => {}, ops), (e) => e.key === 'err_network');
    assert.equal(files.get(`${CACHE}/g.html`), html('v1'));
    assert.equal((await getManifest(ops)).games.g.installed, true);
  });

  // R18, R20
  test('R18 a wrong hash still installs and marks integrity "mismatch"; right hash "ok"; none "unchecked"', async () => {
    const { files, ops } = createMockOps();
    const body = html('v1');
    ops.fetch = createFetch({ 'https://x.test/g': body });
    await installOrUpdateGame(game({ sha256: 'b'.repeat(64) }), () => {}, ops);
    assert.ok(files.has(`${CACHE}/g.html`));
    assert.equal((await getManifest(ops)).games.g.integrity, 'mismatch');
    await installOrUpdateGame(game({ sha256: await sha256Hex(body), size: body.length }), () => {}, ops);
    assert.equal((await getManifest(ops)).games.g.integrity, 'ok');
    await installOrUpdateGame(game(), () => {}, ops);
    assert.equal((await getManifest(ops)).games.g.integrity, 'unchecked');
  });

  test('R20 a first wrong copy is retried once with a cache-busting query', async () => {
    const { ops } = createMockOps();
    const good = html('good');
    const f = createFetch({ 'https://x.test/g': (n) => (n === 1 ? html('stale') : good) });
    ops.fetch = f;
    await installOrUpdateGame(game({ sha256: await sha256Hex(good) }), () => {}, ops);
    assert.equal(f.seen.length, 2);
    assert.match(f.seen[1].url, /\?r=\d+$/);
    assert.equal((await getManifest(ops)).games.g.integrity, 'ok');
    const bad = createFetch({ 'https://x.test/g': html('always wrong') });
    ops.fetch = bad;
    await installOrUpdateGame(game({ sha256: await sha256Hex(good) }), () => {}, ops);
    assert.equal(bad.seen.length, 2, 'one retry only');
    assert.equal((await getManifest(ops)).games.g.integrity, 'mismatch');
  });

  test('an unknown type is refused, not treated as html', async () => {
    const { ops } = createMockOps();
    await assert.rejects(installOrUpdateGame(game({ type: 'exe' }), () => {}, ops), (e) => e.key === 'err_unsupported');
  });
});

describe('Remove and launch (R11)', () => {
  test('removeGame uninstalls files and updates manifest', async () => {
    const { files, dirs, ops } = createMockOps();
    await saveManifest({
      settings: { skipUpdatePrompt: false, globalAutoUpdate: false },
      games: { 'flappy-test': { version: '1.0.0', type: 'html', installed: true }, 'retro-bundle': { version: '1.0.0', type: 'zip', installed: true } }
    }, ops);
    files.set(`${CACHE}/flappy-test.html`, '<div>game</div>');
    dirs.add(`${CACHE}/retro-bundle`);

    await removeGame('flappy-test', ops);
    assert.ok(!files.has(`${CACHE}/flappy-test.html`));
    let m = await getManifest(ops);
    assert.equal(m.games['flappy-test'].installed, false);
    assert.equal(m.games['flappy-test'].version, undefined);

    await removeGame('retro-bundle', ops);
    assert.ok(!dirs.has(`${CACHE}/retro-bundle`));
    m = await getManifest(ops);
    assert.equal(m.games['retro-bundle'].installed, false);
  });

  test('removeAllGames uninstalls all installed games', async () => {
    const { files, dirs, ops } = createMockOps();
    await saveManifest({
      settings: {},
      games: { a: { version: '1', type: 'html', installed: true }, b: { version: '1', type: 'files', installed: true } }
    }, ops);
    files.set(`${CACHE}/a.html`, 'x');
    dirs.add(`${CACHE}/b`);
    files.set(`${CACHE}/b/index.html`, 'x');
    await removeAllGames(ops);
    assert.ok(!files.has(`${CACHE}/a.html`) && !dirs.has(`${CACHE}/b`) && !files.has(`${CACHE}/b/index.html`));
    const m = await getManifest(ops);
    assert.equal(m.games.a.installed, false);
    assert.equal(m.games.b.installed, false);
  });

  test('prepareGameForLaunch prepares srcdoc or url mode and throws if missing', async () => {
    const { files, ops } = createMockOps();
    files.set(`${CACHE}/game-html.html`, '<h1>Game Content</h1>');
    const h = await prepareGameForLaunch({ id: 'game-html', type: 'html' }, ops);
    assert.equal(h.mode, 'srcdoc');
    assert.match(h.content, /__game_game-html__/);
    assert.match(h.content, /<h1>Game Content<\/h1>/);

    files.set(`${CACHE}/game-zip/main.html`, '<div>Loaded</div>');
    const z = await prepareGameForLaunch({ id: 'game-zip', type: 'zip', entryPoint: 'main.html' }, ops);
    assert.equal(z.mode, 'url');
    assert.equal(z.url, `asset://localhost${CACHE}/game-zip/main.html`);

    await assert.rejects(prepareGameForLaunch({ id: 'nonexistent', type: 'html' }, ops), /Game file missing/);
    await assert.rejects(prepareGameForLaunch({ id: 'nonexistent', type: 'html' }, ops), (e) => e.key === 'err_missing');
  });

  test('prepareGameForLaunch passes an import map with a data: URL through srcdoc unchanged', async () => {
    const { files, ops } = createMockOps();
    const raw = '<!doctype html><script type="importmap">{"imports":{"three":"data:text/javascript;base64,ZXhwb3J0IGNvbnN0IHg9MTs="}}</script><script type="module">import "three";</script>';
    files.set(`${CACHE}/game-map.html`, raw);
    const config = await prepareGameForLaunch({ id: 'game-map', type: 'html' }, ops);
    assert.ok(config.content.endsWith(raw));
  });

  // R11
  test('R11 launch uses the installed type and entry point, not the catalog', async () => {
    const { files, ops } = createMockOps();
    await saveManifest({ settings: {}, games: { g: { type: 'zip', entryPoint: 'play.html', installed: true, version: '1' } } }, ops);
    files.set(`${CACHE}/g/play.html`, 'x');
    const cfg = await prepareGameForLaunch({ id: 'g', name: 'offline catalog entry without type or entryPoint', url: '' }, ops);
    assert.equal(cfg.url, `asset://localhost${CACHE}/g/play.html`);
  });
});
