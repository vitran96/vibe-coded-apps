import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdater, shouldCheck, modeOf, DAY_MS } from '../src/js/updater.js';
import { getManifest, updateManifest } from '../src/js/gameManager.js';
import { createMockOps } from './helpers.js';

const H = 3600 * 1000;

function setup({ update = null, checkError = null, mode, last, canPrompt = true, askAnswer = 'now', restartAnswer = true, downloadError = null } = {}) {
  const { ops: manifestOps } = createMockOps();
  const log = [];
  const upd = update && {
    version: update.version, currentVersion: update.currentVersion ?? '2.2.0', body: 'notes',
    download: async (cb) => {
      log.push('download');
      if (downloadError) throw downloadError;
      cb({ event: 'Started', data: { contentLength: 100 } });
      cb({ event: 'Progress', data: { chunkLength: 50 } });
      cb({ event: 'Progress', data: { chunkLength: 50 } });
      cb({ event: 'Finished' });
    },
    install: async () => { log.push('install'); }
  };
  const ui = {
    ask: async () => { log.push('ask'); return askAnswer; },
    progress: (p, quiet) => log.push(`progress:${p}${quiet ? ':quiet' : ''}`),
    askRestart: async () => { log.push('askRestart'); return restartAnswer; },
    error: () => log.push('error'),
    info: () => log.push('info')
  };
  let allowed = canPrompt;
  const t0 = 1_800_000_000_000;
  const updater = createUpdater({
    ui, canPrompt: () => allowed, manifestOps,
    ops: {
      now: () => t0,
      check: async () => { log.push('check'); if (checkError) throw checkError; return upd; },
      relaunch: async () => { log.push('relaunch'); }
    }
  });
  const prime = () => updateManifest((m) => {
    if (mode) m.settings.launcherUpdateMode = mode;
    if (last !== undefined) m.settings.lastUpdateCheck = last === null ? undefined : t0 - last;
  }, manifestOps);
  return { updater, log, manifestOps, prime, t0, allow: (v) => { allowed = v; } };
}

