import { 
  fetchRemoteCatalog, 
  getManifest, 
  saveManifest, 
  installOrUpdateGame, 
  removeGame, 
  prepareGameForLaunch 
} from './gameManager.js';
import { promptUpdatesIfAvailable } from './updateModal.js';

function getEl(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

let catalog = [];

export function getCatalog() {
  return catalog;
}

export function setCatalog(c) {
  catalog = c;
}

export async function init() {
  const btnLibrary = getEl('btn-library');
  const btnSettings = getEl('btn-settings');
  const btnExitGame = getEl('btn-exit-game');
  const chkGlobalAuto = getEl('chk-global-auto-update');

  if (btnLibrary) btnLibrary.addEventListener('click', showLibrary);
  if (btnSettings) btnSettings.addEventListener('click', showSettings);
  if (btnExitGame) btnExitGame.addEventListener('click', exitGame);

  if (chkGlobalAuto) {
    chkGlobalAuto.addEventListener('change', async (e) => {
      const manifest = await getManifest();
      manifest.settings.globalAutoUpdate = e.target.checked;
      await saveManifest(manifest);
    });
  }

  await syncCatalogAndCheckUpdates();
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
      url: ''
    }));
  }

  try {
    const manifest = await getManifest();
    if (chkGlobalAuto) {
      chkGlobalAuto.checked = !!manifest.settings.globalAutoUpdate;
    }

    // Detect updates
    const pendingUpdates = [];
    for (const game of catalog) {
      const meta = manifest.games[game.id];
      if (meta && meta.installed && meta.version !== game.version) {
        pendingUpdates.push({ ...game, installedVersion: meta.version });
      }
    }

    if (pendingUpdates.length > 0) {
      if (manifest.settings.globalAutoUpdate || manifest.settings.skipUpdatePrompt) {
        for (const game of pendingUpdates) {
          const meta = manifest.games[game.id];
          if (manifest.settings.globalAutoUpdate || meta?.autoUpdate) {
            await installOrUpdateGame(game);
          }
        }
        renderLibrary();
      } else {
        promptUpdatesIfAvailable(pendingUpdates, () => renderLibrary());
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
  gameList.innerHTML = '';

  if (catalog.length === 0) {
    gameList.innerHTML = `<p class="empty-state">No games available in catalog.</p>`;
    return;
  }

  catalog.forEach(game => {
    const meta = manifest.games[game.id] || {};
    const isInstalled = !!meta.installed;
    const isUpdate = isInstalled && meta.version !== game.version;
    const isZip = game.type === 'zip' || (game.url && game.url.endsWith('.zip'));

    let badgeClass = isUpdate ? 'badge-update' : isInstalled ? 'badge-ready' : 'badge-new';
    let badgeText = isUpdate ? 'Update Available' : isInstalled ? 'Installed' : 'Not Installed';
    let btnText = isUpdate ? 'Update & Play Game' : isInstalled ? 'Play Game' : 'Download & Play Game';

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `card-${game.id}`;
    card.innerHTML = `
      <div class="card-header">
        <span class="status-badge ${badgeClass}">${badgeText}</span>
        <div class="meta-tags">
          <span class="type-pill">${isZip ? 'ZIP' : 'HTML'}</span>
          <span class="version-tag">v${game.version}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="game-title">${game.name}</h3>
      </div>
      <div class="card-footer">
        <div class="progress-container hidden">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">0%</span>
        </div>
        <button class="action-btn" title="${btnText}">${btnText}</button>
      </div>
    `;

    card.querySelector('.action-btn').addEventListener('click', () => {
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

  if (!isReadyToPlay) {
    actionBtn.disabled = true;
    actionBtn.classList.add('hidden');
    progressContainer.classList.remove('hidden');

    try {
      await installOrUpdateGame(game, (percent) => {
        if (percent >= 0) {
          progressFill.style.width = `${percent}%`;
          progressText.textContent = `Downloading ${percent}%`;
        } else {
          progressFill.classList.add('indeterminate');
          progressText.textContent = 'Processing...';
        }
      });
    } catch (err) {
      alert(`Download failed: ${err.message}`);
      actionBtn.disabled = false;
      actionBtn.classList.remove('hidden');
      progressContainer.classList.add('hidden');
      return;
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
    alert(`Launch failed: ${err.message}`);
    renderLibrary();
  }
}

export async function renderSettings() {
  const settingsGameList = getEl('settings-game-list');
  if (!settingsGameList) return;
  const manifest = await getManifest();
  settingsGameList.innerHTML = '';

  if (catalog.length === 0) {
    settingsGameList.innerHTML = `<p class="empty-state">No games found in catalog.</p>`;
    return;
  }

  catalog.forEach(game => {
    const meta = manifest.games[game.id] || { installed: false, autoUpdate: false };
    const isInstalled = !!meta.installed;
    const isUpdate = isInstalled && meta.version !== game.version;

    const row = document.createElement('div');
    row.className = 'settings-row';
    row.innerHTML = `
      <div class="settings-game-info">
        <strong class="settings-game-title">${game.name}</strong>
        <span class="version-tag">${isInstalled ? `Installed: v${meta.version} | Target: v${game.version}` : `Not installed (Latest: v${game.version})`}</span>
      </div>
      <div class="settings-actions">
        <label class="auto-update-toggle">
          <input type="checkbox" class="chk-game-autoupdate" ${meta.autoUpdate ? 'checked' : ''} />
          <span>Auto-update</span>
        </label>
        ${!isInstalled ? `<button class="btn-sm btn-predownload" title="Pre-download Game">Pre-download Game</button>` : ''}
        ${isInstalled && isUpdate ? `<button class="btn-sm btn-update" title="Update Game">Update Game</button>` : ''}
        ${isInstalled ? `<button class="btn-sm btn-redownload" title="Redownload Game">Redownload Game</button>` : ''}
        ${isInstalled ? `<button class="btn-sm btn-danger btn-remove" title="Remove Game">Remove Game</button>` : ''}
      </div>
    `;

    // Per-game Auto-update toggle
    const chkUpdate = row.querySelector('.chk-game-autoupdate');
    if (chkUpdate) {
      chkUpdate.addEventListener('change', async (e) => {
        manifest.games[game.id] = manifest.games[game.id] || {};
        manifest.games[game.id].autoUpdate = e.target.checked;
        await saveManifest(manifest);
      });
    }

    // Pre-download
    const btnPredownload = row.querySelector('.btn-predownload');
    if (btnPredownload) {
      btnPredownload.onclick = async () => {
        btnPredownload.disabled = true;
        btnPredownload.textContent = 'Downloading Game...';
        await installOrUpdateGame(game);
        renderSettings();
      };
    }

    // Update
    const btnUpdate = row.querySelector('.btn-update');
    if (btnUpdate) {
      btnUpdate.onclick = async () => {
        btnUpdate.disabled = true;
        btnUpdate.textContent = 'Updating Game...';
        await installOrUpdateGame(game);
        renderSettings();
      };
    }

    // Redownload
    const btnRedownload = row.querySelector('.btn-redownload');
    if (btnRedownload) {
      btnRedownload.onclick = async () => {
        btnRedownload.disabled = true;
        btnRedownload.textContent = 'Redownloading Game...';
        await removeGame(game.id);
        await installOrUpdateGame(game);
        renderSettings();
      };
    }

    // Remove
    const btnRemove = row.querySelector('.btn-remove');
    if (btnRemove) {
      btnRemove.onclick = async () => {
        if (confirm(`Remove ${game.name} from local storage?`)) {
          await removeGame(game.id);
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
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}
