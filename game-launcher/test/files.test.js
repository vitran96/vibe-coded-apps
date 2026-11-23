import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installOrUpdateGame, prepareGameForLaunch, removeGame, getManifest, setLauncherVersion } from '../src/js/gameManager.js';
import { createMockOps, createFetch, sha256Hex } from './helpers.js';

const CACHE = '/mock_appdata/games_cache';
const BASE = 'https://host.example/vibe/chess';
const game = (extra = {}) => ({ id: 'chess', name: 'Chess', version: '1.0.0', type: 'files', url: BASE, ...extra });
const page = '<!doctype html><html><head></head><body>files game</body></html>';

async function manifestFor(entries, hashed = true) {
  const lines = [];
  for (const [path, data] of entries) lines.push(hashed ? `${await sha256Hex(data)}  ${path}` : path);
  return lines.join('\n') + '\n';
}

describe('files type (files-type R6-R16)', () => {
  test('R10/R11/R12/R13 installs every listed file, reports files done/total, injects the shim, records the entry', async () => {
    const { files, ops } = createMockOps();
    const entries = [['index.html', page], ['LICENSE', 'MIT'], ['assets/a b.png', 'PNG'], ['assets/s/x.mp3', 'MP3']];
    const f = createFetch({
      [`${BASE}/files.txt`]: await manifestFor(entries),
      [`${BASE}/index.html`]: page, [`${BASE}/LICENSE`]: 'MIT', [`${BASE}/assets/a%20b.png`]: 'PNG', [`${BASE}/assets/s/x.mp3`]: 'MP3'
    });
    ops.fetch = f;
    const progress = [];
    await installOrUpdateGame(game(), (p) => progress.push(p), ops);

    assert.deepEqual(f.seen.map((s) => s.url), [`${BASE}/files.txt`, `${BASE}/index.html`, `${BASE}/LICENSE`, `${BASE}/assets/a%20b.png`, `${BASE}/assets/s/x.mp3`]);
    assert.deepEqual(progress.filter((p) => p > 0 && p < 100), [25, 50, 75]);
    assert.equal(progress.at(-1), 100);
    assert.match(files.get(`${CACHE}/chess/index.html`), /<head>\s*<script id="__storage_shim__">/);
    assert.match(files.get(`${CACHE}/chess/index.html`), /__game_chess__/);
    assert.ok(files.has(`${CACHE}/chess/assets/a b.png`) && files.has(`${CACHE}/chess/assets/s/x.mp3`));
    const m = (await getManifest(ops)).games.chess;
    assert.deepEqual([m.type, m.entryPoint, m.installed, m.version, m.integrity], ['files', 'index.html', true, '1.0.0', 'ok']);
  });

  test('R6 a trailing slash on url is the same', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ [`${BASE}/files.txt`]: await manifestFor([['index.html', page]]), [`${BASE}/index.html`]: page });
    await installOrUpdateGame(game({ url: `${BASE}/` }), () => {}, ops);
    assert.ok(files.has(`${CACHE}/chess/index.html`));
  });

  test('R9 a bad manifest line writes nothing and downloads no file', async () => {
    for (const bad of ['index.html\n../evil\n', 'index.html\n/abs\n', 'a.js\n', 'index.html\nx\\y\n', 'index.html\nhttps://e.com/x\n']) {
      const { files, dirs, ops } = createMockOps();
      const f = createFetch({ [`${BASE}/files.txt`]: bad, [`${BASE}/index.html`]: page });
      ops.fetch = f;
      await assert.rejects(installOrUpdateGame(game(), () => {}, ops), (e) => e.key === 'err_damaged', bad);
      assert.equal(f.seen.length, 1, 'only files.txt was fetched');
      assert.ok(![...files.keys()].some((k) => k.startsWith(`${CACHE}/chess`)));
      assert.ok(![...dirs].some((d) => d.startsWith(`${CACHE}/chess`)));
    }
  });

  test('R13 a failing file leaves the game not installed and no folder behind', async () => {
    const { dirs, ops } = createMockOps();
    ops.fetch = createFetch({ [`${BASE}/files.txt`]: await manifestFor([['index.html', page], ['assets/a.png', 'PNG']]), [`${BASE}/index.html`]: page });
    await assert.rejects(installOrUpdateGame(game(), () => {}, ops), (e) => e.key === 'err_network');
    assert.ok(!dirs.has(`${CACHE}/chess`) && !dirs.has(`${CACHE}/chess.tmp`));
    assert.ok(!(await getManifest(ops)).games.chess);
  });

  test('R18 a wrong per-file hash warns but installs; bare lines are unchecked', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({
      [`${BASE}/files.txt`]: `${'0'.repeat(64)}  index.html\n`, [`${BASE}/index.html`]: page
    });
    await installOrUpdateGame(game(), () => {}, ops);
    assert.ok(files.has(`${CACHE}/chess/index.html`));
    assert.equal((await getManifest(ops)).games.chess.integrity, 'mismatch');

    const second = createMockOps();
    second.ops.fetch = createFetch({ [`${BASE}/files.txt`]: 'index.html\n', [`${BASE}/index.html`]: page });
    await installOrUpdateGame(game(), () => {}, second.ops);
    assert.equal((await getManifest(second.ops)).games.chess.integrity, 'unchecked');
  });

  test('R18 the catalog hash of files.txt is checked too', async () => {
    const { ops } = createMockOps();
    const text = await manifestFor([['index.html', page]]);
    ops.fetch = createFetch({ [`${BASE}/files.txt`]: text, [`${BASE}/index.html`]: page });
    await installOrUpdateGame(game({ sha256: await sha256Hex(text), size: text.length }), () => {}, ops);
    assert.equal((await getManifest(ops)).games.chess.integrity, 'ok');
    await installOrUpdateGame(game({ sha256: '1'.repeat(64) }), () => {}, ops);
    assert.equal((await getManifest(ops)).games.chess.integrity, 'mismatch');
  });

  test('R14/R15 launch config is an asset URL; remove deletes the whole folder', async () => {
    const { files, dirs, ops } = createMockOps();
    ops.fetch = createFetch({ [`${BASE}/files.txt`]: await manifestFor([['index.html', page], ['assets/a.png', 'P']]), [`${BASE}/index.html`]: page, [`${BASE}/assets/a.png`]: 'P' });
    await installOrUpdateGame(game(), () => {}, ops);
    const cfg = await prepareGameForLaunch({ id: 'chess', name: 'Chess', url: '' }, ops);
    assert.deepEqual(cfg, { mode: 'url', url: `asset://localhost${CACHE}/chess/index.html` });
    await removeGame('chess', ops);
    assert.ok(!dirs.has(`${CACHE}/chess`) && ![...files.keys()].some((k) => k.startsWith(`${CACHE}/chess/`)));
    await assert.rejects(prepareGameForLaunch(game(), ops), (e) => e.key === 'err_missing');
  });

  test('R6 an entry with type files is not mistaken for zip or html (and unknown types fail)', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({});
    await assert.rejects(installOrUpdateGame(game({ type: 'tarball' }), () => {}, ops), (e) => e.key === 'err_unsupported');
  });
});

describe('launcher version range (ota R17, R18)', () => {
  test('a game outside the range cannot be installed or launched; inside it can', async () => {
    const { files, ops } = createMockOps();
    ops.fetch = createFetch({ [`${BASE}/files.txt`]: await manifestFor([['index.html', page]]), [`${BASE}/index.html`]: page });
    ops.launcherVersion = '2.2.0';
    await assert.rejects(installOrUpdateGame(game({ minLauncher: '2.3.0' }), () => {}, ops), (e) => e.key === 'err_launcher_range');
    await assert.rejects(installOrUpdateGame(game({ maxLauncher: '2.1.9' }), () => {}, ops), (e) => e.key === 'err_launcher_range');
    assert.ok(![...files.keys()].some((k) => k.includes('chess')));
    await installOrUpdateGame(game({ minLauncher: '2.2.0', maxLauncher: '2.2.0' }), () => {}, ops);
    await installOrUpdateGame(game({ minLauncher: -1, maxLauncher: null }), () => {}, ops);
    await assert.rejects(prepareGameForLaunch(game({ maxLauncher: '2.0.0' }), ops), (e) => e.key === 'err_launcher_range');
    assert.ok(setLauncherVersion);
  });
});
