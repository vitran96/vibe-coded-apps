import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  getGamesCacheDir,
  getManifest,
  saveManifest,
  downloadWithProgress,
  installOrUpdateGame,
  removeGame,
  prepareGameForLaunch
} from '../src/js/gameManager.js';

describe('Game Manager & Cache Operations', () => {
  function createMockOps() {
    const files = new Map();
    const dirs = new Set(['/mock_appdata']);

    return {
      files,
      dirs,
      ops: {
        appDataDir: async () => '/mock_appdata',
        join: async (...parts) => parts.join('/').replace(/\/+/g, '/'),
        exists: async (p) => dirs.has(p) || files.has(p),
        mkdir: async (p) => { dirs.add(p); },
        readTextFile: async (p) => {
          if (!files.has(p)) throw new Error('File not found: ' + p);
          return files.get(p);
        },
        writeTextFile: async (p, content) => {
          files.set(p, content);
        },
        writeFile: async (p, data) => {
          files.set(p, data);
        },
        remove: async (p) => {
          files.delete(p);
          dirs.delete(p);
        },
        convertFileSrc: (p) => `asset://localhost${p}`
      }
    };
  }

  test('getGamesCacheDir creates cache dir if not exists', async () => {
    const { dirs, ops } = createMockOps();
    const cacheDir = await getGamesCacheDir(ops);
    assert.equal(cacheDir, '/mock_appdata/games_cache');
    assert.ok(dirs.has('/mock_appdata/games_cache'));
  });

  test('getManifest returns defaults if manifest file is missing or invalid', async () => {
    const { ops } = createMockOps();
    const manifest = await getManifest(ops);
    assert.deepEqual(manifest, {
      settings: { skipUpdatePrompt: false, globalAutoUpdate: false },
      games: {}
    });
  });

  test('saveManifest and getManifest serialize and deserialize properly', async () => {
    const { ops } = createMockOps();
    const data = {
      settings: { skipUpdatePrompt: true, globalAutoUpdate: true },
      games: {
        'test-game': { version: '1.2.0', installed: true }
      }
    };
    await saveManifest(data, ops);
    const loaded = await getManifest(ops);
    assert.deepEqual(loaded, data);
  });

  test('downloadWithProgress handles streamed chunks and progress calculation', async () => {
    const chunk1 = new Uint8Array([10, 20]);
    const chunk2 = new Uint8Array([30, 40]);
    let readCount = 0;

    const mockFetch = async () => ({
      ok: true,
      headers: {
        get: (h) => (h === 'content-length' ? '4' : null)
      },
      body: {
        getReader: () => ({
          read: async () => {
            if (readCount === 0) {
              readCount++;
              return { done: false, value: chunk1 };
            }
            if (readCount === 1) {
              readCount++;
              return { done: false, value: chunk2 };
            }
            return { done: true, value: undefined };
          }
        })
      }
    });

    const progressValues = [];
    const result = await downloadWithProgress('https://example.com/game.html', (p) => {
      progressValues.push(p);
    }, mockFetch);

    assert.deepEqual(Array.from(result), [10, 20, 30, 40]);
    assert.ok(progressValues.includes(50));
    assert.ok(progressValues.includes(100));
  });

  test('installOrUpdateGame handles single-file HTML game', async () => {
    const { files, ops } = createMockOps();
    const htmlPayload = new TextEncoder().encode('<html><body>Test HTML Game</body></html>');

    ops.fetch = async () => ({
      ok: true,
      headers: { get: () => String(htmlPayload.length) },
      arrayBuffer: async () => htmlPayload.buffer
    });

    const game = {
      id: 'flappy-test',
      name: 'Flappy Test',
      version: '1.5.0',
      type: 'html',
      url: 'https://example.com/flappy.html'
    };

    let progressCalled = false;
    await installOrUpdateGame(game, (p) => { if (p === 100) progressCalled = true; }, ops);

    assert.ok(progressCalled);
    assert.ok(files.has('/mock_appdata/games_cache/flappy-test.html'));
    assert.equal(files.get('/mock_appdata/games_cache/flappy-test.html'), '<html><body>Test HTML Game</body></html>');

    const manifest = await getManifest(ops);
    assert.equal(manifest.games['flappy-test'].version, '1.5.0');
    assert.equal(manifest.games['flappy-test'].installed, true);
    assert.equal(manifest.games['flappy-test'].type, 'html');
  });

  test('installOrUpdateGame handles ZIP bundle game', async () => {
    const { files, dirs, ops } = createMockOps();

    const zip = new JSZip();
    zip.file('index.html', '<!DOCTYPE html><html><head></head><body>ZIP Game</body></html>');
    zip.file('data.json', '{"ok":true}');
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    ops.fetch = async () => ({
      ok: true,
      headers: { get: () => String(zipBuffer.length) },
      arrayBuffer: async () => zipBuffer.buffer
    });

    const game = {
      id: 'retro-bundle',
      name: 'Retro Bundle',
      version: '2.0.0',
      type: 'zip',
      url: 'https://example.com/bundle.zip',
      entryPoint: 'index.html'
    };

    await installOrUpdateGame(game, () => {}, ops);

    assert.ok(dirs.has('/mock_appdata/games_cache/retro-bundle'));
    assert.ok(files.has('/mock_appdata/games_cache/retro-bundle/index.html'));
    assert.match(files.get('/mock_appdata/games_cache/retro-bundle/index.html'), /__game_retro-bundle__/);

    const manifest = await getManifest(ops);
    assert.equal(manifest.games['retro-bundle'].version, '2.0.0');
    assert.equal(manifest.games['retro-bundle'].installed, true);
    assert.equal(manifest.games['retro-bundle'].type, 'zip');
    assert.equal(manifest.games['retro-bundle'].entryPoint, 'index.html');
  });

  test('removeGame uninstalls files and updates manifest', async () => {
    const { files, dirs, ops } = createMockOps();

    // Setup an installed game in manifest & files
    const manifest = {
      settings: { skipUpdatePrompt: false, globalAutoUpdate: false },
      games: {
        'flappy-test': { version: '1.0.0', type: 'html', installed: true },
        'retro-bundle': { version: '1.0.0', type: 'zip', installed: true }
      }
    };
    await saveManifest(manifest, ops);
    files.set('/mock_appdata/games_cache/flappy-test.html', '<div>game</div>');
    dirs.add('/mock_appdata/games_cache/retro-bundle');

    // Remove HTML game
    await removeGame('flappy-test', ops);
    assert.ok(!files.has('/mock_appdata/games_cache/flappy-test.html'));
    const updated1 = await getManifest(ops);
    assert.equal(updated1.games['flappy-test'].installed, false);
    assert.equal(updated1.games['flappy-test'].version, undefined);

    // Remove ZIP game
    await removeGame('retro-bundle', ops);
    assert.ok(!dirs.has('/mock_appdata/games_cache/retro-bundle'));
    const updated2 = await getManifest(ops);
    assert.equal(updated2.games['retro-bundle'].installed, false);
    assert.equal(updated2.games['retro-bundle'].version, undefined);
  });

  test('prepareGameForLaunch prepares srcdoc or url mode and throws if missing', async () => {
    const { files, ops } = createMockOps();

    const htmlGame = { id: 'game-html', type: 'html' };
    files.set('/mock_appdata/games_cache/game-html.html', '<h1>Game Content</h1>');

    const launchConfigHtml = await prepareGameForLaunch(htmlGame, ops);
    assert.equal(launchConfigHtml.mode, 'srcdoc');
    assert.match(launchConfigHtml.content, /__game_game-html__/);
    assert.match(launchConfigHtml.content, /<h1>Game Content<\/h1>/);

    const zipGame = { id: 'game-zip', type: 'zip', entryPoint: 'main.html' };
    files.set('/mock_appdata/games_cache/game-zip/main.html', '<div>Loaded</div>');

    const launchConfigZip = await prepareGameForLaunch(zipGame, ops);
    assert.equal(launchConfigZip.mode, 'url');
    assert.equal(launchConfigZip.url, 'asset://localhost/mock_appdata/games_cache/game-zip/main.html');

    // Test missing game throws
    await assert.rejects(
      async () => prepareGameForLaunch({ id: 'nonexistent', type: 'html' }, ops),
      /Game file missing/
    );
  });
});

import { getGameName } from '../src/js/gameManager.js';
test('getGameName picks localized name, falls back to name', () => {
  const g = { name: 'Chess', names: { vi: 'Cờ vua' } };
  assert.equal(getGameName(g, 'vi-VN'), 'Cờ vua');
  assert.equal(getGameName(g, 'en-US'), 'Chess');
  assert.equal(getGameName({ name: 'X' }, 'vi'), 'X');
});
