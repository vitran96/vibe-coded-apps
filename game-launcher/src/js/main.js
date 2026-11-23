import {
  fetchRemoteCatalog,
  getManifest,
  updateManifest,
  installOrUpdateGame,
  removeGame,
  removeAllGames,
  prepareGameForLaunch,
  getGameName,
  gameType,
  setLauncherVersion,
  getLauncherVersion
} from './gameManager.js';
import { promptUpdatesIfAvailable } from './updateModal.js';
import { applyI18n, t, errorText } from './i18n.js';
import { launcherRange } from './safety.js';
import { createUpdater, modeOf, UPDATE_MODES } from './updater.js';
import { createDomUi } from './dialogs.js';

function getEl(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

let catalog = [];
let currentLang = 'vi';
let busyCount = 0; // game downloads and installs in progress: no launcher-update prompt meanwhile
let updater = null;

export function getCatalog() {
  return catalog;
}

export function setCatalog(c) {
  catalog = c;
}

const gameIsOpen = () => {
  const playerView = getEl('player-view');
  return !!playerView && !playerView.classList.contains('hidden');
};
const canPrompt = () => !gameIsOpen() && busyCount === 0;

// Type shown on a card: what is installed wins over the catalog (game-launcher-hardening R10, R11).
function typeOf(game, meta) {
  if (meta?.type) return meta.type;
  try { return gameType(game); } catch { return 'html'; }
}

// Runs a player's action: busy counter on, errors caught and shown in plain words (R15, R17).
async function guarded(action, lang) {
  busyCount++;
  try {
    return await action();
  } catch (err) {
    console.error(err);
    alert(errorText(err, lang));
    return undefined;
  } finally {
    busyCount--;
  }
}

export async function init() {
  const btnLibrary = getEl('btn-library');
  const btnSettings = getEl('btn-settings');
  const btnExitGame = getEl('btn-exit-game');
  const chkGlobalAuto = getEl('chk-global-auto-update');
  const selectLanguage = getEl('select-language');
  const btnRemoveAll = getEl('btn-remove-all');
  const selectUpdateMode = getEl('select-update-mode');
  const btnCheckUpdate = getEl('btn-check-update');
  const btnLicenses = getEl('btn-licenses');
  const btnLicensesClose = getEl('btn-licenses-close');

  const initialManifest = await getManifest();
  const initialLang = initialManifest.settings?.language || 'vi';
  currentLang = initialLang;
  applyI18n(initialLang);

  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    setLauncherVersion(await getVersion());
  } catch {
    // Not inside Tauri (tests, plain browser): no version limits are applied.
  }

  if (btnLibrary) btnLibrary.addEventListener('click', showLibrary);
  if (btnSettings) btnSettings.addEventListener('click', showSettings);
  if (btnExitGame) btnExitGame.addEventListener('click', showLibrary);

  if (chkGlobalAuto) {
    chkGlobalAuto.addEventListener('change', async (e) => {
      await updateManifest((m) => { m.settings.globalAutoUpdate = e.target.checked; });
    });
  }

  if (selectLanguage) {
    selectLanguage.addEventListener('change', async (e) => {
      await updateManifest((m) => { m.settings.language = e.target.value; });
      currentLang = e.target.value;
      applyI18n(e.target.value);
      await renderLibrary();
      await renderSettings();
    });
  }

  if (btnRemoveAll) {
    btnRemoveAll.addEventListener('click', async () => {
      const manifest = await getManifest();
      const lang = manifest.settings?.language || 'vi';
      const hasInstalled = Object.values(manifest.games || {}).some(g => g?.installed);
      if (!hasInstalled) return;
      if (confirm(t('confirm_remove_all', lang))) {
        await guarded(() => removeAllGames(), lang);
        await renderSettings();
        await renderLibrary();
      }
    });
  }

  // Launcher self-update (game-launcher-ota).
  updater = createUpdater({ ui: createDomUi(() => currentLang), canPrompt });
  if (selectUpdateMode) {
    selectUpdateMode.addEventListener('change', async (e) => {
      const mode = UPDATE_MODES.includes(e.target.value) ? e.target.value : 'ask';
      await updateManifest((m) => { m.settings.launcherUpdateMode = mode; });
    });
  }
  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', async () => {
      const status = getEl('update-status');
      btnCheckUpdate.disabled = true;
      if (status) status.textContent = t('update_checking', currentLang);
      const outcome = await updater.checkNow();
      if (status) status.textContent = outcome === 'latest' ? t('update_latest', currentLang) : outcome === 'error' ? t('update_check_failed', currentLang) : '';
      btnCheckUpdate.disabled = false;
      await renderSettings();
    });
  }
  if (btnLicenses) {
    btnLicenses.addEventListener('click', async () => {
      const box = getEl('licenses-modal');
      const text = getEl('licenses-text');
      if (text) {
        try {
          text.textContent = await (await import('./licenses.js')).loadLicenseText();
        } catch (err) {
          console.error(err);
          text.textContent = '';
        }
      }
      if (box) box.classList.remove('hidden');
      btnLicensesClose?.focus?.();
    });
  }
  if (btnLicensesClose) {
    btnLicensesClose.addEventListener('click', () => getEl('licenses-modal')?.classList.add('hidden'));
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') getEl('licenses-modal')?.classList.add('hidden');
    });
  }

  await syncCatalogAndCheckUpdates();

  // R8: once at start and then, while the app stays open, an hourly look at whether a day has passed.
  updater.tick();
  if (typeof setInterval === 'function') setInterval(() => updater.tick(), 60 * 60 * 1000);
}

