import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickLicense, fingerprint, storedFingerprint, npmPackages, cratePackages, LICENSE_PATH } from '../scripts/gen-license.mjs';

// specs/licensing.md R7, R8, R10
describe('game-launcher/LICENSE', () => {
  const text = readFileSync(LICENSE_PATH, 'utf8');

  test('R8 pickLicense: permissive option of an OR, all of an AND, copyleft refused', () => {
    assert.deepEqual(pickLicense('MIT'), ['MIT']);
    assert.deepEqual(pickLicense('(MIT OR GPL-3.0-or-later)'), ['MIT']);
    assert.deepEqual(pickLicense('Apache-2.0 OR MIT'), ['MIT'], 'MIT preferred');
    assert.deepEqual(pickLicense('MIT/Apache-2.0'), ['MIT']);
    assert.deepEqual(pickLicense('(MIT AND Zlib)'), ['MIT', 'Zlib']);
    assert.deepEqual(pickLicense('(MIT OR Apache-2.0) AND Unicode-3.0'), ['MIT', 'Unicode-3.0']);
    assert.deepEqual(pickLicense('Apache-2.0 WITH LLVM-exception'), ['Apache-2.0']);
    for (const bad of ['GPL-3.0-only', 'LGPL-2.1-or-later', 'AGPL-3.0', 'GPL-2.0-only AND MIT', 'SEE LICENSE IN x', '', undefined]) assert.equal(pickLicense(bad), null, String(bad));
  });

  test('R7 starts with the repo MIT text and a third-party section', () => {
    assert.match(text, /^MIT License\n\nCopyright \(c\) 2026 vitran96/);
    assert.match(text, /\nThird-party notices\n/);
  });

  test('R10 is current: its fingerprint matches package-lock.json and Cargo.lock', () => {
    assert.equal(storedFingerprint(text), fingerprint(), 'run: node scripts/gen-license.mjs');
  });

  test('R10 names every runtime dependency (npm and Rust), and none that is build-only', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    for (const name of Object.keys(pkg.dependencies).filter((n) => n !== 'vite')) assert.ok(text.includes(name), `${name} missing`);
    for (const name of ['tauri', 'tauri-plugin-fs', 'tauri-plugin-http', 'tauri-plugin-updater', 'tauri-plugin-process']) {
      assert.ok(cratePackages().some((c) => c.name === name), `${name} not in the crate list`);
      assert.ok(new RegExp(`(^|[ ,])${name} \\d`, 'm').test(text), `${name} missing in LICENSE`);
    }
    assert.ok(!npmPackages().some((p) => p.name === 'vite'));
    assert.equal(npmPackages().find((p) => p.name === 'jszip').license.includes('MIT'), true);
  });

  test('R7 jszip is listed under MIT, not GPL', () => {
    assert.match(text, /jszip \d+\.\d+\.\d+ \(\(MIT OR GPL-3\.0-or-later\)\)/);
  });
});
