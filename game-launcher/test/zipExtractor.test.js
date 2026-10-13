import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extractZipBundle } from '../src/js/zipExtractor.js';

describe('ZIP Extractor', () => {
  test('extracts zip bundle and injects storage shim into <head>', async () => {
    const zip = new JSZip();
    zip.file('index.html', '<!DOCTYPE html><html><head><title>My Game</title></head><body><h1>Play</h1></body></html>');
    zip.file('assets/data.bin', new Uint8Array([1, 2, 3, 4]));
    zip.file('scripts/main.js', 'console.log("hello");');

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    const createdDirs = new Set();
    const writtenFiles = new Map();

    const mockOps = {
      exists: async (path) => createdDirs.has(path) || writtenFiles.has(path),
      mkdir: async (path) => { createdDirs.add(path); },
      writeFile: async (path, data) => { writtenFiles.set(path, data); },
      writeTextFile: async (path, text) => { writtenFiles.set(path, text); },
      join: async (...parts) => parts.join('/').replace(/\/+/g, '/')
    };

    await extractZipBundle(zipBuffer, '/appdata/games_cache/rpg-game', 'rpg-game', 'index.html', mockOps);

    // Verify directory creation
    assert.ok(createdDirs.has('/appdata/games_cache/rpg-game'));
    assert.ok(createdDirs.has('/appdata/games_cache/rpg-game/assets'));
    assert.ok(createdDirs.has('/appdata/games_cache/rpg-game/scripts'));

    // Verify index.html contains shim inside head
    const indexContent = writtenFiles.get('/appdata/games_cache/rpg-game/index.html');
    assert.ok(indexContent);
    assert.match(indexContent, /<head>\s*<script id="__storage_shim__">/);
    assert.match(indexContent, /__game_rpg-game__/);

    // Verify binary asset written as Uint8Array
    const binContent = writtenFiles.get('/appdata/games_cache/rpg-game/assets/data.bin');
    assert.ok(binContent instanceof Uint8Array);
    assert.deepEqual(Array.from(binContent), [1, 2, 3, 4]);

    // Verify script asset
    const scriptContent = writtenFiles.get('/appdata/games_cache/rpg-game/scripts/main.js');
    assert.ok(scriptContent instanceof Uint8Array);
  });

  test('prepends shim when <head> tag is absent in entry point', async () => {
    const zip = new JSZip();
    zip.file('entry.html', '<div>Simple game without head tag</div>');
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    const createdDirs = new Set();
    const writtenFiles = new Map();

    const mockOps = {
      exists: async () => true,
      mkdir: async () => {},
      writeFile: async (path, data) => { writtenFiles.set(path, data); },
      writeTextFile: async (path, text) => { writtenFiles.set(path, text); },
      join: async (...parts) => parts.join('/').replace(/\/+/g, '/')
    };

    await extractZipBundle(zipBuffer, '/cache/simple', 'simple-game', 'entry.html', mockOps);

    const content = writtenFiles.get('/cache/simple/entry.html');
    assert.ok(content);
    assert.ok(content.startsWith('\n    <script id="__storage_shim__">'));
    assert.match(content, /<div>Simple game without head tag<\/div>/);
  });
});
