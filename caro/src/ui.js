'use strict';
// 11 UI Bindings (Dialogs, forms, history, toasts)
// ============================================================
function toast(msg, dur = 3200) {
  const c = $('#toasts');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast glass';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, dur);
}

function confirmDialog(msg, sub = '') {
  return new Promise((resolve) => {
    const dlg = $('#dlg-confirm');
    $('#cf-msg').textContent = msg;
    $('#cf-sub').textContent = sub;
    const onYes = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };
    function cleanup() {
      $('#cf-yes').removeEventListener('click', onYes);
      $('#cf-no').removeEventListener('click', onNo);
      dlg.close();
    }
    $('#cf-yes').addEventListener('click', onYes);
    $('#cf-no').addEventListener('click', onNo);
    dlg.showModal();
  });
}

function renderGameFields(container, values, prefix = '') {
  const p = prefix ? prefix + '_' : '';
  container.innerHTML = `
    <div class="field">
      <span class="lbl">${t('gameMode')}</span>
      <div class="seg" data-name="${p}mode">
        <label><input type="radio" name="${p}mode" value="pve" ${values.mode === 'pve' ? 'checked' : ''}><span>${t('vsAI')}</span></label>
        <label><input type="radio" name="${p}mode" value="pvp" ${values.mode === 'pvp' ? 'checked' : ''}><span>${t('twoPlayers')}</span></label>
      </div>
    </div>

    <div class="sec-ai" ${values.mode !== 'pve' ? 'hidden' : ''}>
      <div class="field">
        <span class="lbl">${t('aiDifficulty')}</span>
        <div class="seg" data-name="${p}difficulty">
          <label><input type="radio" name="${p}difficulty" value="easy" ${values.difficulty === 'easy' ? 'checked' : ''}><span>${t('easy')}</span></label>
          <label><input type="radio" name="${p}difficulty" value="medium" ${values.difficulty === 'medium' ? 'checked' : ''}><span>${t('medium')}</span></label>
          <label><input type="radio" name="${p}difficulty" value="hard" ${values.difficulty === 'hard' ? 'checked' : ''}><span>${t('hard')}</span></label>
        </div>
      </div>
      <div class="field">
        <span class="lbl">${t('playAs')}</span>
        <div class="seg" data-name="${p}playAs">
          <label><input type="radio" name="${p}playAs" value="x" ${values.playAs === 'x' ? 'checked' : ''}><span>${t('xFirst')}</span></label>
          <label><input type="radio" name="${p}playAs" value="o" ${values.playAs === 'o' ? 'checked' : ''}><span>${t('oSecond')}</span></label>
          <label><input type="radio" name="${p}playAs" value="random" ${values.playAs === 'random' ? 'checked' : ''}><span>${t('random')}</span></label>
        </div>
      </div>
    </div>

    <div class="sec-pvp" ${values.mode !== 'pvp' ? 'hidden' : ''}>
      <div class="names">
        <div><span class="lbl">${t('player1')}</span><input type="text" name="${p}name1" value="${esc(values.name1 || t('defaultNameX'))}" maxlength="24"></div>
        <div><span class="lbl">${t('player2')}</span><input type="text" name="${p}name2" value="${esc(values.name2 || t('defaultNameO'))}" maxlength="24"></div>
      </div>
    </div>

    <div class="field">
      <span class="lbl">${t('rule')}</span>
      <div class="seg" data-name="${p}rule">
        <label><input type="radio" name="${p}rule" value="caro" ${values.rule === 'caro' ? 'checked' : ''}><span>${t('ruleCaro')}</span></label>
        <label><input type="radio" name="${p}rule" value="gomoku" ${values.rule === 'gomoku' ? 'checked' : ''}><span>${t('ruleGomoku')}</span></label>
      </div>
      <p class="note" id="${p}rule-explain">${values.rule === 'caro' ? t('caroExplain') : t('gomokuExplain')}</p>
      <div class="sub-opts">
        <div class="row row-caro-sub" ${values.rule !== 'caro' ? 'hidden' : ''}>
          <div><span class="lbl">${t('edgeBlocks')}</span><span class="sub">${t('edgeBlocksSub')}</span></div>
          <label class="switch"><input type="checkbox" name="${p}edgeBlocks" ${values.edgeBlocks ? 'checked' : ''}><span></span></label>
        </div>
        <div class="row row-gomoku-sub" ${values.rule !== 'gomoku' ? 'hidden' : ''}>
          <div><span class="lbl">${t('exactFive')}</span><span class="sub">${t('exactFiveSub')}</span></div>
          <label class="switch"><input type="checkbox" name="${p}exactFive" ${values.exactFive ? 'checked' : ''}><span></span></label>
        </div>
      </div>
    </div>

    <div class="row">
      <div><span class="lbl">${t('turnTimer')}</span><span class="sub">${t('turnTimerSub')}</span></div>
      <label class="switch"><input type="checkbox" name="${p}timerEnabled" ${values.timerEnabled ? 'checked' : ''}><span></span></label>
    </div>

    <div class="sec-timer" ${!values.timerEnabled ? 'hidden' : ''}>
      <div class="field">
        <span class="lbl">${t('timePerTurn')}</span>
        <div class="seg" data-name="${p}timerSeconds">
          ${TIME_PRESETS.map(sec => {
            const lbl = sec < 60 ? `${sec}s` : t('minutesShort', sec / 60);
            return `<label><input type="radio" name="${p}timerSeconds" value="${sec}" ${values.timerSeconds === sec ? 'checked' : ''}><span>${lbl}</span></label>`;
          }).join('')}
        </div>
      </div>
      <div class="field">
        <span class="lbl">${t('onTimeout')}</span>
        <div class="seg" data-name="${p}onTimeout">
          <label><input type="radio" name="${p}onTimeout" value="lose" ${values.onTimeout === 'lose' ? 'checked' : ''}><span>${t('loseGame')}</span></label>
          <label><input type="radio" name="${p}onTimeout" value="skip" ${values.onTimeout === 'skip' ? 'checked' : ''}><span>${t('skipTurn')}</span></label>
        </div>
      </div>
    </div>
  `;

  // Attach dynamic toggle listeners
  const modeInputs = container.querySelectorAll(`input[name="${p}mode"]`);
  modeInputs.forEach(i => i.addEventListener('change', () => {
    const isPve = i.value === 'pve';
    container.querySelector('.sec-ai').hidden = !isPve;
    container.querySelector('.sec-pvp').hidden = isPve;
  }));

  const ruleInputs = container.querySelectorAll(`input[name="${p}rule"]`);
  ruleInputs.forEach(i => i.addEventListener('change', () => {
    const isCaro = i.value === 'caro';
    container.querySelector('.row-caro-sub').hidden = !isCaro;
    container.querySelector('.row-gomoku-sub').hidden = isCaro;
    const expl = container.querySelector(`#${p}rule-explain`);
    if (expl) {
      expl.textContent = isCaro
        ? 'Win with 5 in a row that is not blocked at both ends.'
        : 'Win with 5 or more in a row.';
    }
  }));

  const timerInput = container.querySelector(`input[name="${p}timerEnabled"]`);
  if (timerInput) {
    timerInput.addEventListener('change', () => {
      container.querySelector('.sec-timer').hidden = !timerInput.checked;
    });
  }
}

