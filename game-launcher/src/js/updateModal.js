import { getManifest, saveManifest, installOrUpdateGame, getGameName } from './gameManager.js';
import { applyI18n, t } from './i18n.js';

export function promptUpdatesIfAvailable(pendingGames, onCompleted = () => {}, customOps = {}, lang = 'vi') {
  const modal = document.getElementById('update-modal');
  const list = document.getElementById('update-modal-list');
  const chkDontAsk = document.getElementById('chk-dont-ask');
  const btnUpdateSelected = document.getElementById('btn-update-selected');
  const btnUpdateAll = document.getElementById('btn-update-all');
  const btnSkip = document.getElementById('btn-update-skip');

  if (!modal || !list) return;

  applyI18n(lang);

  list.innerHTML = '';
  pendingGames.forEach(game => {
    const row = document.createElement('label');
    row.className = 'update-item-row';
    row.innerHTML = `
      <input type="checkbox" class="update-select-item" value="${game.id}" checked />
      <span class="game-name">${getGameName(game, lang)}</span>
      <span class="version-diff">${game.installedVersion || t('installed_label', lang)} ➔ v${game.version}</span>
    `;
    list.appendChild(row);
  });

  modal.classList.remove('hidden');

  async function handleBatchUpdate(gamesToUpdate) {
    if (chkDontAsk && chkDontAsk.checked) {
      const manifest = await getManifest(customOps);
      manifest.settings.skipUpdatePrompt = true;
      manifest.settings.globalAutoUpdate = true;
      await saveManifest(manifest, customOps);
    }

    modal.classList.add('hidden');

    for (const game of gamesToUpdate) {
      try {
        await installOrUpdateGame(game, () => {}, customOps);
      } catch (err) {
        console.error(`Failed to update ${getGameName(game, lang)}:`, err);
      }
    }
    onCompleted();
  }

  if (btnUpdateAll) {
    btnUpdateAll.onclick = () => handleBatchUpdate(pendingGames);
  }

  if (btnUpdateSelected) {
    btnUpdateSelected.onclick = () => {
      const checkedIds = Array.from(list.querySelectorAll('.update-select-item:checked'))
        .map(cb => cb.value);
      const selectedGames = pendingGames.filter(g => checkedIds.includes(g.id));
      return handleBatchUpdate(selectedGames);
    };
  }

  if (btnSkip) {
    btnSkip.onclick = async () => {
      if (chkDontAsk && chkDontAsk.checked) {
        const manifest = await getManifest(customOps);
        manifest.settings.skipUpdatePrompt = true;
        await saveManifest(manifest, customOps);
      }
      modal.classList.add('hidden');
      onCompleted();
    };
  }
}
