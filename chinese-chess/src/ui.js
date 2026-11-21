// ui.js — dialogs, screens, player bars, toasts, clocks, move list, history and game over.
(() => {
  const H = window.House;
  const t = (key, params) => H.i18n.t(key, params);
  const sideName = (s) => t(s === 'red' ? 'game.side.red' : 'game.side.black'); // s: 'red' | 'black'
  const PIECE = ['game.piece.k', 'game.piece.a', 'game.piece.e', 'game.piece.h', 'game.piece.r', 'game.piece.c', 'game.piece.p'];
  const SHORT = ['short.k', 'short.a', 'short.e', 'short.h', 'short.r', 'short.c', 'short.p'];
  let toastTimer = null;

  // Uses the static #app-toast (aria-live polite), so every toast is also read aloud.
  function toast(message, duration = 2400) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
  }

  const Ui = {
    toast,

    openDialog(id) {
      const dlg = document.getElementById(id);
      if (dlg) H.dialogs.open(dlg); // remembers the opener, returns focus on close, plays the open sound
    },

    closeDialog(id) {
      const dlg = document.getElementById(id);
      if (dlg) H.dialogs.close(dlg);
    },

    showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const sc = document.getElementById(id);
      if (sc) sc.classList.add('active');
    },

    showRulesPage() {
      const currentScreen = document.querySelector('.screen.active')?.id || 'screen-start';
      window.XQ.RulesPage.open(currentScreen);
    },

    updatePlayerBars(game) {
      const isPve = game.mode === 'pve';
      const humanSide = game.humanSide || 1;

      // Top player (Opponent)
      const topNameEl = document.getElementById('player-name-top');
      const topBadgeEl = document.getElementById('side-badge-top');
      const topSide = humanSide === 1 ? -1 : 1;
      if (topNameEl) {
        const level = t(`ai.${game.ai?.level || 'medium'}`);
        topNameEl.textContent = isPve ? t('player.computer', { level })
          : t(topSide === 1 ? 'player.one' : 'player.two', { side: sideName(topSide === 1 ? 'red' : 'black') });
      }
      if (topBadgeEl) {
        topBadgeEl.className = `side-badge ${topSide === 1 ? 'red' : 'black'}`;
      }

      // Bottom player (You)
      const botNameEl = document.getElementById('player-name-bottom');
      const botBadgeEl = document.getElementById('side-badge-bottom');
      if (botNameEl) {
        botNameEl.textContent = isPve ? t('player.you')
          : t(humanSide === 1 ? 'player.one' : 'player.two', { side: sideName(humanSide === 1 ? 'red' : 'black') });
      }
      if (botBadgeEl) {
        botBadgeEl.className = `side-badge ${humanSide === 1 ? 'red' : 'black'}`;
      }

      this.updateCapturedTray(game);
    },

    updateCapturedTray(game) {
      if (!game || !game.pos) return;
      const b = game.pos.board;
      // Starting pieces count: K:1, A:2, E:2, H:2, R:2, C:2, P:5
      const counts = {
        red:   { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        black: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
      };
      for (let i = 0; i < 90; i++) {
        const p = b[i];
        if (p > 0) counts.red[p]++;
        else if (p < 0) counts.black[-p]++;
      }

      const startTotal = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 5 };
      const lostList = (side) => {
        const out = [];
        for (let k = 1; k <= 7; k++) {
          const lost = startTotal[k] - counts[side][k];
          if (lost > 0) out.push(`${t(SHORT[k - 1])}${lost > 1 ? lost : ''}`);
        }
        return out;
      };
      const redLost = lostList('red');     // captured by Black
      const blackLost = lostList('black'); // captured by Red

      const trayTop = document.getElementById('captured-tray-top');
      const trayBot = document.getElementById('captured-tray-bottom');
      const humanSide = game.humanSide || 1;

      if (trayTop) {
        trayTop.innerHTML = (humanSide === 1 ? redLost : blackLost).map(s => `<span class="captured-chip">${s}</span>`).join('');
      }
      if (trayBot) {
        trayBot.innerHTML = (humanSide === 1 ? blackLost : redLost).map(s => `<span class="captured-chip">${s}</span>`).join('');
      }
    },

    updateClocks(game, activeSide, countdownActive = false, countdownSec = 0) {
      const topPill = document.getElementById('clock-pill-top');
      const botPill = document.getElementById('clock-pill-bottom');
      if (!topPill || !botPill) return;

      if (!game.timer || game.timer.mode === 'off') {
        topPill.style.display = 'none';
        botPill.style.display = 'none';
        return;
      }

      topPill.style.display = 'inline-block';
      botPill.style.display = 'inline-block';

      const humanSide = game.humanSide || 1;
      const topSide = humanSide === 1 ? -1 : 1;
      const botSide = humanSide;

      function fmtTime(sec) {
        if (sec <= 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        if (sec < 10) {
          const ds = Math.floor((sec * 10) % 10);
          return `${s}.${ds}`;
        }
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      }

      const tTime = game.timeLeft ? game.timeLeft[topSide === 1 ? 'red' : 'black'] : 0;
      const bTime = game.timeLeft ? game.timeLeft[botSide === 1 ? 'red' : 'black'] : 0;

      topPill.textContent = fmtTime(tTime);
      botPill.textContent = fmtTime(bTime);

      topPill.className = 'clock-pill' + (activeSide === topSide ? ' active' : '');
      botPill.className = 'clock-pill' + (activeSide === botSide ? ' active' : '');

      const activePill = activeSide === topSide ? topPill : botPill;
      const activeTime = activeSide === topSide ? tTime : bTime;

      if (activeTime <= 10 && activeTime > 5) {
        activePill.classList.add('warn');
      } else if (activeTime <= 5) {
        activePill.classList.add('danger');
      }

      // Countdown effect
      const overlay = document.getElementById('countdown-overlay');
      const vignette = document.getElementById('board-vignette');
      const numEl = document.getElementById('countdown-numeral');

      if (countdownActive && countdownSec >= 1 && countdownSec <= 5) {
        if (overlay) overlay.style.display = 'flex';
        if (vignette) vignette.classList.add('active');
        if (numEl) {
          numEl.textContent = countdownSec;
          numEl.classList.add('pop');
          setTimeout(() => numEl.classList.remove('pop'), 200);
        }
      } else {
        if (overlay) overlay.style.display = 'none';
        if (vignette) vignette.classList.remove('active');
      }
    },

    updateMoveListTable(game) {
      const container = document.getElementById('movelist-container');
      const sideContainer = document.getElementById('side-movelist-container');
      if (!container && !sideContainer) return;

      const plies = game.plies || [];
      const lang = H.i18n.lang;

      let html = `<table class="movelist-table"><thead><tr><th>#</th><th>${sideName('red')}</th><th>${sideName('black')}</th></tr></thead><tbody>`;
      let startPos = window.XQ.parseFen((game.rules && game.rules.startFen) || window.XQ.START_FEN);
      let curPos = window.XQ.clonePos(startPos);

      for (let i = 0; i < plies.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const redM = plies[i].m;
        const redNot = window.XQ.notation(curPos, redM, lang);
        curPos = window.XQ.applyMove(curPos, redM);

        let blackNot = '';
        const hasBlack = (i + 1 < plies.length);
        if (hasBlack) {
          const blackM = plies[i + 1].m;
          blackNot = window.XQ.notation(curPos, blackM, lang);
          curPos = window.XQ.applyMove(curPos, blackM);
        }

        html += `<tr><td>${moveNum}</td><td class="move-cell" data-ply="${i}" title="${t('move.n', { n: i + 1 })}">${redNot}</td><td class="move-cell" data-ply="${hasBlack ? i + 1 : -1}" title="${hasBlack ? t('move.n', { n: i + 2 }) : ''}">${blackNot}</td></tr>`;
      }
      html += '</tbody></table>';

      const attachClickEvents = (el) => {
        el.innerHTML = html;
        el.querySelectorAll('.move-cell').forEach(cell => {
          const plyIdx = parseInt(cell.dataset.ply, 10);
          if (plyIdx >= 0) {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
              if (window.XQ.controller && window.XQ.controller.replayToPly) {
                window.XQ.controller.replayToPly(plyIdx + 1);
              }
            });
          }
        });
      };

      if (sideContainer) {
        attachClickEvents(sideContainer);
        sideContainer.scrollTop = sideContainer.scrollHeight;
      }
      if (container) {
        attachClickEvents(container);
      }
    },

    updateHistoryList() {
      const container = document.getElementById('history-list-container');
      if (!container) return;

      const records = window.XQ.Storage.loadRecords();
      if (!records || records.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--muted);">${t('game.history.empty')}</div>`;
        return;
      }

      const lang = H.i18n.lang;
      const dtf = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

      const playLabel = t('game.replay.play');
      const reviewLabel = t('common.replay');

      let html = '';
      records.forEach((rec, idx) => {
        const dateStr = dtf.format(new Date(rec.endedAt || rec.startedAt || Date.now()));
        const modeLabel = rec.mode === 'pve' ? t('player.computer', { level: t(`ai.${rec.ai?.level || 'medium'}`) }) : t('mode.pvp');
        const pliesCount = rec.moveCount || (rec.moves ? rec.moves.trim().split(/\s+/).length : 0);

        let badgeClass = 'draw';
        let badgeText = t('history.draw');
        if (rec.status === 'win') {
          badgeClass = 'win';
          badgeText = t('history.win', { name: sideName(rec.winner) });
        } else if (rec.status === 'forfeit') {
          badgeClass = 'loss';
          badgeText = t('history.forfeit', { name: sideName(rec.loser) });
        } else if (rec.status === 'in_progress') {
          badgeClass = 'active';
          badgeText = t('game.status.inProgress');
        } else if (rec.status === 'abandoned') {
          badgeClass = 'abandoned';
          badgeText = t('history.abandoned');
        }

        html += `
          <div class="history-item" data-index="${idx}" style="display:flex; justify-content:space-between; align-items:center; gap:var(--sp-2);">
            <div class="history-item-info" data-index="${idx}" style="flex:1; cursor:pointer;" title="${reviewLabel}">
              <div style="display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap;">
                <span style="font-weight:700;">${modeLabel} · ${t('history.pliesCount', { n: pliesCount })}</span>
                <span class="status-badge ${badgeClass}">${badgeText}</span>
              </div>
              <div style="font-size:var(--fs-xs); color:var(--muted); margin-top:2px;">${dateStr}</div>
            </div>
            <div style="display:flex; gap:var(--sp-1); align-items:center; flex-shrink:0;">
              <button class="btn btn-sm btn-primary btn-history-review" data-index="${idx}">
                <span aria-hidden="true">👁</span> ${reviewLabel}
              </button>
              <button class="btn btn-sm btn-history-play" data-index="${idx}">
                <span aria-hidden="true">▶</span> ${playLabel}
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      container.querySelectorAll('.btn-history-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          const rec = records[idx];
          if (rec) {
            Ui.closeDialog('dialog-history');
            window.XQ.controller.playFromRecord(rec);
          }
        });
      });

      container.querySelectorAll('.btn-history-review, .history-item-info').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index, 10);
          const rec = records[idx];
          if (rec) {
            Ui.closeDialog('dialog-history');
            window.XQ.Replay.start(rec);
          }
        });
      });
    },

    renderHistory() {
      this.updateHistoryList();
    },

    // Text alternative for the 3D board: every piece by square, plus whose turn it is.
    describeBoard(pos) {
      const el = document.getElementById('board-text');
      if (!el || !pos) return;
      const lists = { red: [], black: [] };
      for (let sq = 0; sq < 90; sq++) {
        const p = pos.board[sq];
        if (!p) continue;
        const side = p > 0 ? 'red' : 'black';
        lists[side].push(`${t(PIECE[Math.abs(p) - 1])} ${window.XQ.sqName(sq)}`);
      }
      const turn = t('turn.of', { name: sideName(pos.side === 1 ? 'red' : 'black') });
      el.textContent = `${turn}. ${sideName('red')}: ${lists.red.join(', ')}. ${sideName('black')}: ${lists.black.join(', ')}.`;
    },

    showGameOver(result) {
      const dlg = document.getElementById('dialog-gameover');
      if (!dlg) return;

      const titleEl = document.getElementById('gameover-title');
      const reasonEl = document.getElementById('gameover-reason');

      const isPve = window.XQ.controller.getGame()?.mode === 'pve';
      const humanSide = window.XQ.controller.getGame()?.humanSide || 1;

      let title = t('gameover.title');
      if (result.status === 'win' || result.status === 'forfeit') {
        if (isPve) {
          const humanWon = (result.winner === 'red' && humanSide === 1) || (result.winner === 'black' && humanSide === -1);
          title = humanWon ? t('result.youWin') : t('result.youLose');
        } else {
          title = t('result.win', { name: sideName(result.winner) });
        }
      } else if (result.status === 'draw') {
        title = t('result.draw');
      }
      if (titleEl) titleEl.textContent = title;

      const reason = t(`game.reason.${result.reason || 'checkmate'}`, { name: sideName(result.loser) });
      if (reasonEl) reasonEl.textContent = reason;
      H.announce(`${title}. ${reason}`);

      this.openDialog('dialog-gameover');
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.toast = toast;
  window.XQ.ui = Ui;
})();
