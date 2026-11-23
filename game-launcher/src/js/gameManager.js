import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { appDataDir as tauriAppDataDir, join as tauriJoin } from '@tauri-apps/api/path';
import {
  exists as tauriExists, readTextFile as tauriReadTextFile, writeTextFile as tauriWriteTextFile,
  writeFile as tauriWriteFile, mkdir as tauriMkdir, remove as tauriRemove, rename as tauriRename
} from '@tauri-apps/plugin-fs';
import { convertFileSrc as tauriConvertFileSrc } from '@tauri-apps/api/core';
import { extractZipBundle } from './zipExtractor.js';
import { generateStorageShim, injectStorageShim } from './storageShim.js';
import { LauncherError, assertSafeUrl, parseFilesManifest, unsafePath, gameType, launcherRange } from './safety.js';

export { gameType } from './safety.js';

// Default catalog: this repo's Pages site, deployed together with the apps (game-launcher-hardening R19).
// Any host with the same structure works: change it with setCatalogUrl.
export let CATALOG_URL = 'https://vitran96.github.io/vibe-coded-apps/version.json';

export function setCatalogUrl(url) {
  CATALOG_URL = url;
}

// Version of the running launcher, used for each game's minLauncher / maxLauncher (game-launcher-ota R17).
let launcherVersion = null;
export function setLauncherVersion(v) { launcherVersion = v; }
export function getLauncherVersion() { return launcherVersion; }

// Localized name from version.json `names`, falling back to `name`.
export function getGameName(game, lang = 'vi') {
  return game?.names?.[lang.slice(0, 2)] || game?.name;
}

// The file-system and network calls, replaceable one by one (tests pass customOps).
function io(c = {}) {
  return {
    fetch: c.fetch || tauriFetch,
    appDataDir: c.appDataDir || tauriAppDataDir,
    join: c.join || tauriJoin,
    exists: c.exists || tauriExists,
    readTextFile: c.readTextFile || tauriReadTextFile,
    writeTextFile: c.writeTextFile || tauriWriteTextFile,
    writeFile: c.writeFile || tauriWriteFile,
    mkdir: c.mkdir || tauriMkdir,
    remove: c.remove || tauriRemove,
    rename: c.rename || tauriRename,
    convertFileSrc: c.convertFileSrc || tauriConvertFileSrc
  };
}

export async function getGamesCacheDir(customOps = {}) {
  const o = io(customOps);
  const base = await o.appDataDir();
  const dir = await o.join(base, 'games_cache');
  if (!(await o.exists(dir))) {
    await o.mkdir(dir, { recursive: true });
  }
  return dir;
}

const DEFAULT_SETTINGS = { skipUpdatePrompt: false, globalAutoUpdate: false };

// R13: an unreadable manifest is kept as manifest.json.bad, never silently overwritten by defaults.
export async function getManifest(customOps = {}) {
  const o = io(customOps);
  const dir = await getGamesCacheDir(customOps);
  const manifestPath = await o.join(dir, 'manifest.json');
  if (await o.exists(manifestPath)) {
    try {
      const parsed = JSON.parse(await o.readTextFile(manifestPath));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings }, games: parsed.games || {} };
      }
    } catch {
      // falls through to the backup below
    }
    try {
      const bad = `${manifestPath}.bad`;
      if (await o.exists(bad)) await o.remove(bad);
      await o.rename(manifestPath, bad);
    } catch (err) {
      console.error('Could not keep the unreadable manifest as .bad:', err);
    }
  }
  return { settings: { ...DEFAULT_SETTINGS }, games: {} };
}

// R12: write a temp file, then rename it over manifest.json, so a crash never leaves half a file.
export async function saveManifest(manifest, customOps = {}) {
  const o = io(customOps);
  const dir = await getGamesCacheDir(customOps);
  const manifestPath = await o.join(dir, 'manifest.json');
  const tmpPath = `${manifestPath}.tmp`;
  await o.writeTextFile(tmpPath, JSON.stringify(manifest, null, 2));
  await o.rename(tmpPath, manifestPath);
}

// R14: every manifest change is a fresh read, the change, a save, one at a time.
let manifestQueue = Promise.resolve();
export function updateManifest(change, customOps = {}) {
  const run = manifestQueue.then(async () => {
    const manifest = await getManifest(customOps);
    await change(manifest);
    await saveManifest(manifest, customOps);
    return manifest;
  });
  manifestQueue = run.catch(() => {});
  return run;
}

