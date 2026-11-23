import { updateManifest, installOrUpdateGame, getGameName } from './gameManager.js';
import { applyI18n, t, errorText } from './i18n.js';

// Game update dialog: pick games, watch progress, read the result, retry the ones that failed
// (game-launcher-hardening R16). When every update works the dialog closes by itself.
export function promptUpdatesIfAvailable(pendingGames, onCompleted = () => {}, customOps = {}, lang = 'vi') {
  const $ = (id) => document.getElementById(id);
  const modal = $('update-modal');
  const list = $('update-modal-list');
  const chkDontAsk = $('chk-dont-ask');
  const btnUpdateSelected = $('btn-update-selected');
  const btnUpdateAll = $('btn-update-all');
  const btnSkip = $('btn-update-skip');
  const progress = $('update-modal-progress');
  const result = $('update-modal-result');
  const btnRetry = $('btn-update-retry');
  const btnClose = $('btn-update-close');

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

  const choose = $('update-modal-choose'); // the pick-games part, hidden while updating
  const setHidden = (el, hidden) => { if (el) el.classList[hidden ? 'add' : 'remove']('hidden'); };
  const showStep = (step) => {
    setHidden(choose, step !== 'choose');
    setHidden(progress, step !== 'running');
    setHidden(result, step !== 'result');
    setHidden(btnUpdateAll, step !== 'choose');
    setHidden(btnUpdateSelected, step !== 'choose');
    setHidden(btnSkip, step !== 'choose');
    setHidden(btnRetry, step !== 'result');
    setHidden(btnClose, step !== 'result');
  };
  showStep('choose');
  modal.classList.remove('hidden');

  const finish = () => {
    modal.classList.add('hidden');
    onCompleted();
  };

  let updatedBefore = [];

  async function handleBatchUpdate(gamesToUpdate) {
    if (chkDontAsk && chkDontAsk.checked) {
      await updateManifest((m) => {
        m.settings.skipUpdatePrompt = true;
        m.settings.globalAutoUpdate = true;
      }, customOps);
    }

    showStep('running');
    const ok = [];
    const failed = [];
    for (const [i, game] of gamesToUpdate.entries()) {
      const name = getGameName(game, lang);
      const say = (extra = '') => { if (progress) progress.textContent = t('update_progress', lang, { name, done: i + 1, total: gamesToUpdate.length }) + extra; };
      say();
      try {
        await installOrUpdateGame(game, (p) => { if (p >= 0) say(` ${p}%`); }, customOps);
        ok.push(game);
      } catch (err) {
        console.error(`Failed to update ${name}:`, err);
        failed.push({ game, message: errorText(err, lang) });
      }
    }
    updatedBefore = [...updatedBefore, ...ok];

    if (!failed.length) { finish(); return; }

    if (result) {
      const names = (arr) => arr.map((g) => getGameName(g, lang)).join(', ');
      const lines = [];
      if (updatedBefore.length) lines.push(t('update_result_ok', lang, { names: names(updatedBefore) }));
      failed.forEach((f) => lines.push(`${t('update_result_failed', lang, { names: getGameName(f.game, lang) })} — ${f.message}`));
      result.innerHTML = '';
      lines.forEach((text) => {
        const p = document.createElement('p');
        p.textContent = text;
        result.appendChild(p);
      });
    }
    showStep('result');
    if (btnRetry) btnRetry.onclick = () => handleBatchUpdate(failed.map((f) => f.game));
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

  if (btnClose) btnClose.onclick = finish;

  if (btnSkip) {
    btnSkip.onclick = async () => {
      if (chkDontAsk && chkDontAsk.checked) {
        await updateManifest((m) => { m.settings.skipUpdatePrompt = true; }, customOps);
      }
      finish();
    };
  }
}
