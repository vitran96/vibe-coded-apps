#!/usr/bin/env node
// Writes game-launcher/LICENSE: the repo MIT text plus a notice for every dependency that ships in the binary.
// Zero dependencies. Reads package-lock.json + node_modules and src-tauri/Cargo.lock + the cargo source cache.
// Usage: node scripts/gen-license.mjs          write LICENSE
//        node scripts/gen-license.mjs --check  fail when LICENSE is stale (used by npm test)
// Spec: specs/licensing.md R7, R8, R10.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(HERE, '..');
export const LICENSE_PATH = join(HERE, 'LICENSE');

// Build tools that are listed under "dependencies" but never reach the app (Vite bundles from them, it does not include them).
const BUILD_ONLY = new Set(['vite']);

// R8: permissive licenses only. A package with another license stops the generator so it is a conscious decision.
export const ALLOWED = new Set([
  'MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', 'Unicode-3.0', 'Unicode-DFS-2016',
  'OFL-1.1', 'MPL-2.0', '0BSD', 'CC0-1.0', 'Unlicense', 'BSL-1.0', 'CDLA-Permissive-2.0'
]);

// ---- SPDX expressions: the allowed option of an OR, every part of an AND ----

function tokens(expr) {
  return expr.replace(/\//g, ' OR ').replace(/([()])/g, ' $1 ').split(/\s+/).filter(Boolean);
}

// Returns the list of licenses we comply with, or null when no allowed combination exists.
export function pickLicense(expr) {
  const tk = tokens(String(expr || ''));
  let i = 0;
  const atom = () => {
    if (tk[i] === '(') { i++; const v = or(); i++; return v; }
    const id = tk[i++];
    if (tk[i] === 'WITH') i += 2; // an exception (e.g. LLVM-exception) only widens the base license
    return ALLOWED.has(id) ? [id] : null;
  };
  const and = () => {
    let out = atom();
    while (tk[i] === 'AND') { i++; const r = atom(); out = out && r ? [...out, ...r] : null; }
    return out;
  };
  const or = () => {
    let out = and();
    // Of several allowed options take MIT (its file carries the copyright lines), else the first.
    while (tk[i] === 'OR') { i++; const r = and(); if (r && (!out || (r.includes('MIT') && !out.includes('MIT')))) out = r; }
    return out;
  };
  return tk.length ? or() : null;
}

// ---- Dependency lists ----

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const LICENSE_FILE = /^(LICEN[SC]E|COPYING|UNLICENSE|NOTICE)/i;

export function npmPackages() {
  const pkg = readJson(join(HERE, 'package.json'));
  const lock = readJson(join(HERE, 'package-lock.json')).packages;
  const roots = Object.keys(pkg.dependencies || {}).filter((n) => !BUILD_ONLY.has(n));
  const out = new Map();
  // Node's own lookup: nested node_modules first, then up to the top.
  const resolveKey = (name, from) => {
    for (let base = from; ; base = base.slice(0, base.lastIndexOf('/node_modules/')) ) {
      const key = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
      if (lock[key]) return key;
      if (!base) return null;
    }
  };
  const visit = (name, from) => {
    const key = resolveKey(name, from);
    if (!key || out.has(key)) return;
    const meta = lock[key];
    out.set(key, { name, version: meta.version, license: meta.license, dir: join(HERE, key), kind: 'npm' });
    for (const dep of Object.keys(meta.dependencies || {})) visit(dep, key);
  };
  roots.forEach((n) => visit(n, ''));
  return [...out.values()];
}

export function cratePackages() {
  const text = readFileSync(join(HERE, 'src-tauri', 'Cargo.lock'), 'utf8');
  const pkgs = text.split('[[package]]').slice(1).map((blk) => ({
    name: blk.match(/^name = "([^"]+)"/m)[1],
    version: blk.match(/^version = "([^"]+)"/m)[1],
    deps: [...(blk.match(/^dependencies = \[([\s\S]*?)^\]/m)?.[1] || '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
  }));
  const byName = new Map();
  for (const p of pkgs) byName.set(p.name, [...(byName.get(p.name) || []), p]);
  const find = (spec) => {
    const [name, version] = spec.split(' ');
    const list = byName.get(name) || [];
    return version ? list.find((p) => p.version === version) : list[0];
  };
  const seen = new Set(['tauri-app']);
  const out = [];
  const queue = [...find('tauri-app').deps];
  while (queue.length) {
    const p = find(queue.pop());
    if (!p || seen.has(`${p.name}@${p.version}`)) continue;
    seen.add(`${p.name}@${p.version}`);
    out.push({ name: p.name, version: p.version, kind: 'crate' });
    queue.push(...p.deps);
  }
  return out;
}

// Same list on every machine: names and versions from the two lock files only.
export function fingerprint(npm = npmPackages(), crates = cratePackages()) {
  const lines = [...npm.map((p) => `npm:${p.name}@${p.version}`), ...crates.map((p) => `crate:${p.name}@${p.version}`)].sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

// ---- Notices ----

function crateDir(p) {
  const cargo = process.env.CARGO_HOME || join(homedir(), '.cargo');
  const src = join(cargo, 'registry', 'src');
  if (!existsSync(src)) return null;
  for (const registry of readdirSync(src)) {
    const dir = join(src, registry, `${p.name}-${p.version}`);
    if (existsSync(dir)) return dir;
  }
  return null;
}

function describe(p) {
  p.dir = p.dir || crateDir(p);
  if (!p.dir) throw new Error(`${p.kind} ${p.name} ${p.version}: sources not found (run "cargo fetch" or "npm ci" first)`);
  if (p.kind === 'crate') {
    const cargo = readFileSync(join(p.dir, 'Cargo.toml'), 'utf8');
    p.license = cargo.match(/^license\s*=\s*"([^"]+)"/m)?.[1];
    p.repo = cargo.match(/^repository\s*=\s*"([^"]+)"/m)?.[1];
  }
  const chosen = pickLicense(p.license);
  if (!chosen) throw new Error(`${p.kind} ${p.name} ${p.version}: license "${p.license}" is not in the allowed list (specs/licensing.md R8)`);
  const files = readdirSync(p.dir).filter((f) => LICENSE_FILE.test(f)).sort();
  const wanted = files.filter((f) => chosen.some((id) => f.toUpperCase().includes(id.split('-')[0].toUpperCase())));
  p.texts = (wanted.length ? wanted : files).map((f) => readFileSync(join(p.dir, f), 'utf8').trim().replace(/\r\n/g, '\n'));
  p.chosen = chosen;
  return p;
}

