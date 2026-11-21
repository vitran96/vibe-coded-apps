#!/usr/bin/env node
// Build entry point for every case in this repo. Zero dependencies.
//   node scripts/build.mjs <app...> | --all  [--test] [--check] [--zip]
//   node scripts/build.mjs launcher [--test] [--desktop]
// See .agents/skills/build-app/SKILL.md for when to use which flag.
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAUNCHER = 'game-launcher';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

function main() {
let targets = args.filter((a) => !a.startsWith('--'));
const KNOWN = new Set(['--all', '--test', '--check', '--zip', '--desktop', '--help']);
const unknown = [...flags].filter((f) => !KNOWN.has(f));
if (flags.has('--help') || unknown.length || (!targets.length && !flags.has('--all'))) {
  if (unknown.length) console.error(`Unknown flag: ${unknown.join(' ')}`);
  console.error(`Usage:
  node scripts/build.mjs <app...> | --all  [--test] [--check] [--zip]
  node scripts/build.mjs launcher [--test] [--desktop]
Apps: ${listApps().join(', ')}`);
  process.exit(unknown.length || !flags.has('--help') ? 1 : 0);
}
runTargets(targets);
}

// An app is any top-level folder (not hidden, not the launcher) that ships an index.html.
function listApps() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== LAUNCHER)
    .filter((d) => existsSync(join(ROOT, d.name, 'index.html')) || existsSync(join(ROOT, d.name, 'src', 'index.html')))
    .map((d) => d.name)
    .sort();
}

function run(cmd, cmdArgs, cwd) {
  console.log(`  $ ${[cmd, ...cmdArgs].join(' ')}   (in ${cwd.slice(ROOT.length + 1) || '.'})`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${r.status}`);
}

function buildApp(app) {
  const dir = join(ROOT, app);
  if (existsSync(join(dir, 'src', 'index.html'))) {
    // shortcut: uses each app's own inliner until shared/scripts/build.mjs exists (rebuild plan M1).
    const script = join(dir, 'scripts', 'build-single-html.mjs');
    if (!existsSync(script)) throw new Error(`${app}: has src/ but no scripts/build-single-html.mjs`);
    run(process.execPath, ['scripts/build-single-html.mjs', 'src/index.html', 'index.html'], dir);
  } else {
    console.log(`  ${app}: no src/, index.html is the source — nothing to build`);
  }
}

function testApp(app) {
  const dir = join(ROOT, app);
  if (existsSync(join(dir, 'scripts', 'caro.js'))) return run(process.execPath, ['scripts/caro.js', 'check'], dir);
  const scripts = existsSync(join(dir, 'scripts'))
    ? readdirSync(join(dir, 'scripts')).filter((f) => /^(test-.+|run-.+tests|perft)\.mjs$/.test(f)).sort()
    : [];
  if (!scripts.length) return console.log(`  ${app}: no tests found`);
  for (const s of scripts) run(process.execPath, [`scripts/${s}`], dir);
}

// Static checks for hard rules 2 (no CDN) and 4 (sub-route agnostic) on the built file.
export function findProblems(html) {
  const problems = new Set();
  const lib = /<(?:script|link|img|source|iframe|audio|video)\b[^>]*?\b(?:src|href)=["']((?:https?:)?\/\/[^"']+)/gi;
  const asset = /["'(]((?:https?:)?\/\/[^"')\s]+\.(?:m?js|css|woff2?|ttf|otf|png|jpe?g|svg|mp3|ogg|wav)(?:[?#][^"')\s]*)?)["')]/gi;
  for (const re of [lib, asset]) for (const m of html.matchAll(re)) {
    if (m[1].startsWith('//www.w3.org') || m[1].includes('://www.w3.org/')) continue; // SVG namespace, not a fetch
    problems.add(`network dependency (breaks offline/download): ${m[1]}`);
  }
  for (const m of html.matchAll(/\b(?:src|href|action)=["'](\/(?!\/)[^"']*)/gi)) problems.add(`root-absolute path (breaks sub-route): ${m[1]}`);
  for (const m of html.matchAll(/(?:register\(|start_url["']?\s*:\s*|scope["']?\s*:\s*)["'](\/(?!\/)[^"']*)/g)) problems.add(`root-absolute SW/manifest path: ${m[1]}`);
  return [...problems];
}

function checkApp(app) {
  const file = join(ROOT, app, 'index.html');
  const problems = findProblems(readFileSync(file, 'utf8'));
  if (problems.length) throw new Error(`${app}/index.html:\n    - ${problems.join('\n    - ')}`);
  console.log(`  ${app}: offline + relative-path checks passed`);
}

function appVersion(app) {
  try {
    const catalog = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
    return catalog.games.find((g) => g.id === app)?.version ?? 'dev';
  } catch { return 'dev'; }
}

// Playable package only: built index.html plus optional runtime siblings. Sources/tests stay out.
function zipApp(app) {
  const dir = join(ROOT, app);
  const parts = ['index.html', 'sw.js', 'assets', 'manifest.webmanifest', 'icons'].filter((p) => existsSync(join(dir, p)));
  const outDir = join(ROOT, 'out');
  const zipPath = join(outDir, `${app}-${appVersion(app)}.zip`);
  mkdirSync(outDir, { recursive: true });
  rmSync(zipPath, { force: true });
  run('zip', ['-r', '-q', zipPath, ...parts], dir);
  console.log(`  -> ${zipPath.slice(ROOT.length + 1)} (${parts.join(', ')})`);
}

function launcher() {
  const dir = join(ROOT, LAUNCHER);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (!existsSync(join(dir, 'node_modules'))) run(npm, ['ci'], dir);
  if (flags.has('--test')) run(npm, ['test'], dir);
  if (flags.has('--desktop')) run(npm, ['run', 'tauri', 'build'], dir); // runs `npm run build` itself
  else run(npm, ['run', 'build'], dir);
}

function runTargets(targets) {
if (flags.has('--all')) targets = listApps();
const apps = listApps();
const failures = [];
for (const t of targets) {
  console.log(`\n== ${t}`);
  try {
    if (t === LAUNCHER || t === 'launcher') { launcher(); continue; }
    if (!apps.includes(t)) throw new Error(`unknown app "${t}" (apps: ${apps.join(', ')})`);
    buildApp(t);
    if (flags.has('--test')) testApp(t);
    if (flags.has('--check')) checkApp(t);
    if (flags.has('--zip')) zipApp(t);
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    failures.push(t);
  }
}
console.log(failures.length ? `\nFailed: ${failures.join(', ')}` : `\nOK: ${targets.join(', ')}`);
process.exit(failures.length ? 1 : 0);
}

if (isCli) main();
