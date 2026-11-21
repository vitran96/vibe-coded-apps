#!/usr/bin/env node
// One version for the whole repo: every app's APP_VERSION, every version.json entry and the launcher's version files.
// Source of truth: top-level "version" in version.json. check.mjs fails if any site differs. Zero dependencies.
// Usage: node shared/scripts/bump-version.mjs <x.y.z | patch | minor | major> | --self-test
// Bumps from the highest current version (so a drifted repo is repaired too), then rebuilds all apps.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, allApps } from './build.mjs';

const SEMVER = /^\d+\.\d+\.\d+$/;
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const jsonSite = (file, get, mut) => ({
  file,
  get: (t) => get(JSON.parse(t)),
  set: (t, v) => { const o = JSON.parse(t); mut(o, v); return JSON.stringify(o, null, 2) + '\n'; },
});

// Fixed version sites. get() returns every version found in the file; set() rewrites all of them.
const FIXED = [
  { file: 'version.json',
    get: (t) => { const o = JSON.parse(t); return [o.version, ...o.games.map((g) => g.version)]; },
    set: (t, v) => { const o = JSON.parse(t); o.games.forEach((g) => { g.version = v; }); return JSON.stringify(Object.assign({ version: v }, o, { version: v }), null, 2) + '\n'; } },
  jsonSite('game-launcher/package.json', (o) => [o.version], (o, v) => { o.version = v; }),
  jsonSite('game-launcher/package-lock.json', (o) => [o.version, o.packages[''].version],
    (o, v) => { o.version = v; o.packages[''].version = v; }),
  // Regex, not JSON: keeps the file's own formatting (a JSON rewrite would reflow its arrays).
  { file: 'game-launcher/src-tauri/tauri.conf.json',
    get: (t) => [t.match(/"version": "([^"]+)"/)?.[1]],
    set: (t, v) => t.replace(/("version": ")[^"]+"/, `$1${v}"`) },
  { file: 'game-launcher/src-tauri/Cargo.toml',
    get: (t) => [t.match(/^version = "([^"]+)"/m)?.[1]],
    set: (t, v) => t.replace(/^version = "[^"]+"/m, `version = "${v}"`) },
  { file: 'game-launcher/src-tauri/Cargo.lock',
    get: (t) => [t.match(/name = "tauri-app"\nversion = "([^"]+)"/)?.[1]],
    set: (t, v) => t.replace(/(name = "tauri-app"\nversion = ")[^"]+"/, `$1${v}"`) },
];

// Each app's src/*.js that declares APP_VERSION.
function appSites() {
  const out = [];
  for (const app of allApps()) {
    if (!existsSync(join(ROOT, app, 'src'))) continue;
    for (const f of readdirSync(join(ROOT, app, 'src'))) {
      const file = join(app, 'src', f);
      if (!/\.m?js$/.test(f) || !/APP_VERSION\s*=/.test(read(file))) continue;
      out.push({
        file,
        get: (t) => [...t.matchAll(/APP_VERSION\s*=\s*'([^']+)'/g)].map((m) => m[1]),
        set: (t, v) => t.replace(/(APP_VERSION\s*=\s*')[^']+'/g, `$1${v}'`),
      });
    }
  }
  return out;
}

export const sites = () => [...FIXED, ...appSites()];

// Problems as text: any site without the version.json top-level version, or holding another one.
export function versionProblems() {
  const expected = JSON.parse(read('version.json')).version;
  const out = [];
  if (!SEMVER.test(expected ?? '')) out.push('version.json has no top-level "version" (x.y.z)');
  for (const s of sites()) {
    const found = s.get(read(s.file));
    if (!found.length || found.some((v) => v !== expected)) {
      out.push(`${s.file}: has ${found.length ? found.map((v) => v ?? 'nothing').join(', ') : 'no version'}, expected ${expected}`);
    }
  }
  return out;
}

const cmp = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
export const highest = (versions) => versions.filter((v) => SEMVER.test(v ?? '')).sort(cmp).at(-1);

// x.y.z is taken as given; patch|minor|major bumps the current version.
export function nextVersion(current, arg) {
  if (SEMVER.test(arg)) return arg;
  if (!['major', 'minor', 'patch'].includes(arg)) throw new Error(`not x.y.z, patch, minor or major: ${arg}`);
  const [a, b, c] = current.split('.').map(Number);
  return { major: `${a + 1}.0.0`, minor: `${a}.${b + 1}.0`, patch: `${a}.${b}.${c + 1}` }[arg];
}

function selfTest() {
  assert.equal(nextVersion('2.1.1', 'minor'), '2.2.0');
  assert.equal(nextVersion('2.1.1', 'patch'), '2.1.2');
  assert.equal(nextVersion('2.1.1', 'major'), '3.0.0');
  assert.equal(nextVersion('2.1.1', '1.0.0'), '1.0.0');
  assert.throws(() => nextVersion('2.1.1', 'constructor'), /not x.y.z/);
  assert.equal(highest(['1.9.0', '2.1.1', '2.10.0', undefined]), '2.10.0');

  const samples = {
    'version.json': '{\n  "version": "2.1.1",\n  "games": [{ "id": "a", "version": "1.0.0" }]\n}\n',
    'game-launcher/package.json': '{\n  "name": "t",\n  "version": "0.1.0"\n}\n',
    'game-launcher/package-lock.json': '{\n  "version": "0.1.0",\n  "packages": { "": { "version": "0.1.0" } }\n}\n',
    'game-launcher/src-tauri/tauri.conf.json': '{\n  "version": "0.1.0"\n}\n',
    'game-launcher/src-tauri/Cargo.toml': '[package]\nname = "tauri-app"\nversion = "0.1.0"\n',
    'game-launcher/src-tauri/Cargo.lock': '[[package]]\nname = "tauri-app"\nversion = "0.1.0"\n',
  };
  for (const s of FIXED) {
    const set = s.set(samples[s.file], '9.9.9');
    const got = s.get(set);
    assert.ok(got.length && got.every((v) => v === '9.9.9'), `${s.file} round trip: ${got}`);
  }
  console.log(`ok   ${FIXED.length} fixed version sites rewrite and read back`);
  console.log('ok   nextVersion and highest');
  console.log('\nbump-version self-tests passed');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  if (!args.length) {
    console.error('Usage: node shared/scripts/bump-version.mjs <x.y.z | patch | minor | major> | --self-test');
    process.exit(2);
  }
  const all = sites();
  const current = highest(all.flatMap((s) => s.get(read(s.file))));
  const next = nextVersion(current, args[0]);
  for (const s of all) {
    const text = read(s.file);
    const out = s.set(text, next);
    if (out !== text) writeFileSync(join(ROOT, s.file), out);
  }
  const left = versionProblems();
  if (left.length) {
    console.error('Version sites still differ after the bump:\n- ' + left.join('\n- '));
    process.exit(1);
  }
  console.log(`${current} -> ${next} in ${all.length} version sites`);
  const r = spawnSync(process.execPath, [join(ROOT, 'shared/scripts/build.mjs'), '--all'], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
