// ui.js — Dialogs, sheets, player bars, toasts, timer UI, and countdown effects
(() => {
  let toastTimer = null;

  function toast(message, duration = 2400) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.display = 'none';
    }, duration);
  }

  function announceLive(message) {
    const el = document.getElementById('app-live-region');
    if (el) el.textContent = message;
  }

  const Ui = {
    toast,
    announceLive,

    openDialog(id) {
      const dlg = document.getElementById(id);
      if (dlg && !dlg.open) {
        if (typeof dlg.showModal === 'function') dlg.showModal();
        else dlg.setAttribute('open', '');
        window.XQ.Audio.play('open');
      }
    },

    closeDialog(id) {
      const dlg = document.getElementById(id);
      if (dlg && dlg.open) {
        if (typeof dlg.close === 'function') dlg.close();
        else dlg.removeAttribute('open');
        window.XQ.Audio.play('close');
      }
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
        topNameEl.textContent = isPve ? `Máy (${window.House.i18n.t(`ai.${game.ai?.level || 'medium'}`)})` : (topSide === 1 ? 'Người chơi 1 (Đỏ)' : 'Người chơi 2 (Đen)');
      }
      if (topBadgeEl) {
        topBadgeEl.className = `side-badge ${topSide === 1 ? 'red' : 'black'}`;
      }

      // Bottom player (You)
      const botNameEl = document.getElementById('player-name-bottom');
      const botBadgeEl = document.getElementById('side-badge-bottom');
      if (botNameEl) {
        botNameEl.textContent = isPve ? 'Bạn' : (humanSide === 1 ? 'Người chơi 1 (Đỏ)' : 'Người chơi 2 (Đen)');
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

      const GLYPHS = { 1: 'Tg', 2: 'S', 3: 'T', 4: 'M', 5: 'X', 6: 'P', 7: 'B' };
      const startTotal = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 5 };

      // Red lost pieces (captured by Black)
      const redLost = [];
      for (let t = 1; t <= 7; t++) {
        const lost = startTotal[t] - counts.red[t];
        if (lost > 0) redLost.push(`${GLYPHS[t]}${lost > 1 ? lost : ''}`);
      }

      // Black lost pieces (captured by Red)
      const blackLost = [];
      for (let t = 1; t <= 7; t++) {
        const lost = startTotal[t] - counts.black[t];
        if (lost > 0) blackLost.push(`${GLYPHS[t]}${lost > 1 ? lost : ''}`);
      }

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
      const lang = window.House ? window.House.i18n.lang : 'vi';

      let html = '<table class="movelist-table"><thead><tr><th>#</th><th>Đỏ</th><th>Đen</th></tr></thead><tbody>';
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

        html += `<tr><td>${moveNum}</td><td class="move-cell" data-ply="${i}" title="Nước ${i + 1}">${redNot}</td><td class="move-cell" data-ply="${hasBlack ? i + 1 : -1}" title="${hasBlack ? 'Nước ' + (i + 2) : ''}">${blackNot}</td></tr>`;
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
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--muted);">${window.House.i18n.t('game.history.empty')}</div>`;
        return;
      }

      const lang = window.House ? window.House.i18n.lang : 'vi';
      const dtf = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

      const playLabel = window.House ? window.House.i18n.t('game.replay.play') : 'Chơi tiếp';
      const reviewLabel = window.House ? window.House.i18n.t('game.replay.review') : 'Xem lại';

      let html = '';
      records.forEach((rec, idx) => {
        const dateStr = dtf.format(new Date(rec.endedAt || rec.startedAt || Date.now()));
        const modeLabel = rec.mode === 'pve' ? `Máy (${rec.ai?.level || 'medium'})` : 'Hai người';
        const pliesCount = rec.moveCount || (rec.moves ? rec.moves.trim().split(/\s+/).length : 0);

        let badgeClass = 'draw';
        let badgeText = 'Hoà';
        if (rec.status === 'win') {
          badgeClass = 'win';
          badgeText = rec.winner === 'red' ? 'Đỏ thắng' : 'Đen thắng';
        } else if (rec.status === 'forfeit') {
          badgeClass = 'loss';
          const loserName = rec.loser === 'red' ? 'Đỏ' : 'Đen';
          badgeText = `${loserName} xin thua`;
        } else if (rec.status === 'in_progress') {
          badgeClass = 'active';
          badgeText = window.House ? window.House.i18n.t('game.status.inProgress') : 'Đang chơi';
        } else if (rec.status === 'abandoned') {
          badgeClass = 'abandoned';
          badgeText = 'Bỏ dở';
        }

        html += `
          <div class="history-item" data-index="${idx}" style="display:flex; justify-content:space-between; align-items:center; gap:var(--sp-2);">
            <div class="history-item-info" data-index="${idx}" style="flex:1; cursor:pointer;" title="${reviewLabel}">
              <div style="display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap;">
                <span style="font-weight:700;">${modeLabel} · ${pliesCount} nước</span>
                <span class="status-badge ${badgeClass}">${badgeText}</span>
              </div>
              <div style="font-size:var(--fs-xs); color:var(--muted); margin-top:2px;">${dateStr}</div>
            </div>
            <div style="display:flex; gap:var(--sp-1); align-items:center; flex-shrink:0;">
              <button class="btn btn-sm btn-primary btn-history-review" data-index="${idx}" title="${reviewLabel}">
                👁 ${reviewLabel}
              </button>
              <button class="btn btn-sm btn-history-play" data-index="${idx}" title="${playLabel}">
                ▶ ${playLabel}
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

    showGameOver(result) {
      const dlg = document.getElementById('dialog-gameover');
      if (!dlg) return;

      const titleEl = document.getElementById('gameover-title');
      const reasonEl = document.getElementById('gameover-reason');

      const isPve = window.XQ.controller.getGame()?.mode === 'pve';
      const humanSide = window.XQ.controller.getGame()?.humanSide || 1;

      if (titleEl) {
        if (result.status === 'win' || result.status === 'forfeit') {
          if (isPve) {
            const humanWon = (result.winner === 'red' && humanSide === 1) || (result.winner === 'black' && humanSide === -1);
            titleEl.textContent = humanWon ? window.House.i18n.t('result.youWin') : window.House.i18n.t('result.youLose');
          } else {
            const name = result.winner === 'red' ? 'Đỏ' : 'Đen';
            titleEl.textContent = window.House.i18n.t('result.win', { name });
          }
        } else if (result.status === 'draw') {
          titleEl.textContent = window.House.i18n.t('result.draw');
        } else {
          titleEl.textContent = 'Kết thúc ván cờ';
        }
      }

      if (reasonEl) {
        const reasonKey = `game.reason.${result.reason || 'checkmate'}`;
        const name = result.loser === 'red' ? 'Đỏ' : 'Đen';
        reasonEl.textContent = window.House.i18n.t(reasonKey, { name });
      }

      this.openDialog('dialog-gameover');
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.toast = toast;
  window.XQ.ui = Ui;
})();