const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}r=${Date.now()}`;

export async function fetchRemoteCatalog(url = CATALOG_URL, customFetch = null) {
  assertSafeUrl(url);
  const fetchFn = customFetch || tauriFetch;
  let res;
  try {
    res = await fetchFn(bust(url), { headers: { 'Cache-Control': 'no-cache' } });
  } catch (err) {
    throw new LauncherError('err_network', `Catalog fetch failed: ${err?.message || err}`);
  }
  if (!res.ok) throw new LauncherError('err_network', `Catalog fetch failed: ${res.status}`);
  return await res.json();
}

/**
 * Downloads a binary payload with byte-level progress reporting.
 * A transfer cut short (fewer bytes than Content-Length) or an empty body is a failed download (R9).
 */
export async function downloadWithProgress(url, onProgress = () => {}, customFetch = null) {
  const fetchFn = customFetch || tauriFetch;
  let res;
  try {
    res = await fetchFn(url, { headers: { 'Cache-Control': 'no-cache' } });
  } catch (err) {
    throw new LauncherError('err_network', `Could not fetch ${url}: ${err?.message || err}`);
  }
  if (!res.ok) throw new LauncherError('err_network', `HTTP ${res.status} when fetching ${url}`);

  const header = (name) => (res.headers?.get ? res.headers.get(name) : res.headers?.[name]);
  const totalBytes = Number(header('content-length')) || 0;
  // With a compressed transfer the length is that of the compressed bytes, so only plain transfers are compared.
  const encoded = header('content-encoding') && header('content-encoding') !== 'identity';

  let bytes;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      if (totalBytes > 0) {
        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        onProgress(percent);
      } else {
        onProgress(-1);
      }
    }

    bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  } else {
    // ArrayBuffer fallback for node/mock environments
    bytes = new Uint8Array(await res.arrayBuffer());
    onProgress(100);
  }

  if (bytes.length === 0) throw new LauncherError('err_damaged', `Empty download: ${url}`);
  if (totalBytes > 0 && !encoded && bytes.length !== totalBytes) {
    throw new LauncherError('err_damaged', `Cut-off download: ${bytes.length} of ${totalBytes} bytes from ${url}`);
  }
  return bytes;
}

// ---- Integrity: advisory only (R18). A bad hash marks the game with a warning, it never blocks. ----

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 'ok', 'mismatch' or 'unchecked' (nothing to compare, or no crypto in this webview).
export async function integrityOf(bytes, expect = {}) {
  if (!expect.sha256 && !expect.size) return 'unchecked';
  if (expect.size && bytes.length !== expect.size) return 'mismatch';
  if (!expect.sha256) return 'ok';
  try {
    return (await sha256Hex(bytes)) === String(expect.sha256).toLowerCase() ? 'ok' : 'mismatch';
  } catch {
    return 'unchecked';
  }
}

const combineIntegrity = (list) => (list.includes('mismatch') ? 'mismatch' : list.includes('ok') ? 'ok' : 'unchecked');

// R20: on a mismatch try once more with a cache-busting query, then keep what we have and warn.
async function fetchChecked(url, expect, onProgress, o) {
  assertSafeUrl(url);
  let bytes = await downloadWithProgress(url, onProgress, o.fetch);
  let integrity = await integrityOf(bytes, expect);
  if (integrity === 'mismatch') {
    bytes = await downloadWithProgress(bust(url), onProgress, o.fetch);
    integrity = await integrityOf(bytes, expect);
  }
  return { bytes, integrity };
}

// ---- Install ----

const decodeUtf8 = (bytes, what) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new LauncherError('err_damaged', `${what} is not valid UTF-8`);
  }
};

async function ensureDir(o, dir) {
  if (!(await o.exists(dir))) await o.mkdir(dir, { recursive: true });
}

async function removeIfExists(o, path, recursive = false) {
  if (await o.exists(path)) await o.remove(path, recursive ? { recursive: true } : undefined);
}

// files type: files.txt lists every file; each is downloaded to <tmpDir>/<path>.
async function installFiles(game, tmpDir, onProgress, o) {
  const base = game.url.replace(/\/+$/, '');
  const manifest = await fetchChecked(`${base}/files.txt`, { sha256: game.sha256, size: game.size }, () => {}, o);
  const entries = parseFilesManifest(decodeUtf8(manifest.bytes, 'files.txt'));
  const results = [manifest.integrity];
  for (const [i, entry] of entries.entries()) {
    const url = `${base}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
    const { bytes, integrity } = await fetchChecked(url, { sha256: entry.sha256 }, () => {}, o);
    results.push(integrity);
    const target = await o.join(tmpDir, entry.path);
    const parent = entry.path.split('/').slice(0, -1).join('/');
    if (parent) await ensureDir(o, await o.join(tmpDir, parent));
    if (entry.path === 'index.html') {
      await o.writeTextFile(target, injectStorageShim(decodeUtf8(bytes, 'index.html'), game.id));
    } else {
      await o.writeFile(target, bytes);
    }
    onProgress(Math.round(((i + 1) / entries.length) * 100));
  }
  return combineIntegrity(results);
}

/**
 * Installs or updates a game. The new copy is built next to the old one (<id>.tmp or <id>.html.tmp), checked,
 * then swapped in. Any failure leaves the old copy playable (R3, R4, R6).
 */
