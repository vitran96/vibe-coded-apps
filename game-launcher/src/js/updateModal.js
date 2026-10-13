import { getManifest, saveManifest, installOrUpdateGame, getGameName } from './gameManager.js';

export function promptUpdatesIfAvailable(pendingGames, onCompleted = () => {}, customOps = {}) {
  const modal = document.getElementById('update-modal');
  const list = document.getElementById('update-modal-list');
  const chkDontAsk = document.getElementById('chk-dont-ask');
  const btnUpdateSelected = document.getElementById('btn-update-selected');
  const btnUpdateAll = document.getElementById('btn-update-all');
  const btnSkip = document.getElementById('btn-update-skip');

  if (!modal || !list) return;

  list.innerHTML = '';
  pendingGames.forEach(game => {
    const row = document.createElement('label');
    row.className = 'update-item-row';
    row.innerHTML = `
      <input type="checkbox" class="update-select-item" value="${game.id}" checked />
      <span class="game-name">${getGameName(game)}</span>
      <span class="version-diff">${game.installedVersion || 'Installed'} ➔ v${game.version}</span>
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
        console.error(`Failed to update ${getGameName(game)}:`, err);
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