export function showLibrary() {
  exitGame();
  const settingsView = getEl('settings-view');
  const libraryView = getEl('library-view');
  const btnLibrary = getEl('btn-library');
  const btnSettings = getEl('btn-settings');

  if (settingsView) settingsView.classList.add('hidden');
  if (libraryView) libraryView.classList.remove('hidden');
  if (btnLibrary) btnLibrary.classList.add('active');
  if (btnSettings) btnSettings.classList.remove('active');
  renderLibrary();
  updater?.resume();
}

export async function showSettings() {
  exitGame();
  const libraryView = getEl('library-view');
  const settingsView = getEl('settings-view');
  const btnLibrary = getEl('btn-library');
  const btnSettings = getEl('btn-settings');

  if (libraryView) libraryView.classList.add('hidden');
  if (settingsView) settingsView.classList.remove('hidden');
  if (btnSettings) btnSettings.classList.add('active');
  if (btnLibrary) btnLibrary.classList.remove('active');
  await renderSettings();
}

export async function syncCatalogAndCheckUpdates() {
  const chkGlobalAuto = getEl('chk-global-auto-update');
  try {
    const data = await fetchRemoteCatalog();
    catalog = data.games || [];
  } catch (err) {
    console.warn("Could not fetch remote catalog, checking local manifest:", err);
    // Offline / fallback: reconstruct catalog from local manifest if available
    const manifest = await getManifest();
    catalog = Object.keys(manifest.games || {}).map(id => ({
      id,
      name: manifest.games[id].name || id,
      version: manifest.games[id].version || '1.0.0',
      type: manifest.games[id].type || 'html',
      entryPoint: manifest.games[id].entryPoint,
      url: ''
    }));
  }

  try {
    const manifest = await getManifest();
    if (chkGlobalAuto) {
      chkGlobalAuto.checked = !!manifest.settings.globalAutoUpdate;
    }
    const selectLanguage = getEl('select-language');
    if (selectLanguage) {
      selectLanguage.value = manifest.settings?.language || 'vi';
    }
    const lang = manifest.settings?.language || 'vi';

    // Detect updates; a game outside this launcher's version range is not offered (game-launcher-ota R18).
    const pendingUpdates = [];
    for (const game of catalog) {
      const meta = manifest.games[game.id];
      if (meta && meta.installed && meta.version !== game.version && launcherRange(game, getLauncherVersion()) === 'ok') {
        pendingUpdates.push({ ...game, installedVersion: meta.version });
      }
    }

    if (pendingUpdates.length > 0) {
      if (manifest.settings.globalAutoUpdate || manifest.settings.skipUpdatePrompt) {
        // R16: one failing game does not stop the others, and the player is told.
        const failed = [];
        for (const game of pendingUpdates) {
          const meta = manifest.games[game.id];
          if (manifest.settings.globalAutoUpdate || meta?.autoUpdate) {
            try {
              await installOrUpdateGame(game);
            } catch (err) {
              console.error(`Auto-update of ${game.id} failed:`, err);
              failed.push({ game, message: errorText(err, lang) });
            }
          }
        }
        renderLibrary();
        if (failed.length && typeof alert === 'function') {
          alert(failed.map((f) => `${t('update_result_failed', lang, { names: getGameName(f.game, lang) })} — ${f.message}`).join('\n'));
        }
      } else {
        promptUpdatesIfAvailable(pendingUpdates, () => renderLibrary(), {}, lang);
      }
    } else {
      renderLibrary();
    }
  } catch (err) {
    console.error("Sync error:", err);
    renderLibrary();
  }
}