export async function installOrUpdateGame(game, onProgress = () => {}, customOps = {}) {
  const o = io(customOps);
  const type = gameType(game);
  if (launcherRange(game, customOps.launcherVersion ?? launcherVersion) !== 'ok') {
    throw new LauncherError('err_launcher_range', `${game.id} does not fit this launcher version`);
  }
  assertSafeUrl(game.url);
  const unsafeId = unsafePath(game.id);
  if (unsafeId || game.id.includes('/')) throw new LauncherError('err_damaged', `Unsafe game id: ${game.id}`);

  const cacheDir = await getGamesCacheDir(customOps);
  const dir = await o.join(cacheDir, game.id);
  const tmpDir = await o.join(cacheDir, `${game.id}.tmp`);
  const htmlPath = await o.join(cacheDir, `${game.id}.html`);
  const tmpHtml = `${htmlPath}.tmp`;
  const entryFile = 'index.html';

  onProgress(0);
  let integrity;
  try {
    if (type === 'html') {
      const got = await fetchChecked(game.url, game, onProgress, o);
      integrity = got.integrity;
      await o.writeTextFile(tmpHtml, decodeUtf8(got.bytes, 'The game file'));
      await o.rename(tmpHtml, htmlPath);
    } else {
      await removeIfExists(o, tmpDir, true);
      await o.mkdir(tmpDir, { recursive: true });
      if (type === 'zip') {
        const got = await fetchChecked(game.url, game, onProgress, o);
        integrity = got.integrity;
        await extractZipBundle(got.bytes, tmpDir, game.id, game.entryPoint || entryFile, customOps);
      } else {
        integrity = await installFiles(game, tmpDir, onProgress, o);
      }
      const entryPath = await o.join(tmpDir, game.entryPoint || entryFile);
      if (!(await o.exists(entryPath))) throw new LauncherError('err_damaged', `No ${game.entryPoint || entryFile} in the download`);
      await removeIfExists(o, dir, true);
      await o.rename(tmpDir, dir);
    }
  } catch (err) {
    await removeIfExists(o, tmpDir, true).catch(() => {});
    await removeIfExists(o, tmpHtml).catch(() => {});
    throw err;
  }

  // R6/R7: only now does the manifest change, and the other type's leftovers go.
  const entryPoint = type === 'html' ? undefined : game.entryPoint || entryFile;
  await updateManifest(async (manifest) => {
    const prev = manifest.games[game.id] || { autoUpdate: false };
    if (prev.type && (prev.type === 'html') !== (type === 'html')) {
      if (prev.type === 'html') await removeIfExists(o, htmlPath);
      else await removeIfExists(o, dir, true);
    }
    manifest.games[game.id] = {
      ...prev, version: game.version, type, installed: true, integrity, updatedAt: new Date().toISOString()
    };
    if (entryPoint) manifest.games[game.id].entryPoint = entryPoint;
    else delete manifest.games[game.id].entryPoint;
  }, customOps);
  onProgress(100);
  return { integrity };
}

/**
 * Removes all local game assets and resets installation status
 */
export async function removeGame(gameId, customOps = {}) {
  const o = io(customOps);
  const cacheDir = await getGamesCacheDir(customOps);
  const dirPath = await o.join(cacheDir, gameId);
  const filePath = await o.join(cacheDir, `${gameId}.html`);
  await updateManifest(async (manifest) => {
    const meta = manifest.games[gameId];
    if (!meta) return;
    if (meta.type === 'html') await removeIfExists(o, filePath);
    else await removeIfExists(o, dirPath, true);
    meta.installed = false;
    delete meta.version;
    delete meta.integrity;
  }, customOps);
}

/**
 * Removes all local game assets and resets installation status for all games
 */
export async function removeAllGames(customOps = {}) {
  const manifest = await getManifest(customOps);
  for (const gameId of Object.keys(manifest.games || {})) {
    if (manifest.games[gameId]?.installed) {
      await removeGame(gameId, customOps);
    }
  }
}

/**
 * Prepares launch configuration for iframe. What is installed (manifest type and entry point) decides,
 * not the catalog, so a game still launches when the catalog could not be loaded (R11).
 */
export async function prepareGameForLaunch(game, customOps = {}) {
  const o = io(customOps);
  if (launcherRange(game, customOps.launcherVersion ?? launcherVersion) !== 'ok') {
    throw new LauncherError('err_launcher_range', `${game.id} does not fit this launcher version`);
  }
  const cacheDir = await getGamesCacheDir(customOps);
  const meta = (await getManifest(customOps)).games[game.id];
  const type = meta?.type || gameType(game);

  if (type === 'html') {
    const filePath = await o.join(cacheDir, `${game.id}.html`);
    if (!(await o.exists(filePath))) throw new LauncherError('err_missing', 'Game file missing. Please redownload.');
    const rawHtml = await o.readTextFile(filePath);
    return { mode: 'srcdoc', content: generateStorageShim(game.id) + rawHtml };
  }
  const entryFile = meta?.entryPoint || game.entryPoint || 'index.html';
  if (unsafePath(entryFile)) throw new LauncherError('err_damaged', `Unsafe entry point: ${entryFile}`);
  const entryPath = await o.join(cacheDir, game.id, entryFile);
  if (!(await o.exists(entryPath))) throw new LauncherError('err_missing', 'Game files missing. Please redownload.');
  return { mode: 'url', url: o.convertFileSrc(entryPath) };
}