function getGameFieldsValues(container, prefix = '') {
  const p = prefix ? prefix + '_' : '';
  const getChecked = (name) => {
    const el = container.querySelector(`input[name="${p}${name}"]:checked`);
    return el ? el.value : null;
  };
  const getBool = (name) => {
    const el = container.querySelector(`input[name="${p}${name}"]`);
    return el ? el.checked : false;
  };
  const getText = (name) => {
    const el = container.querySelector(`input[name="${p}${name}"]`);
    return el ? el.value.trim() : '';
  };

  return {
    mode: getChecked('mode') || 'pve',
    difficulty: getChecked('difficulty') || 'medium',
    playAs: getChecked('playAs') || 'x',
    name1: getText('name1') || 'Player X',
    name2: getText('name2') || 'Player O',
    rule: getChecked('rule') || 'caro',
    edgeBlocks: getBool('edgeBlocks'),
    exactFive: getBool('exactFive'),
    boardSize: 30,
    timerEnabled: getBool('timerEnabled'),
    timerSeconds: parseInt(getChecked('timerSeconds') || '30', 10),
    onTimeout: getChecked('onTimeout') || 'lose'
  };
}

// A switch has no visible text of its own: name it after the row label it sits beside (axe: label).
function labelSwitches(root = document) {
  root.querySelectorAll('label.switch input').forEach(inp => {
    const lbl = inp.closest('.row')?.querySelector('.lbl');
    if (!lbl) return;
    lbl.id ||= uuid();
    inp.setAttribute('aria-labelledby', lbl.id);
  });
}

