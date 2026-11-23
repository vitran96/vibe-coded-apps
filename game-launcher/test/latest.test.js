import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLatest, PLATFORMS } from '../scripts/make-latest-json.mjs';

// ota R4, R5: the feed the updater plugin reads
describe('latest.json feed', () => {
  const base = { version: '2.3.0', tag: 'v2.3.0', repo: 'o/r', notes: 'n', pubDate: '2026-01-01T00:00:00.000Z' };

  test('has version, notes, pub_date and per-platform url + signature', () => {
    const feed = buildLatest({ ...base, sigs: { 'game-launcher-installer-2.3.0.exe': 'SIGW\n', 'game-launcher-2.3.0.AppImage': 'SIGL' } });
    assert.deepEqual(feed, {
      version: '2.3.0', notes: 'n', pub_date: '2026-01-01T00:00:00.000Z',
      platforms: {
        'windows-x86_64': { signature: 'SIGW', url: 'https://github.com/o/r/releases/download/v2.3.0/game-launcher-installer-2.3.0.exe' },
        'linux-x86_64': { signature: 'SIGL', url: 'https://github.com/o/r/releases/download/v2.3.0/game-launcher-2.3.0.AppImage' }
      }
    });
  });

  test('a platform built alone is the only one listed; none at all is an error', () => {
    const feed = buildLatest({ ...base, sigs: { 'game-launcher-2.3.0.AppImage': 'SIGL' } });
    assert.deepEqual(Object.keys(feed.platforms), ['linux-x86_64']);
    assert.throws(() => buildLatest({ ...base, sigs: {} }), /no signed bundle/);
  });

  test('file names are the ones the build workflow produces (no .msi, no .deb)', () => {
    assert.deepEqual(Object.values(PLATFORMS).map((f) => f('1.0.0')), ['game-launcher-installer-1.0.0.exe', 'game-launcher-1.0.0.AppImage']);
    const wf = await_wf();
    assert.ok(!/\.msi|\.deb|bundle\/deb|bundle\/msi/.test(wf), 'workflow no longer builds or uploads msi/deb');
    assert.match(wf, /make-latest-json\.mjs/);
    assert.match(wf, /TAURI_SIGNING_PRIVATE_KEY/);
    assert.match(wf, /HAS_SIGNING_KEY == 'true' && '--config src-tauri\/tauri\.signed\.conf\.json'/, 'signing only when the secret exists');
    assert.ok(!/if-no-files-found: error/.test(wf.slice(wf.indexOf('.sig'))), 'a missing .sig does not fail an unsigned build');
  });
});

import { readFileSync } from 'node:fs';
function await_wf() {
  return readFileSync(new URL('../../.github/workflows/build.yml', import.meta.url), 'utf8');
}
