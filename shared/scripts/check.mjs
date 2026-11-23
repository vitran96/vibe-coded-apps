#!/usr/bin/env node
// Static checks per app: up-to-date build, no network, i18n parity, storage prefix, version, a11y smoke, app tests.
// Also checks the repo-wide version (bump-version.mjs sites) once per run.
// Usage: node shared/scripts/check.mjs <app...> | --all
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, buildFile, findProblems, allApps, VENDOR, sha256, catalogFields, badPath } from './build.mjs';
import { versionProblems } from './bump-version.mjs';

const read = (p) => readFileSync(p, 'utf8');
const catalog = JSON.parse(read(join(ROOT, 'version.json'))).games;
const HOUSE_KIT = read(join(ROOT, 'shared/house/house-kit.js'));
const HOUSE_TEXTS = ['house-kit.js', 'house-store.js', 'house-a11y.js', 'house-audio.js']
  .map((f) => read(join(ROOT, 'shared/house', f)));

// Source text the app owns: src/*.js and src/*.html, or the single index.html for apps not yet split.
function sourceTexts(app) {
  const d = join(app, 'src');
  if (!existsSync(d)) return [read(join(app, 'index.html'))];
  return readdirSync(d).filter((f) => /\.(m?js|html)$/.test(f)).map((f) => read(join(d, f)));
}

