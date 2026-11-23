import { check as tauriCheck } from '@tauri-apps/plugin-updater';
import { relaunch as tauriRelaunch } from '@tauri-apps/plugin-process';
import { getManifest, updateManifest } from './gameManager.js';
import { isNewerVersion } from './safety.js';

// Launcher self-update (spec game-launcher-ota). The feed is the latest.json of the newest GitHub Release,
// set in tauri.conf.json; this file only decides when to check and what to ask the player.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const UPDATE_MODES = ['ask', 'download', 'never'];

// R8: at most one check per 24 hours. A clock set back counts as "check again".
export function shouldCheck(lastCheck, now = Date.now()) {
  return !Number.isFinite(lastCheck) || lastCheck > now || now - lastCheck >= DAY_MS;
}

export function modeOf(settings) {
  return UPDATE_MODES.includes(settings?.launcherUpdateMode) ? settings.launcherUpdateMode : 'ask';
}

/**
 * The update flow with the player. `ui` has: ask(update) -> 'now' | 'later' | 'never', progress(percent),
 * askRestart() -> boolean, error(), info(). Nothing restarts without askRestart() saying yes (R12).
 * @param {{ check?: Function, relaunch?: Function, now?: () => number, currentVersion?: string }} ops
 */
export function createUpdater({ ui, canPrompt = () => true, ops = {}, manifestOps = {} }) {
  const check = ops.check || tauriCheck;
  const relaunch = ops.relaunch || tauriRelaunch;
  const now = ops.now || Date.now;
  let pending = null; // found while a game was running (R13)
  let busy = false;

  // The newest update, or null. R7: only a strictly higher version counts, whatever the feed says.
  async function find() {
    const update = await check();
    await updateManifest((m) => { m.settings.lastUpdateCheck = now(); }, manifestOps);
    if (!update) return null;
    const current = ops.currentVersion || update.currentVersion;
    return isNewerVersion(update.version, current) ? update : null;
  }

  async function apply(update, mode) {
    let choice = 'now';
    if (mode === 'ask') {
      choice = await ui.ask(update);
      if (choice === 'never') {
        await updateManifest((m) => { m.settings.launcherUpdateMode = 'never'; }, manifestOps);
        return;
      }
    }
    if (choice !== 'now') return;
    try {
      let total = 0, got = 0;
      const quiet = mode === 'download'; // background download: no progress window
      ui.progress(0, quiet);
      await update.download((ev) => {
        if (ev.event === 'Started') total = ev.data?.contentLength || 0;
        if (ev.event === 'Progress') { got += ev.data?.chunkLength || 0; if (total) ui.progress(Math.min(100, Math.round((got / total) * 100)), quiet); }
      });
      ui.progress(100, quiet);
      if (await ui.askRestart()) {
        await update.install(); // on Windows the installer closes and restarts the app itself
        await relaunch();
      }
    } catch (err) {
      console.error('Launcher update failed:', err);
      ui.error();
    }
  }

  async function guard(fn) {
    if (busy) return undefined;
    busy = true;
    try { return await fn(); } finally { busy = false; }
  }

  return {
    // The daily check (R8), also called when the app starts. Failures are silent.
    tick: () => guard(async () => {
      const settings = (await getManifest(manifestOps)).settings;
      const mode = modeOf(settings);
      if (mode === 'never' || !shouldCheck(settings.lastUpdateCheck, now())) return 'skipped';
      let update;
      try { update = await find(); } catch (err) { console.warn('Update check failed:', err); return 'error'; }
      if (!update) return 'none';
      if (!canPrompt()) { pending = update; return 'deferred'; }
      await apply(update, mode);
      return 'handled';
    }),
    // R13: the library screen calls this when the player is back there.
    resume: () => guard(async () => {
      if (!pending || !canPrompt()) return 'idle';
      const update = pending;
      pending = null;
      const mode = modeOf((await getManifest(manifestOps)).settings);
      if (mode === 'never') return 'skipped';
      await apply(update, mode);
      return 'handled';
    }),
    // R11: the button always works, also in "never" mode.
    checkNow: () => guard(async () => {
      let update;
      try { update = await find(); } catch (err) { console.warn('Update check failed:', err); return 'error'; }
      if (!update) return 'latest';
      await apply(update, 'ask');
      return 'available';
    })
  };
}
