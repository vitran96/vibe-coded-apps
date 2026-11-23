#!/usr/bin/env node
// Writes latest.json, the feed the launcher's updater reads (spec game-launcher-ota R4, R5).
// Usage: node scripts/make-latest-json.mjs <dir with the release files> <tag> [notes]
// Env:   GITHUB_REPOSITORY (owner/name). Reads the version from src-tauri/tauri.conf.json.
// Each platform needs the signed bundle and its .sig, named as the build workflow renames them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// platform key -> bundle file name for a version (the build workflow's names)
export const PLATFORMS = {
  'windows-x86_64': (v) => `game-launcher-installer-${v}.exe`,
  'linux-x86_64': (v) => `game-launcher-${v}.AppImage`
};

// Pure: the feed object for the files present in `files` (name -> signature text).
export function buildLatest({ version, tag, repo, notes = '', pubDate = new Date().toISOString(), sigs }) {
  const platforms = {};
  for (const [key, nameOf] of Object.entries(PLATFORMS)) {
    const file = nameOf(version);
    const signature = sigs[file];
    if (!signature) continue;
    platforms[key] = { signature: signature.trim(), url: `https://github.com/${repo}/releases/download/${tag}/${file}` };
  }
  if (!Object.keys(platforms).length) throw new Error('no signed bundle found: nothing to publish in latest.json');
  return { version, notes, pub_date: pubDate, platforms };
}

function main() {
  const [dir, tag, notes = ''] = process.argv.slice(2);
  if (!dir || !tag) { console.error('Usage: node scripts/make-latest-json.mjs <dir> <tag> [notes]'); process.exit(2); }
  const version = JSON.parse(readFileSync(join(HERE, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;
  const sigs = {};
  for (const nameOf of Object.values(PLATFORMS)) {
    const file = nameOf(version);
    const p = join(dir, `${file}.sig`);
    if (existsSync(p)) sigs[file] = readFileSync(p, 'utf8');
  }
  // Signing is optional: an unsigned release has no feed, and installed launchers just find nothing to update to.
  if (!Object.keys(sigs).length) { console.log('No signed bundle: skipping latest.json (unsigned release).'); return; }
  const feed = buildLatest({ version, tag, repo: process.env.GITHUB_REPOSITORY || 'vitran96/vibe-coded-apps', notes, sigs });
  writeFileSync(join(dir, 'latest.json'), JSON.stringify(feed, null, 2) + '\n');
  console.log(`latest.json: ${version}, platforms ${Object.keys(feed.platforms).join(', ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
