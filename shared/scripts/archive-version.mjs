#!/usr/bin/env node
// Copy each app's built index.html to archived/<vX.Y.Z>/<app>/index.html, so the old release stays playable.
// Use only before a breaking change (save format, house rules), not on every release. Zero dependencies.
// Usage: node shared/scripts/archive-version.mjs <vX.Y.Z> | --self-test
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, allApps, buildFile, findProblems } from './build.mjs';

// Validates every app first, then writes. Nothing is written if any app fails or the archive already exists.
export function archiveApps(root, ver, apps) {
  if (!/^v\d+\.\d+\.\d+$/.test(ver)) throw new Error(`not a version tag: ${ver} (expected vX.Y.Z)`);
  const dest = join(root, 'archived', ver);
  if (existsSync(dest)) throw new Error(`archived/${ver} already exists; refusing to overwrite`);
  const copies = apps.map((app) => {
    const built = join(root, app, 'index.html');
    if (!existsSync(built)) throw new Error(`${app}: no built index.html (run build.mjs first)`);
    const html = readFileSync(built, 'utf8');
    const src = join(root, app, 'src', 'index.html');
    if (existsSync(src) && buildFile(src).html !== html) throw new Error(`${app}: index.html is stale (run build.mjs first)`);
    const problems = findProblems(html);
    if (problems.length) throw new Error(`${app}: not self-contained:\n- ${problems.join('\n- ')}`);
    return { out: join(dest, app, 'index.html'), html };
  });
  for (const { out, html } of copies) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
  }
  return copies.map((c) => c.out);
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'archive-test-'));
  const put = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  const ok = '<!doctype html><html lang="vi"><body>x</body></html>';
  try {
    put('a/index.html', ok);
    put('b/index.html', ok.replace('x', 'y'));
    assert.equal(archiveApps(dir, 'v1.0.0', ['a', 'b']).length, 2);
    assert.equal(readFileSync(join(dir, 'archived/v1.0.0/b/index.html'), 'utf8'), ok.replace('x', 'y'));
    assert.throws(() => archiveApps(dir, 'v1.0.0', ['a']), /refusing to overwrite/);
    assert.throws(() => archiveApps(dir, '1.0.0', ['a']), /not a version tag/);
    put('c/index.html', '<script src="https://cdn.example.com/x.js"></script>');
    assert.throws(() => archiveApps(dir, 'v2.0.0', ['a', 'c']), /not self-contained/);
    assert.ok(!existsSync(join(dir, 'archived/v2.0.0')), 'nothing written when an app fails');
    put('d/index.html', 'stale');
    put('d/src/index.html', ok);
    assert.throws(() => archiveApps(dir, 'v2.0.0', ['d']), /stale/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('ok   archive refuses overwrite, bad tags, CDN, stale builds; writes nothing on failure');
  console.log('\narchive-version self-tests passed');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  if (args.length !== 1) {
    console.error('Usage: node shared/scripts/archive-version.mjs <vX.Y.Z> | --self-test');
    process.exit(2);
  }
  try {
    for (const f of archiveApps(ROOT, args[0], allApps())) console.log(`archived ${f.slice(ROOT.length + 1)}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