describe('Launcher self-update (ota)', () => {
  test('R8 shouldCheck: 23 h no, 25 h yes, never checked yes, clock set back yes', () => {
    const now = 1_800_000_000_000;
    assert.equal(shouldCheck(now - 23 * H, now), false);
    assert.equal(shouldCheck(now - 25 * H, now), true);
    assert.equal(shouldCheck(now - DAY_MS, now), true);
    assert.equal(shouldCheck(undefined, now), true);
    assert.equal(shouldCheck(now + H, now), true);
  });

  test('R9 modeOf defaults to ask and ignores junk', () => {
    assert.equal(modeOf({}), 'ask');
    assert.equal(modeOf({ launcherUpdateMode: 'banana' }), 'ask');
    assert.equal(modeOf({ launcherUpdateMode: 'never' }), 'never');
    assert.equal(modeOf({ launcherUpdateMode: 'download' }), 'download');
  });

  test('R8 within 24 h there is no check at all; after 25 h there is, and the time is stored', async () => {
    let s = setup({ last: 23 * H });
    await s.prime();
    assert.equal(await s.updater.tick(), 'skipped');
    assert.ok(!s.log.includes('check'));

    s = setup({ last: 25 * H });
    await s.prime();
    assert.equal(await s.updater.tick(), 'none');
    assert.ok(s.log.includes('check'));
    assert.equal((await getManifest(s.manifestOps)).settings.lastUpdateCheck, s.t0);
  });

  test('R8 a failed check is silent: no dialog, no stored time', async () => {
    const s = setup({ checkError: new Error('offline') });
    await s.prime();
    assert.equal(await s.updater.tick(), 'error');
    assert.deepEqual(s.log, ['check']);
    assert.equal((await getManifest(s.manifestOps)).settings.lastUpdateCheck, undefined);
  });

  test('R9 never mode: no check, no prompt', async () => {
    const s = setup({ mode: 'never', update: { version: '9.0.0' } });
    await s.prime();
    assert.equal(await s.updater.tick(), 'skipped');
    assert.deepEqual(s.log, []);
  });

  test('R7 an equal or lower version is ignored', async () => {
    for (const version of ['2.2.0', '2.1.0']) {
      const s = setup({ update: { version } });
      await s.prime();
      assert.equal(await s.updater.tick(), 'none');
      assert.ok(!s.log.includes('ask'));
    }
  });

  test('R10/R12 ask mode: Update now downloads with progress, asks to restart, installs and relaunches only on yes', async () => {
    const s = setup({ update: { version: '2.3.0' } });
    await s.prime();
    assert.equal(await s.updater.tick(), 'handled');
    assert.deepEqual(s.log, ['check', 'ask', 'progress:0', 'download', 'progress:50', 'progress:100', 'progress:100', 'askRestart', 'install', 'relaunch']);
  });

  test('R12 "Later" at the restart prompt never restarts', async () => {
    const s = setup({ update: { version: '2.3.0' }, restartAnswer: false });
    await s.prime();
    await s.updater.tick();
    assert.ok(s.log.includes('askRestart'));
    assert.ok(!s.log.includes('install') && !s.log.includes('relaunch'));
  });

  test('R10 "Later" downloads nothing; "Never ask" switches the mode to never', async () => {
    let s = setup({ update: { version: '2.3.0' }, askAnswer: 'later' });
    await s.prime();
    await s.updater.tick();
    assert.ok(!s.log.includes('download'));

    s = setup({ update: { version: '2.3.0' }, askAnswer: 'never' });
    await s.prime();
    await s.updater.tick();
    assert.ok(!s.log.includes('download'));
    assert.equal((await getManifest(s.manifestOps)).settings.launcherUpdateMode, 'never');
  });

  test('R9 download-only mode: no question, quiet progress, then only the restart question', async () => {
    const s = setup({ mode: 'download', update: { version: '2.3.0' }, restartAnswer: false });
    await s.prime();
    await s.updater.tick();
    assert.ok(!s.log.includes('ask'));
    assert.ok(s.log.includes('download'));
    assert.ok(s.log.filter((l) => l.startsWith('progress')).every((l) => l.endsWith(':quiet')));
    assert.ok(s.log.includes('askRestart'));
    assert.ok(!s.log.includes('install'));
  });

  test('R13 no prompt while a game runs; it waits and appears when the player is back', async () => {
    const s = setup({ update: { version: '2.3.0' }, canPrompt: false });
    await s.prime();
    assert.equal(await s.updater.tick(), 'deferred');
    assert.ok(!s.log.includes('ask'));
    assert.equal(await s.updater.resume(), 'idle', 'still in a game');
    s.allow(true);
    assert.equal(await s.updater.resume(), 'handled');
    assert.ok(s.log.includes('ask'));
    assert.equal(await s.updater.resume(), 'idle', 'only once');
  });

  test('R14 a failed download shows one plain error, installs nothing, restarts nothing', async () => {
    const s = setup({ update: { version: '2.3.0' }, downloadError: new Error('bad signature') });
    await s.prime();
    await s.updater.tick();
    assert.ok(s.log.includes('error'));
    assert.ok(!s.log.includes('install') && !s.log.includes('relaunch') && !s.log.includes('askRestart'));
  });

  test('R11 check now works in never mode: latest, or the question', async () => {
    let s = setup({ mode: 'never' });
    await s.prime();
    assert.equal(await s.updater.checkNow(), 'latest');

    s = setup({ mode: 'never', update: { version: '2.3.0' }, askAnswer: 'later' });
    await s.prime();
    assert.equal(await s.updater.checkNow(), 'available');
    assert.ok(s.log.includes('ask'));

    s = setup({ checkError: new Error('offline') });
    await s.prime();
    assert.equal(await s.updater.checkNow(), 'error');
  });
});
