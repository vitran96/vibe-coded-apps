import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { appDataDir as tauriAppDataDir, join as tauriJoin } from '@tauri-apps/api/path';
import { exists as tauriExists, readTextFile as tauriReadTextFile, writeTextFile as tauriWriteTextFile, mkdir as tauriMkdir, remove as tauriRemove } from '@tauri-apps/plugin-fs';
import { convertFileSrc as tauriConvertFileSrc } from '@tauri-apps/api/core';
import { extractZipBundle } from './zipExtractor.js';
import { generateStorageShim } from './storageShim.js';

export let CATALOG_URL = 'https://raw.githubusercontent.com/vitran96/vibe-coded-apps/main/version.json';

export function setCatalogUrl(url) {
  CATALOG_URL = url;
}

// Localized name from version.json `names`, falling back to `name`.
export function getGameName(game, lang = globalThis.navigator?.language || 'en') {
  return game.names?.[lang.slice(0, 2)] || game.name;
}

export async function getGamesCacheDir(customOps = {}) {
  const getAppDir = customOps.appDataDir || tauriAppDataDir;
  const join = customOps.join || tauriJoin;
  const exists = customOps.exists || tauriExists;
  const mkdir = customOps.mkdir || tauriMkdir;

  const base = await getAppDir();
  const dir = await join(base, 'games_cache');
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function getManifest(customOps = {}) {
  const exists = customOps.exists || tauriExists;
  const readTextFile = customOps.readTextFile || tauriReadTextFile;
  const join = customOps.join || tauriJoin;

  const dir = await getGamesCacheDir(customOps);
  const manifestPath = await join(dir, 'manifest.json');
  if (await exists(manifestPath)) {
    try {
      const content = await readTextFile(manifestPath);
      return JSON.parse(content);
    } catch {
      // Fallback on parse failure
    }
  }
  return {
    settings: { skipUpdatePrompt: false, globalAutoUpdate: false },
    games: {}
  };
}

export async function saveManifest(manifest, customOps = {}) {
  const writeTextFile = customOps.writeTextFile || tauriWriteTextFile;
  const join = customOps.join || tauriJoin;

  const dir = await getGamesCacheDir(customOps);
  const manifestPath = await join(dir, 'manifest.json');
  await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function fetchRemoteCatalog(url = CATALOG_URL, customFetch = null) {
  const fetchFn = customFetch || tauriFetch;
  const res = await fetchFn(url, {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return await res.json();
}

/**
 * Downloads binary payload with byte-level progress reporting
 */
export async function downloadWithProgress(url, onProgress = () => {}, customFetch = null) {
  const fetchFn = customFetch || tauriFetch;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${url}`);

  const totalBytes = Number(res.headers?.get ? res.headers.get('content-length') : (res.headers && res.headers['content-length'])) || 0;
  
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

    const concatenated = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }
    return concatenated;
  } else {
    // ArrayBuffer fallback for node/mock environments
    const buf = await res.arrayBuffer();
    onProgress(100);
    return new Uint8Array(buf);
  }
}

/**
 * Installs or updates a game by downloading and caching
 */
export async function installOrUpdateGame(game, onProgress = () => {}, customOps = {}) {
  const isZip = game.type === 'zip' || (game.url && game.url.endsWith('.zip'));
  const cacheDir = await getGamesCacheDir(customOps);
  const manifest = await getManifest(customOps);
  const currentMeta = manifest.games[game.id] || { autoUpdate: false };

  const join = customOps.join || tauriJoin;
  const writeTextFile = customOps.writeTextFile || tauriWriteTextFile;

  onProgress(0);
  const bytes = await downloadWithProgress(game.url, onProgress, customOps.fetch);

  if (isZip) {
    const gameDir = await join(cacheDir, game.id);
    const entryFile = game.entryPoint || 'index.html';
    await extractZipBundle(bytes, gameDir, game.id, entryFile, customOps);

    manifest.games[game.id] = {
      ...currentMeta,
      version: game.version,
      type: 'zip',
      installed: true,
      entryPoint: entryFile,
      updatedAt: new Date().toISOString()
    };
  } else {
    const filePath = await join(cacheDir, `${game.id}.html`);
    const htmlText = new TextDecoder('utf-8').decode(bytes);
    await writeTextFile(filePath, htmlText);

    manifest.games[game.id] = {
      ...currentMeta,
      version: game.version,
      type: 'html',
      installed: true,
      updatedAt: new Date().toISOString()
    };
  }

  await saveManifest(manifest, customOps);
  onProgress(100);
}

/**
 * Removes all local game assets and resets installation status
 */
export async function removeGame(gameId, customOps = {}) {
  const cacheDir = await getGamesCacheDir(customOps);
  const manifest = await getManifest(customOps);
  const meta = manifest.games[gameId];

  const join = customOps.join || tauriJoin;
  const exists = customOps.exists || tauriExists;
  const remove = customOps.remove || tauriRemove;

  if (meta) {
    if (meta.type === 'zip') {
      const dirPath = await join(cacheDir, gameId);
      if (await exists(dirPath)) {
        await remove(dirPath, { recursive: true });
      }
    } else {
      const filePath = await join(cacheDir, `${gameId}.html`);
      if (await exists(filePath)) {
        await remove(filePath);
      }
    }

    meta.installed = false;
    delete meta.version;
    await saveManifest(manifest, customOps);
  }
}

/**
 * Prepares launch configuration for iframe
 */
export async function prepareGameForLaunch(game, customOps = {}) {
  const cacheDir = await getGamesCacheDir(customOps);
  const isZip = game.type === 'zip' || (game.url && game.url.endsWith('.zip'));

  const join = customOps.join || tauriJoin;
  const exists = customOps.exists || tauriExists;
  const readTextFile = customOps.readTextFile || tauriReadTextFile;
  const convertFileSrc = customOps.convertFileSrc || tauriConvertFileSrc;

  if (isZip) {
    const entryFile = game.entryPoint || 'index.html';
    const entryPath = await join(cacheDir, game.id, entryFile);
    if (!(await exists(entryPath))) throw new Error("Game files missing. Please redownload.");
    return { mode: 'url', url: convertFileSrc(entryPath) };
  } else {
    const filePath = await join(cacheDir, `${game.id}.html`);
    if (!(await exists(filePath))) throw new Error("Game file missing. Please redownload.");
    const rawHtml = await readTextFile(filePath);
    const shim = generateStorageShim(game.id);
    return { mode: 'srcdoc', content: shim + rawHtml };
  }
}