export function buildLicense() {
  const npm = npmPackages();
  const crates = cratePackages();
  const all = [...npm, ...crates].map(describe).sort((a, b) => `${a.name}${a.version}`.localeCompare(`${b.name}${b.version}`));
  // One block per distinct text; the packages that share it are listed above it.
  const groups = new Map();
  for (const p of all) {
    const body = p.texts.length ? p.texts.join('\n\n') : `License: ${p.chosen.join(', ')}. The package ships no license file${p.repo ? `; see ${p.repo}` : ''}.`;
    const g = groups.get(body) || { body, who: [] };
    g.who.push(`${p.name} ${p.version} (${p.license})`);
    groups.set(body, g);
  }
  const root = readFileSync(join(REPO, 'LICENSE'), 'utf8').replace(/\r\n/g, '\n').trim();
  let out = `${root}\n\n----------------------------------------------------------------\nThird-party notices\nDependency fingerprint: ${fingerprint(npm, crates)}\n----------------------------------------------------------------\n`;
  for (const g of [...groups.values()].sort((a, b) => a.who[0].localeCompare(b.who[0]))) {
    out += `\n== ${g.who.join(', ')} ==\n\n${g.body}\n`;
  }
  return out;
}

// The fingerprint a LICENSE file was written for, or null.
export const storedFingerprint = (text) => text.match(/^Dependency fingerprint: ([0-9a-f]{64})$/m)?.[1] ?? null;

function main() {
  if (process.argv.includes('--check')) {
    const have = existsSync(LICENSE_PATH) ? storedFingerprint(readFileSync(LICENSE_PATH, 'utf8')) : null;
    if (have !== fingerprint()) { console.error('game-launcher/LICENSE is stale: run node scripts/gen-license.mjs'); process.exit(1); }
    console.log('game-launcher/LICENSE is current');
    return;
  }
  const text = buildLicense();
  writeFileSync(LICENSE_PATH, text);
  console.log(`Wrote game-launcher/LICENSE (${(text.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
