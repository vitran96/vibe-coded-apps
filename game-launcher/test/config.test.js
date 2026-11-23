import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getManifest, prepareGameForLaunch, removeGame } from '../src/js/gameManager.js';
import { createMockOps } from './helpers.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const conf = JSON.parse(read('src-tauri/tauri.conf.json'));

// specs/game-launcher-ota.md R1, R3, R4, R6
describe('Tauri packaging and updater configuration', () => {
  test('R1 Windows is NSIS for the current user only; no MSI and no .deb; Linux is the AppImage', () => {
    assert.deepEqual(conf.bundle.targets, ['nsis', 'appimage']);
    assert.equal(conf.bundle.windows.nsis.installMode, 'currentUser');
  });

  test('R3 the app identity (and so the data folder) is unchanged since 2.2.0', () => {
    assert.equal(conf.identifier, 'com.vi-tran.tauri-app');
  });

  test('R3 a manifest written by the previous launcher version still loads, launches and removes', async () => {
    const { files, ops } = createMockOps();
    const old = { settings: { skipUpdatePrompt: false, globalAutoUpdate: false, language: 'vi' }, games: { caro: { version: '2.2.0', type: 'html', installed: true, autoUpdate: true, updatedAt: '2026-11-21T00:00:00.000Z' } } };
    files.set('/mock_appdata/games_cache/manifest.json', JSON.stringify(old));
    files.set('/mock_appdata/games_cache/caro.html', '<h1>caro</h1>');
    const m = await getManifest(ops);
    assert.equal(m.games.caro.version, '2.2.0');
    assert.equal((await prepareGameForLaunch({ id: 'caro', url: '' }, ops)).mode, 'srcdoc');
    await removeGame('caro', ops);
    assert.equal((await getManifest(ops)).games.caro.installed, false);
  });

  test('R4 the feed is the latest.json of the newest release, set once in the config', () => {
    const u = conf.plugins.updater;
    assert.equal(u.endpoints.length, 1);
    assert.match(u.endpoints[0], /^https:\/\/github\.com\/[\w-]+\/vibe-coded-apps\/releases\/latest\/download\/latest\.json$/);
    assert.equal(conf.bundle.createUpdaterArtifacts, false, 'default build needs no signing key');
    assert.equal(JSON.parse(read('src-tauri/tauri.signed.conf.json')).bundle.createUpdaterArtifacts, true, 'the signed build turns it on');
  });

  test('R6 a public key is configured, and no private key is in the repo', () => {
    const pub = Buffer.from(conf.plugins.updater.pubkey, 'base64').toString('utf8');
    assert.match(pub, /^untrusted comment: minisign public key/);
    const root = new URL('../../', import.meta.url).pathname;
    const skip = new Set(['node_modules', '.git', '.jj', 'target', 'dist', 'archived']);
    const walk = (dir) => readdirSync(dir).flatMap((n) => {
      if (skip.has(n)) return [];
      const p = join(dir, n);
      const st = statSync(p);
      return st.isDirectory() ? walk(p) : st.size < 200000 ? [p] : [];
    });
    const secretMarker = ['untrusted comment:', 'rsign encrypted secret key'].join(' '); // built here so this file does not match itself
    for (const f of walk(root)) {
      assert.ok(!readFileSync(f, 'utf8').includes(secretMarker), f);
    }
  });

  test('R4/R12 plugins and permissions are wired: Cargo, lib.rs, npm, capabilities', () => {
    const cargo = read('src-tauri/Cargo.toml');
    assert.match(cargo, /tauri-plugin-updater = "2"/);
    assert.match(cargo, /tauri-plugin-process = "2"/);
    const lib = read('src-tauri/src/lib.rs');
    assert.match(lib, /tauri_plugin_updater::Builder::new\(\)\.build\(\)/);
    assert.match(lib, /tauri_plugin_process::init\(\)/);
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.dependencies['@tauri-apps/plugin-updater'] && pkg.dependencies['@tauri-apps/plugin-process']);
    const caps = JSON.parse(read('src-tauri/capabilities/default.json')).permissions;
    assert.ok(caps.includes('updater:default') && caps.includes('process:allow-restart'));
  });

  test('licensing R9 the license ships: installer license page, bundled resource', () => {
    assert.equal(conf.bundle.licenseFile, '../LICENSE');
    assert.equal(conf.bundle.resources['../LICENSE'], 'LICENSE');
  });
});
