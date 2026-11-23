// Shared safety rules: errors the player can read, path and URL checks, manifest parsing, version math.
// Specs: game-launcher-hardening (R1, R2, R17, R21), game-launcher-files-type (R9), game-launcher-ota (R7, R17, R18).

// An error with an i18n key (err_*) the player sees; `message` stays English for the console.
export class LauncherError extends Error {
  constructor(key, message = key) {
    super(message);
    this.name = 'LauncherError';
    this.key = key;
  }
}

// R1/R2: why a path from an archive or manifest is unsafe, or null when it is fine.
export function unsafePath(p) {
  if (typeof p !== 'string' || p === '') return 'empty';
  if (p.includes('\0')) return 'NUL';
  if (p.includes('\\')) return 'backslash';
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return 'absolute';
  if (p.split('/').includes('..')) return 'parent folder';
  return null;
}

// R21: only https, or plain http to this computer (local testing).
export function assertSafeUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new LauncherError('err_unsafe_url', `Not a valid URL: ${url}`); }
  const local = u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) throw new LauncherError('err_unsafe_url', `Refused URL scheme: ${u.protocol}`);
  return u;
}

const HASH_LINE = /^([0-9a-fA-F]{64}) {2}(.+)$/;

// files-type R2/R9: `<sha256>  <path>` or a bare `<path>` per line. One bad line fails the whole manifest.
export function parseFilesManifest(text) {
  const lines = text.replace(/^﻿/, '').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (!lines.length) throw new LauncherError('err_damaged', 'files.txt is empty');
  const seen = new Set();
  const entries = lines.map((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const m = line.match(HASH_LINE);
    const path = m ? m[2] : line;
    const why = unsafePath(path)
      || (/[\x00-\x1f]/.test(path) && 'control character')
      || (path.includes(':') && 'colon')
      || (path.split('/').some((s) => s === '' || s === '.') && 'empty or dot segment')
      || (seen.has(path) && 'duplicate');
    if (why) throw new LauncherError('err_damaged', `files.txt line ${i + 1} (${path.slice(0, 60)}): ${why}`);
    seen.add(path);
    return { path, sha256: m ? m[1].toLowerCase() : null };
  });
  if (entries[0].path !== 'index.html') throw new LauncherError('err_damaged', 'files.txt line 1 must be index.html');
  return entries;
}

const SEMVER = /^\d+\.\d+\.\d+$/;
export const isSemver = (v) => typeof v === 'string' && SEMVER.test(v);

export function compareVersions(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// ota R7: strictly higher only, never a downgrade.
export const isNewerVersion = (remote, current) => isSemver(remote) && isSemver(current) && compareVersions(remote, current) > 0;

// ota R17: absent, null or -1 means no limit; anything else that is not x.y.z is ignored with a warning.
export function normalizeLimit(x) {
  if (x === undefined || x === null || x === -1 || x === '-1') return null;
  if (isSemver(x)) return x;
  console.warn(`Ignoring invalid launcher version limit: ${x}`);
  return null;
}

// ota R17/R18: 'ok', 'old' (launcher below minLauncher: update the launcher) or 'new' (launcher above maxLauncher).
export function launcherRange(game, launcherVersion) {
  if (!isSemver(launcherVersion)) return 'ok';
  const lo = normalizeLimit(game?.minLauncher), hi = normalizeLimit(game?.maxLauncher);
  if (lo && compareVersions(launcherVersion, lo) < 0) return 'old';
  if (hi && compareVersions(launcherVersion, hi) > 0) return 'new';
  return 'ok';
}

// The install type of a catalog entry: `type`, or `.zip` in the URL when there is no `type`. Unknown types are refused.
export function gameType(game) {
  const type = game?.type || (/\.zip(\?|$)/i.test(game?.url || '') ? 'zip' : 'html');
  if (!['html', 'zip', 'files'].includes(type)) throw new LauncherError('err_unsupported', `Unknown game type: ${type}`);
  return type;
}