export async function renderLibrary() {
  const gameList = getEl('game-list');
  if (!gameList) return;
  const manifest = await getManifest();
  const lang = manifest.settings?.language || 'vi';
  gameList.innerHTML = '';

  if (catalog.length === 0) {
    gameList.innerHTML = `<p class="empty-state">${t('no_games_catalog', lang)}</p>`;
    return;
  }

  catalog.forEach(game => {
    const meta = manifest.games[game.id] || {};
    const isInstalled = !!meta.installed;
    const isUpdate = isInstalled && meta.version !== game.version;
    const range = launcherRange(game, getLauncherVersion());
    const typeLabel = typeOf(game, meta).toUpperCase();

    let badgeClass = isUpdate ? 'badge-update' : isInstalled ? 'badge-ready' : 'badge-new';
    let badgeText = isUpdate ? t('badge_update', lang) : isInstalled ? t('badge_ready', lang) : t('badge_new', lang);
    let btnText = range === 'old' ? t('btn_update_launcher', lang)
      : range === 'new' ? t('range_new', lang)
      : isUpdate ? t('btn_update', lang) : isInstalled ? t('btn_play', lang) : t('btn_download', lang);

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `card-${game.id}`;
    card.innerHTML = `
      <div class="card-header">
        <span class="status-badge ${badgeClass}">${badgeText}</span>
        <div class="meta-tags">
          <span class="type-pill">${typeLabel}</span>
          <span class="version-tag">v${game.version}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="game-title">${getGameName(game, lang)}</h3>
        ${range !== 'ok' ? `<p class="card-note" role="status">${t(range === 'old' ? 'range_old' : 'range_new', lang)}</p>` : ''}
        ${meta.integrity === 'mismatch' ? `<p class="card-warning" role="status">${t('integrity_warning', lang)}</p>` : ''}
      </div>
      <div class="card-footer">
        <div class="progress-container hidden">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">0%</span>
        </div>
        <button class="action-btn" title="${btnText}" ${range === 'new' ? 'disabled' : ''}>${btnText}</button>
      </div>
    `;

    card.querySelector('.action-btn').addEventListener('click', () => {
      if (range === 'old') { updater?.checkNow(); return; }
      launchOrInstall(game, card, isInstalled && !isUpdate);
    });
    gameList.appendChild(card);
  });
}

export async function launchOrInstall(game, card, isReadyToPlay) {
  const libraryView = getEl('library-view');
  const settingsView = getEl('settings-view');
  const playerView = getEl('player-view');
  const gameFrame = getEl('game-frame');

  const actionBtn = card.querySelector('.action-btn');
  const progressContainer = card.querySelector('.progress-container');
  const progressFill = card.querySelector('.progress-bar-fill');
  const progressText = card.querySelector('.progress-text');

  const manifest = await getManifest();
  const lang = manifest.settings?.language || 'vi';

  if (!isReadyToPlay) {
    actionBtn.disabled = true;
    actionBtn.classList.add('hidden');
    progressContainer.classList.remove('hidden');

    busyCount++;
    try {
      await installOrUpdateGame(game, (percent) => {
        if (percent >= 0) {
          progressFill.style.width = `${percent}%`;
          progressText.textContent = t('downloading', lang, { percent });
        } else {
          progressFill.classList.add('indeterminate');
          progressText.textContent = t('processing', lang);
        }
      });
      await renderLibrary();
    } catch (err) {
      console.error(err);
      alert(`${t('download_failed', lang)}${errorText(err, lang)}`);
      actionBtn.disabled = false;
      actionBtn.classList.remove('hidden');
      progressContainer.classList.add('hidden');
      return;
    } finally {
      busyCount--;
    }
  }

  // Launch in iframe
  try {
    const launchConfig = await prepareGameForLaunch(game);
    if (libraryView) libraryView.classList.add('hidden');
    if (settingsView) settingsView.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');

    if (launchConfig.mode === 'url') {
      gameFrame.removeAttribute('srcdoc');
      gameFrame.src = launchConfig.url;
    } else {
      gameFrame.removeAttribute('src');
      gameFrame.srcdoc = launchConfig.content;
    }
    if (gameFrame && typeof gameFrame.focus === 'function') {
      gameFrame.focus();
    }
  } catch (err) {
    console.error(err);
    alert(`${t('launch_failed', lang)}${errorText(err, lang)}`);
    renderLibrary();
  }
}