class UIBindings {
  constructor() {
    this.initDialogCloseButtons();
    this.initToolbar();
    this.initNewGameDialog();
    this.initSettingsDialog();
    this.initHistoryDialog();
    this.initResultDialog();
    this.initMenuDialog();
    this.initSoundHint();
  }

  initDialogCloseButtons() {
    $$('dialog [data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('dialog')?.close();
      });
    });
  }

  initToolbar() {
    $('#btn-undo')?.addEventListener('click', () => App.game.undo());
    $('#btn-fit')?.addEventListener('click', () => App.renderer.fitBoard());
    $('#btn-menu')?.addEventListener('click', () => $('#dlg-menu')?.showModal());
  }

  async openNewGame() {
    if (App.game.state === 'playing' && App.game.moves.length >= 5) {
      const ok = await confirmDialog(t('startNewConfirmTitle'), t('startNewConfirmSub'));
      if (!ok) return;
    }
    const dlg = $('#dlg-new-game');
    const container = dlg.querySelector('.game-fields');
    renderGameFields(container, App.settings.game, 'ng');
    labelSwitches(dlg);
    dlg.showModal();
  }

  initNewGameDialog() {
    const form = $('#form-new');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const vals = getGameFieldsValues(form, 'ng');
      const saveDefault = form.querySelector('input[name="saveDefault"]')?.checked;

      if (saveDefault) {
        App.settings.game = { ...App.settings.game, ...vals };
        saveSettings();
        toast(t('savedAsDefault'));
      }

      let first = 1;
      if (vals.mode === 'pve') {
        if (vals.playAs === 'o') first = 2;
        else if (vals.playAs === 'random') first = Math.random() < 0.5 ? 1 : 2;
      }
      const aiSide = vals.mode === 'pve' ? (first === 1 ? 2 : 1) : null;

      const newSession = {
        id: uuid(),
        startedAt: Date.now(),
        mode: vals.mode,
        ai: vals.mode === 'pve' ? { difficulty: vals.difficulty, side: aiSide } : null,
        boardSize: vals.boardSize,
        rules: {
          mode: vals.rule,
          exactFive: vals.exactFive,
          edgeBlocks: vals.edgeBlocks
        },
        timer: {
          enabled: vals.timerEnabled,
          seconds: vals.timerSeconds,
          onTimeout: vals.onTimeout
        },
        players: {
          1: { name: vals.mode === 'pve' ? (aiSide === 1 ? `AI (${vals.difficulty})` : 'You') : vals.name1 || 'Player X' },
          2: { name: vals.mode === 'pve' ? (aiSide === 2 ? `AI (${vals.difficulty})` : 'You') : vals.name2 || 'Player O' }
        },
        firstPlayer: first
      };

      $('#dlg-new-game')?.close();
      App.game.startNewGame(newSession);
    });
  }

  openSettings() {
    const dlg = $('#dlg-settings');
    const container = dlg.querySelector('.game-fields');
    renderGameFields(container, App.settings.game, 'st');
    labelSwitches(dlg);

    // Undo button switch
    const uSwitch = dlg.querySelector('input[name="allowUndo"]');
    if (uSwitch) uSwitch.checked = App.settings.game.allowUndo !== false;

    // Audio values
    const mOn = dlg.querySelector('input[name="musicOn"]');
    const mVol = dlg.querySelector('input[name="musicVol"]');
    const sOn = dlg.querySelector('input[name="sfxOn"]');
    const sVol = dlg.querySelector('input[name="sfxVol"]');
    if (mOn) mOn.checked = App.settings.audio.musicOn;
    if (mVol) mVol.value = App.settings.audio.musicVol;
    if (sOn) sOn.checked = App.settings.audio.sfxOn;
    if (sVol) sVol.value = App.settings.audio.sfxVol;

    // Display values
    this.setSegmented(dlg, 'lang', App.settings.display.lang || 'vi', [
      ['vi', 'Tiếng Việt'],
      ['en', 'English']
    ]);
    this.setSegmented(dlg, 'theme', House.prefs.load().theme, [['giay', t('theme.giay')], ['dem', t('theme.dem')], ['sonmai', t('theme.sonmai')], ['bien', t('theme.bien')]]);
    this.setSegmented(dlg, 'cellSize', App.settings.display.cellSize || (IS_TOUCH_DEVICE ? 'large' : 'normal'), [
      ['normal', t('optCellNormal')],
      ['large', t('optCellLarge')],
      ['huge', t('optCellHuge')]
    ]);
    this.setSegmented(dlg, 'pieceStyle', App.settings.display.pieceStyle, [
      ['auto', t('optAuto')],
      ['xo', 'X-O'],
      ['stones', t('optStones')]
    ]);
    this.setSegmented(dlg, 'tapConfirm', App.settings.display.tapConfirm, [
      ['auto', t('optTouchAuto')],
      ['always', t('optAlways')],
      ['never', t('optNever')]
    ]);
    this.setSegmented(dlg, 'reduceMotion', App.settings.display.reduceMotion, [
      ['system', t('optSystem')],
      ['on', t('optOn')],
      ['off', t('optOff')]
    ]);
    const coords = dlg.querySelector('input[name="showCoords"]');
    if (coords) coords.checked = App.settings.display.showCoords;

    // Listen for language switch live
    dlg.querySelectorAll('input[name="st_lang"]').forEach(radio => {
      radio.onchange = () => {
        App.settings.display.lang = radio.value;
        saveSettings();
        setLang(radio.value);
        this.openSettings();
      };
    });

    const ver = dlg.querySelector('#st-version');
    if (ver) ver.textContent = APP_VERSION;

    dlg.showModal();
  }

  setSegmented(scope, name, val, customOpts = null) {
    const seg = scope.querySelector(`.seg[data-seg="${name}"]`);
    if (!seg) return;
    const opts = customOpts || seg.dataset.opts.split('|').map(s => s.split(':'));
    seg.innerHTML = opts.map(([v, label]) => `
      <label><input type="radio" name="st_${name}" value="${v}" ${v === val ? 'checked' : ''}><span>${label}</span></label>
    `).join('');
  }

  initSettingsDialog() {
    const form = $('#form-settings');

    // Live audio sliders
    form?.querySelector('input[name="musicVol"]')?.addEventListener('input', (e) => {
      App.settings.audio.musicVol = parseInt(e.target.value, 10);
      App.audio.applySettings();
    });
    form?.querySelector('input[name="sfxVol"]')?.addEventListener('input', (e) => {
      App.settings.audio.sfxVol = parseInt(e.target.value, 10);
      App.audio.applySettings();
    });
    form?.querySelector('input[name="sfxVol"]')?.addEventListener('change', () => {
      App.audio.playClick();
    });
    form?.querySelector('input[name="musicOn"]')?.addEventListener('change', (e) => {
      App.settings.audio.musicOn = e.target.checked;
      App.audio.applySettings();
    });
    form?.querySelector('input[name="sfxOn"]')?.addEventListener('change', (e) => {
      App.settings.audio.sfxOn = e.target.checked;
      App.audio.applySettings();
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      // Game defaults
      const gVals = getGameFieldsValues(form, 'st');
      const allowUndo = !!form.querySelector('input[name="allowUndo"]')?.checked;
      App.settings.game = { ...App.settings.game, ...gVals, allowUndo };

      // Display options
      const lang = form.querySelector('input[name="st_lang"]:checked')?.value || 'vi';
      const theme = form.querySelector('input[name="st_theme"]:checked')?.value || 'giay';
      const cellSize = form.querySelector('input[name="st_cellSize"]:checked')?.value || 'normal';
      const pieceStyle = form.querySelector('input[name="st_pieceStyle"]:checked')?.value || 'auto';
      const tapConfirm = form.querySelector('input[name="st_tapConfirm"]:checked')?.value || 'auto';
      const reduceMotion = form.querySelector('input[name="st_reduceMotion"]:checked')?.value || 'system';
      const showCoords = !!form.querySelector('input[name="showCoords"]')?.checked;

      App.settings.display = { lang, cellSize, pieceStyle, tapConfirm, reduceMotion, showCoords };
      House.applyTheme(theme);
      House.prefs.save({ theme });
      setLang(lang);
      saveSettings();
      this.applyDisplaySettings();
      $('#dlg-settings')?.close();
      toast(t('settingsSaved'));
    });

    // History JSON Export
    $('#btn-export')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(App.records, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `caro-records-${new Date().toISOString().slice(0, 10)}.json`);
      a.click();
    });

    // History JSON Import
    $('#btn-import')?.addEventListener('click', () => {
      $('#import-file')?.click();
    });

    $('#import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const items = JSON.parse(evt.target.result);
          if (Array.isArray(items)) {
            const valid = items.filter(validRecord);
            const merged = [...valid, ...App.records];
            // Deduplicate by ID
            const seen = new Set();
            App.records = merged.filter(r => seen.has(r.id) ? false : seen.add(r.id)).slice(0, MAX_RECORDS);
            saveRecords();
            toast(t('importedRecords', valid.length));
            this.renderHistoryList();
          } else {
            toast(t('invalidJson'));
          }
        } catch {
          toast(t('invalidJson'));
        }
      };
      reader.readAsText(file);
    });

    // Clear history
    $('#btn-clear-history')?.addEventListener('click', async () => {
      const ok = await confirmDialog(t('confirmClearTitle'), t('confirmClearSub'));
      if (ok) {
        App.records = [];
        saveRecords();
        this.renderHistoryList();
        toast(t('historyCleared'));
      }
    });

    // Reset settings
    $('#btn-reset-settings')?.addEventListener('click', async () => {
      const ok = await confirmDialog(t('confirmResetTitle'));
      if (ok) {
        App.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        saveSettings();
        applyI18n();
        this.applyDisplaySettings();
        App.audio.applySettings();
        $('#dlg-settings')?.close();
        toast(t('settingsReset'));
      }
    });
  }

  applyDisplaySettings() {
    const d = App.settings.display;

    // Undo button visibility
    const undoBtn = $('#btn-undo');
    if (undoBtn) undoBtn.hidden = App.settings.game.allowUndo === false;

    // Reduce motion class
    const isReduce = d.reduceMotion === 'on' || (d.reduceMotion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.documentElement.classList.toggle('reduce-motion', isReduce);

    // Rebuild board rendering elements if needed
    if (App.game.session) {
      App.renderer.buildBoard(App.game.session.boardSize);
      // Restore stones on board
      for (let i = 0; i < App.game.board.length; i++) {
        const p = App.game.board[i];
        if (p > 0) {
          App.renderer.setStone(i % App.game.session.boardSize, Math.floor(i / App.game.session.boardSize), p, false);
        }
      }
      const last = App.game.moves[App.game.moves.length - 1];
      if (last && !last.pass) App.renderer.setLastMove(last.x, last.y);
      App.renderer.camera.zoom = App.renderer.getTargetZoom();
      App.renderer.clampCamera();
      App.renderer.camera.updateProjectionMatrix();
      App.renderer.needsRender = true;
    }
  }

  openHistory() {
    this.renderHistoryList();
    $('#dlg-history')?.showModal();
  }

  openHelp() {
    $('#dlg-help')?.showModal();
  }

  // Key M: same setting as the Sound checkbox in Settings.
  toggleSound() {
    App.settings.audio.sfxOn = !App.settings.audio.sfxOn;
    saveSettings();
    App.audio.applySettings();
  }

  renderHistoryList() {
    const list = $('#hist-list');
    const modeFilter = $('#hf-mode')?.value || 'all';
    const resFilter = $('#hf-result')?.value || 'all';
    if (!list) return;

    let items = App.records.slice();
    if (modeFilter !== 'all') {
      items = items.filter(r => r.session.mode === modeFilter);
    }
    if (resFilter !== 'all') {
      items = items.filter(r => {
        if (resFilter === 'won') return r.session.mode === 'pve' && r.result.winner !== r.session.ai?.side && r.result.winner > 0;
        if (resFilter === 'lost') return r.session.mode === 'pve' && r.result.winner === r.session.ai?.side;
        if (resFilter === 'x') return r.result.winner === 1;
        if (resFilter === 'o') return r.result.winner === 2;
        if (resFilter === 'draw') return r.result.winner === 0;
        if (resFilter === 'forfeit') return r.result.reason === 'forfeit';
        if (resFilter === 'abandoned') return r.result.reason === 'abandoned';
        return true;
      });
    }

    if (items.length === 0) {
      list.innerHTML = `<li class="empty">${t('noRecords')}</li>`;
      return;
    }

    list.innerHTML = items.map(r => {
      const dateStr = new Date(r.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const turnEnd = r.result.turnAtEnd || (r.moves.length > 0 ? (r.moves[r.moves.length - 1].p === 1 ? 2 : 1) : r.session.firstPlayer);
      const turnEndName = pieceName(turnEnd);

      let outcome = '';
      if (r.result.reason === 'forfeit') {
        const forfPlayer = r.result.forfeitedBy || (3 - r.result.winner);
        const winPlayer = r.result.winner;
        if (r.session.mode === 'pve' && r.session.ai) {
          const who = winPlayer === r.session.ai.side ? t('lostVsAI') + ` (${t('forfeit')})` : t('wonVsAI') + ` (${t('forfeit')})`;
          outcome = `${who} • ${t('turnPlayer', turnEndName)}`;
        } else {
          outcome = `${t('playerForfeited', pieceName(forfPlayer))} (${pieceName(winPlayer)} • ${t('turnPlayer', turnEndName)})`;
        }
      } else if (r.result.winner === 0) {
        outcome = `${t('draw')} • ${t('turnPlayer', turnEndName)}`;
      } else if (r.session.mode === 'pve') {
        const who = r.result.winner === r.session.ai?.side ? t('lostVsAI') : t('wonVsAI');
        outcome = `${who} • ${t('turnPlayer', turnEndName)}`;
      } else {
        outcome = `${pieceName(r.result.winner)} ${t('xWon').replace('X ', '')} • ${t('turnPlayer', turnEndName)}`;
      }

      const diffLabel = r.session.ai?.difficulty ? t(r.session.ai.difficulty) : '';
      const modeStr = r.session.mode === 'pve' ? `${t('vsAI')} (${diffLabel})` : t('twoPlayers');
      const ruleBadge = r.session.rules.mode === 'caro' ? 'Caro' : 'Gomoku';

      return `
        <li class="hist-item" data-id="${r.id}">
          <div class="hist-main">
            <div class="hist-title">${outcome} &bull; ${modeStr}</div>
            <div class="hist-meta">
              <span>${dateStr}</span>
              <span>${ruleBadge}</span>
              <span>${r.session.boardSize}×${r.session.boardSize}</span>
              <span>${t('movesCount', r.moves.length)}</span>
            </div>
          </div>
          <button class="btn btn-replay" data-id="${r.id}">${t('replayBtn')}</button>
          <button class="icon-btn btn-del" data-id="${r.id}" title="${t('deleteBtnTitle')}" aria-label="${t('deleteBtnTitle')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </li>
      `;
    }).join('');

    // Replay buttons
    list.querySelectorAll('.btn-replay').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const rec = App.records.find(r => r.id === id);
        if (rec) {
          $('#dlg-history')?.close();
          App.replay.startReplay(rec);
        }
      });
    });

    // Delete buttons
    list.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        App.records = App.records.filter(r => r.id !== id);
        saveRecords();
        this.renderHistoryList();
        toast(t('recordDeleted'));
      });
    });
  }

  initHistoryDialog() {
    $('#hf-mode')?.addEventListener('change', () => this.renderHistoryList());
    $('#hf-result')?.addEventListener('change', () => this.renderHistoryList());
  }

  initResultDialog() {
    $('#rs-rematch')?.addEventListener('click', () => {
      $('#dlg-result')?.close();
      const prev = App.game.session;
      const rematchSession = JSON.parse(JSON.stringify(prev));
      rematchSession.id = uuid();
      rematchSession.startedAt = Date.now();
      rematchSession.firstPlayer = 3 - prev.firstPlayer;
      if (rematchSession.mode === 'pve' && rematchSession.ai) {
        rematchSession.ai.side = 3 - rematchSession.ai.side;
        // Swap names
        const p1 = rematchSession.players[1].name;
        rematchSession.players[1].name = rematchSession.players[2].name;
        rematchSession.players[2].name = p1;
      }
      App.game.startNewGame(rematchSession);
    });

    $('#rs-new')?.addEventListener('click', () => {
      $('#dlg-result')?.close();
      this.openNewGame();
    });

    $('#rs-replay')?.addEventListener('click', () => {
      $('#dlg-result')?.close();
      const lastRec = App.records[0];
      if (lastRec) {
        App.replay.startReplay(lastRec);
      }
    });
  }

  initMenuDialog() {
    $('#mn-vs-bot')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      const g = App.settings.game;
      const s = App.game.createDefaultSession();
      s.mode = 'pve';
      s.ai = { difficulty: g.difficulty || 'medium', side: 2 };
      s.players[1].name = t('playAsYou');
      s.players[2].name = `AI (${t(g.difficulty || 'medium')})`;
      App.game.startNewGame(s);
    });

    $('#mn-vs-player')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      const s = App.game.createDefaultSession();
      s.mode = 'pvp';
      s.ai = null;
      s.players[1].name = App.settings.game.name1 || t('defaultP1');
      s.players[2].name = App.settings.game.name2 || t('defaultP2');
      App.game.startNewGame(s);
    });

    $('#mn-new')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      this.openNewGame();
    });

    $('#mn-restart')?.addEventListener('click', async () => {
      if (App.game.state === 'playing' && App.game.moves.length >= 2) {
        const ok = await confirmDialog(t('confirmRestartTitle'), t('confirmRestartSub'));
        if (!ok) return;
      }
      $('#dlg-menu')?.close();
      const prev = App.game.session || App.game.createDefaultSession();
      const s = JSON.parse(JSON.stringify(prev));
      s.id = uuid();
      s.startedAt = Date.now();
      App.game.startNewGame(s);
      toast(t('gameRestarted'));
    });

    $('#mn-replay')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      this.openHistory();
    });

    $('#mn-settings')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      this.openSettings();
    });

    $('#mn-help')?.addEventListener('click', () => {
      $('#dlg-menu')?.close();
      this.openHelp();
    });

    $('#mn-forfeit')?.addEventListener('click', async () => {
      $('#dlg-menu')?.close();
      if (App.game.state === 'playing') {
        const ok = await confirmDialog(t('confirmForfeitTitle'), t('confirmForfeitSub'));
        if (!ok) return;
        App.game.forfeit();
      } else {
        toast(t('noGameToForfeit'));
      }
    });
  }

  initSoundHint() {
    const hint = $('#sound-hint');
    if (!hint) return;
    hint.hidden = false;
    hint.addEventListener('click', () => {
      App.audio.unlock();
    });
  }
}

// ============================================================