// Keys of the `code: { ... }` block in an i18n file; the block ends at the matching closing brace.
function dictKeys(text, code) {
  const m = text.match(new RegExp(`^([ \\t]*)${code}:\\s*\\{`, "m"));
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const close = new RegExp(`^${m[1]}\\},?\\s*$`, 'm').exec(rest);
  const block = close ? rest.slice(0, close.index) : rest;
  return [...block.matchAll(/['"]([\w.-]+)['"]\s*:/g)].map((x) => x[1]);
}

function appChecks(name) {
  const app = join(ROOT, name);
  const problems = [];
  const outPath = join(app, 'index.html');
  const committed = existsSync(outPath) ? read(outPath) : null;
  const texts = sourceTexts(app);
  const allSrc = [...texts, ...HOUSE_TEXTS];

  // 1. Build: the committed index.html is what Pages and the launcher ship.
  const srcIndex = join(app, 'src', 'index.html');
  let built = null;
  if (existsSync(srcIndex)) {
    built = buildFile(srcIndex);
    if (built.problems.length) problems.push('build: ' + built.problems.join('; '));
    else if (committed !== built.html) problems.push('index.html is stale: run node shared/scripts/build.mjs ' + name);
    else {
      // LICENSE and files.txt are build outputs too (specs/licensing.md R3, game-launcher-files-type R5).
      for (const [file, want] of [['LICENSE', built.license], ['files.txt', built.files]]) {
        const p = join(app, file);
        if (!existsSync(p)) problems.push(`${file} is missing: run node shared/scripts/build.mjs ${name}`);
        else if (read(p) !== want) problems.push(`${file} is stale: run node shared/scripts/build.mjs ${name}`);
      }
    }
  } else if (!committed) {
    problems.push('no index.html');
  }

  // 1b. files.txt: every line is "<sha256>  <path>", a safe path, a file that exists with that hash; index.html first.
  const manifest = join(app, 'files.txt');
  if (existsSync(manifest)) {
    const lines = read(manifest).trimEnd().split('\n');
    if (!lines[0]?.endsWith('  index.html')) problems.push('files.txt: line 1 must be index.html');
    for (const line of lines) {
      const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
      if (!m) { problems.push(`files.txt: bad line "${line.slice(0, 40)}"`); continue; }
      if (badPath(m[2])) { problems.push(`files.txt: unsafe path ${m[2]}`); continue; }
      const p = join(app, m[2]);
      if (!existsSync(p)) problems.push(`files.txt: lists a missing file ${m[2]}`);
      else if (sha256(readFileSync(p)) !== m[1]) problems.push(`files.txt: sha256 of ${m[2]} differs`);
    }
  }

  // 1c. version.json sha256 and size are those of what the launcher downloads (specs/game-launcher-hardening.md R18).
  const cat = catalog.find((g) => g.id === name);
  if (cat && committed && existsSync(manifest)) {
    const want = catalogFields(cat, committed, read(manifest));
    if (cat.sha256 !== want.sha256 || cat.size !== want.size) problems.push('version.json sha256/size are stale: run node shared/scripts/build.mjs ' + name);
  }

  // 2. No network in the shipped file (also catches a committed file that was never rebuilt).
  if (committed) findProblems(committed).forEach((p) => problems.push('network/loading: ' + p));

  // 3. i18n: vi and en keys match; every used key exists (app or house); vi is the default.
  // Union over all source files: an app may keep strings in several modules (e.g. i18n.js and rulesdocs.js).
  const blocks = (code) => texts.map((t) => dictKeys(t, code)).filter(Boolean).flat();
  const vi = blocks('vi');
  const en = blocks('en');
  if (!vi.length || !en.length) {
    problems.push('i18n: no vi/en dictionary found in source');
  } else {
    const houseVi = dictKeys(HOUSE_KIT, 'vi');
    vi.filter((k) => !en.includes(k)).forEach((k) => problems.push(`i18n: "${k}" missing in en`));
    en.filter((k) => !vi.includes(k)).forEach((k) => problems.push(`i18n: "${k}" missing in vi`));
    const known = new Set([...vi, ...houseVi]);
    const used = new Set();
    for (const t of [...texts, ...(committed ? [committed] : [])]) {
      for (const m of t.matchAll(/\bt\(\s*['"]([\w.-]+)['"]/g)) used.add(m[1]);
      for (const m of t.matchAll(/data-i18n[\w-]*=["']([\w.-]+)["']/g)) used.add(m[1]);
    }
    [...used].filter((k) => !known.has(k)).forEach((k) => problems.push(`i18n: key "${k}" used but not defined`));
  }
  if (!allSrc.some((t) => /let\s+lang\s*=\s*['"]vi['"]|DEFAULT_LANG\s*=\s*['"]vi['"]/.test(t))) {
    problems.push('i18n: default language is not vi');
  }

  // 4. Storage: literal keys and House.store prefixes use the app prefix; no localStorage.clear().
  const prefix = texts.map((t) => t.match(/\w*PREFIX\s*=\s*['"]([a-z]+_)['"]/)?.[1]).find(Boolean);
  if (!prefix) problems.push('storage: no PREFIX constant (e.g. const STORAGE_PREFIX = \'app_\')');
  for (const t of texts) {
    if (/localStorage\.clear\(/.test(t)) problems.push('storage: localStorage.clear() is forbidden (remove only own keys)');
    for (const m of t.matchAll(/localStorage\.\w+\(\s*['"`]([^'"`]*)['"`](\s*\+)?/g)) {
      if (m[2]) continue; // 'prefix' + key is a dynamic key; only literal full keys are checked
      if (prefix && !m[1].startsWith(prefix) && m[1] !== 'house:prefs') problems.push(`storage: key "${m[1]}" is outside prefix ${prefix}`);
    }
    for (const m of t.matchAll(/House\.store\(\s*['"]([^'"]+)['"]/g)) {
      if (m[1] !== prefix) problems.push(`storage: House.store("${m[1]}") does not match prefix ${prefix}`);
    }
  }

  // 5. Version: APP_VERSION equals the catalog entry.
  const appVersion = texts.map((t) => t.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1]).find(Boolean);
  const entry = catalog.find((g) => g.id === name);
  if (!appVersion) problems.push('version: no APP_VERSION constant');
  if (!entry) problems.push('version: no entry in version.json');
  else if (appVersion && appVersion !== entry.version) problems.push(`version: APP_VERSION ${appVersion} != version.json ${entry.version}`);

  // 6. A11y smoke on the shipped markup (static only; a browser check is still needed).
  if (committed) {
    if (!/<html\b[^>]*\blang=/i.test(committed)) problems.push('a11y: <html lang> missing');
    if (!/aria-live=/i.test(committed)) problems.push('a11y: no aria-live region');
    for (const [, attrs, inner] of committed.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const text = inner.replace(/<[^>]*>/g, '').trim();
      if (!text && !/aria-label|data-i18n/i.test(attrs + inner)) problems.push(`a11y: button has no text or aria-label: <button${attrs.slice(0, 40)}>`);
    }
    if (/tabindex\s*=\s*["']?[1-9]/i.test(committed)) problems.push('a11y: tabindex greater than 0');
    if (/outline\s*:\s*(none|0)\b/i.test(committed) && !committed.includes(':focus-visible')) {
      problems.push('a11y: outline removed without a :focus-visible style');
    }
  }

  // 7. The app's own tests: scripts/test*.mjs.
  const scripts = join(app, 'scripts');
  if (existsSync(scripts)) {
    for (const f of readdirSync(scripts).filter((x) => /^test.*\.mjs$/.test(x))) {
      const r = spawnSync(process.execPath, [join(scripts, f)], { cwd: app, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) {
        const tail = (r.stdout + r.stderr).trim().split('\n').slice(-3).join(' | ');
        problems.push(`tests: scripts/${f} exited ${r.status ?? 'by signal'}: ${tail}`);
      }
    }
  }
  return problems;
}

const args = process.argv.slice(2);
const targets = args.includes('--all') ? allApps() : args;
if (!targets.length) {
  console.error('Usage: node shared/scripts/check.mjs <app...> | --all');
  process.exit(2);
}

// Repo-wide: every version site equals version.json's top-level version (bump-version.mjs writes them).
const repo = versionProblems();
console.log(repo.length ? 'FAIL  repo versions' : 'PASS  repo versions');
repo.forEach((p) => console.log(`        - ${p}`));
// Repo-wide: vendored libraries carry their license (specs/licensing.md R6); catalog launcher range is sane (game-launcher-ota R18).
const SEMVER = /^\d+\.\d+\.\d+$/;
const vc = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const repoExtra = [];
for (const v of VENDOR) {
  const dir = join(ROOT, 'shared/vendor');
  // The pinned folder name (three@x.y.z) is read from disk, so a library upgrade does not break the check.
  const pkg = readdirSync(dir).find((d) => /@/.test(d) && v.re.source.includes(d.split('@')[0]));
  const probe = v.file(['', pkg ?? '']);
  const p = join(dir, probe);
  if (!existsSync(p)) repoExtra.push(`vendor: no license file shared/vendor/${probe} for ${v.name}`);
  else if (!v.expect.test(read(p))) repoExtra.push(`vendor: ${probe} does not contain the ${v.license} text`);
}
for (const g of catalog) {
  const lim = (x) => (x === undefined || x === null || x === -1 ? null : x);
  const lo = lim(g.minLauncher), hi = lim(g.maxLauncher);
  for (const [k, x] of [['minLauncher', lo], ['maxLauncher', hi]]) if (x !== null && !SEMVER.test(String(x))) repoExtra.push(`version.json ${g.id}: ${k} "${x}" is not x.y.z, null or -1`);
  if (lo && hi && SEMVER.test(lo) && SEMVER.test(hi) && vc(lo, hi) > 0) repoExtra.push(`version.json ${g.id}: minLauncher ${lo} is greater than maxLauncher ${hi}`);
}
console.log(repoExtra.length ? 'FAIL  vendor licenses and launcher range' : 'PASS  vendor licenses and launcher range');
repoExtra.forEach((p) => console.log(`        - ${p}`));
let hard = (repo.length ? 1 : 0) + (repoExtra.length ? 1 : 0);
for (const name of targets) {
  const problems = existsSync(join(ROOT, name)) ? appChecks(name) : [`no such app folder: ${name}`];
  if (!problems.length) {
    console.log(`PASS  ${name}`);
  } else {
    hard++;
    console.log(`FAIL  ${name}`);
    problems.forEach((p) => console.log(`        - ${p}`));
  }
}
console.log(`\n${targets.length} app(s) + repo versions: ${hard} failing`);
process.exit(hard ? 1 : 0);