export async function renderSettings() {
  const settingsGameList = getEl('settings-game-list');
  if (!settingsGameList) return;
  const manifest = await getManifest();
  const lang = manifest.settings?.language || 'vi';
  const selectLanguage = getEl('select-language');
  if (selectLanguage) {
    selectLanguage.value = lang;
  }
  const btnRemoveAll = getEl('btn-remove-all');
  if (btnRemoveAll) {
    const hasInstalled = Object.values(manifest.games || {}).some(g => g?.installed);
    btnRemoveAll.disabled = !hasInstalled;
  }

  // Launcher section: update mode, version, last check (game-launcher-ota R9, R16).
  const selectUpdateMode = getEl('select-update-mode');
  if (selectUpdateMode) selectUpdateMode.value = modeOf(manifest.settings);
  const aboutVersion = getEl('about-version');
  if (aboutVersion) aboutVersion.textContent = getLauncherVersion() || '';
  const aboutLast = getEl('about-last-check');
  if (aboutLast) {
    const last = manifest.settings?.lastUpdateCheck;
    aboutLast.textContent = Number.isFinite(last) ? new Date(last).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN') : t('never_checked', lang);
  }

  settingsGameList.innerHTML = '';

  if (catalog.length === 0) {
    settingsGameList.innerHTML = `<p class="empty-state">${t('no_games_settings', lang)}</p>`;
    return;
  }

  catalog.forEach(game => {
    const meta = manifest.games[game.id] || { installed: false, autoUpdate: false };
    const isInstalled = !!meta.installed;
    const isUpdate = isInstalled && meta.version !== game.version;
    const inRange = launcherRange(game, getLauncherVersion()) === 'ok';

    const row = document.createElement('div');
    row.className = 'settings-row';
    const statusText = isInstalled
      ? t('installed_status', lang, { installed: meta.version, target: game.version })
      : t('not_installed_status', lang, { version: game.version });

    row.innerHTML = `
      <div class="settings-game-info">
        <strong class="settings-game-title">${getGameName(game, lang)}</strong>
        <span class="version-tag">${statusText}</span>
        ${meta.integrity === 'mismatch' ? `<span class="card-warning" role="status">${t('integrity_warning', lang)}</span>` : ''}
      </div>
      <div class="settings-actions">
        <label class="auto-update-toggle">
          <input type="checkbox" class="chk-game-autoupdate" ${meta.autoUpdate ? 'checked' : ''} />
          <span>${t('auto_update', lang)}</span>
        </label>
        ${!isInstalled && inRange ? `<button class="btn-sm btn-predownload" title="${t('btn_predownload', lang)}">${t('btn_predownload', lang)}</button>` : ''}
        ${isInstalled && isUpdate && inRange ? `<button class="btn-sm btn-update" title="${t('btn_update_action', lang)}">${t('btn_update_action', lang)}</button>` : ''}
        ${isInstalled && inRange ? `<button class="btn-sm btn-redownload" title="${t('btn_redownload', lang)}">${t('btn_redownload', lang)}</button>` : ''}
        ${isInstalled ? `<button class="btn-sm btn-danger btn-remove" title="${t('btn_remove', lang)}">${t('btn_remove', lang)}</button>` : ''}
      </div>
    `;

    // Per-game Auto-update toggle
    const chkUpdate = row.querySelector('.chk-game-autoupdate');
    if (chkUpdate) {
      chkUpdate.addEventListener('change', async (e) => {
        await updateManifest((m) => {
          m.games[game.id] = m.games[game.id] || {};
          m.games[game.id].autoUpdate = e.target.checked;
        });
      });
    }

    // Download, update and redownload: the button shows its busy label, an error is caught, then the label is restored (R15).
    // Redownload no longer removes the game first: the install swaps the new copy in only when it is complete (R8).
    const wire = (selector, busyKey, action) => {
      const btn = row.querySelector(selector);
      if (!btn) return;
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = t(busyKey, lang);
        await guarded(action, lang);
        renderSettings();
      };
    };
    wire('.btn-predownload', 'btn_predownloading', () => installOrUpdateGame(game));
    wire('.btn-update', 'btn_updating', () => installOrUpdateGame(game));
    wire('.btn-redownload', 'btn_redownloading', () => installOrUpdateGame(game));

    // Remove
    const btnRemove = row.querySelector('.btn-remove');
    if (btnRemove) {
      btnRemove.onclick = async () => {
        if (confirm(t('confirm_remove', lang, { name: getGameName(game, lang) }))) {
          await guarded(() => removeGame(game.id), lang);
          renderSettings();
        }
      };
    }

    settingsGameList.appendChild(row);
  });
}

export function exitGame() {
  const gameFrame = getEl('game-frame');
  const playerView = getEl('player-view');
  const libraryView = getEl('library-view');
  const settingsView = getEl('settings-view');

  if (gameFrame) {
    gameFrame.removeAttribute('src');
    gameFrame.srcdoc = '';
  }
  if (playerView) playerView.classList.add('hidden');
  if (libraryView && settingsView && settingsView.classList.contains('hidden')) {
    libraryView.classList.remove('hidden');
    renderLibrary();
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}
