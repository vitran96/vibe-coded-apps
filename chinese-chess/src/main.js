// main.js — ES module entry point, wires Three.js and the game controller
import * as THREE from 'three';

(() => {
  const APP_VERSION = '1.0.0';
  const MAKER = '';

  let game = null;
  let timerInterval = null;
  let countdownSec = 0;
  let tabHidden = false;

  // Initialize House kit prefs and theme
  const prefs = window.House ? window.House.prefs.load() : { theme: 'auto', lang: 'vi' };
  if (window.House) {
    window.House.applyTheme(prefs.theme);
    window.House.i18n.setLang(prefs.lang);
  }

  // Controller
  const Controller = {
    getGame() { return game; },
    getPos() { return game ? game.pos : null; },

    startNewGame(options) {
      if (timerInterval) clearInterval(timerInterval);

      // Record old game as abandoned if in progress with >= 1 ply
      if (game && game.status === 'in_progress' && game.plies && game.plies.length > 0) {
        this.recordFinishedGame('abandoned', null, null, 'abandoned');
      }

      const settings = window.XQ.Storage.loadSettings();
      const mode = options.mode || 'pve';
      const level = options.level || 'medium';
      let humanSide = options.side === 'random' ? (Math.random() < 0.5 ? 1 : -1) : (options.side === 'black' ? -1 : 1);
      if (mode === 'pvp') humanSide = 1;

      const timerMode = (options.timer && options.timer.mode) || settings.timer.mode || 'off';
      const moveSec = (options.timer && options.timer.moveSec) || settings.timer.moveSec || 60;
      const baseSec = (options.timer && options.timer.base) || settings.timer.base || 600;
      const incSec = (options.timer && options.timer.inc) || settings.timer.inc || 5;

      const initialTime = timerMode === 'move' ? moveSec : baseSec;

      game = {
        id: 'g_' + Date.now().toString(36),
        startedAt: Date.now(),
        endedAt: null,
        mode,
        humanSide,
        ai: mode === 'pve' ? { level, side: -humanSide } : null,
        rules: {
          startFen: window.XQ.START_FEN,
          perpetual: settings.perpetual !== false,
          moveLimit: settings.moveLimit !== false,
          timer: { mode: timerMode, moveSec, base: baseSec, inc: incSec }
        },
        pos: window.XQ.parseFen(window.XQ.START_FEN),
        plies: [],
        history: [],
        undoCount: 0,
        status: 'in_progress',
        winner: null,
        loser: null,
        reason: null,
        timer: { mode: timerMode, moveSec, base: baseSec, inc: incSec },
        timeLeft: timerMode !== 'off' ? { red: initialTime, black: initialTime } : null,
        lastMoveFrom: -1,
        lastMoveTo: -1
      };

      // Remember new game choices
      window.XQ.Storage.saveNewGame({ mode, level, side: options.side });

      // Board flip depending on whether player 1 plays red or black
      const flipBoard = (humanSide === -1);
      window.XQ.Render.setFlipped(flipBoard);
      window.XQ.Render.setFaceToFace(settings.faceToFace && mode === 'pvp');

      // Switch to game screen
      window.XQ.ui.showScreen('screen-game');
      window.XQ.Render.syncBoard(game.pos);
      window.XQ.Render.clearHighlights();
      window.XQ.ui.updatePlayerBars(game);
      window.XQ.ui.updateClocks(game, game.pos.side);
      window.XQ.ui.updateMoveListTable(game);
      window.XQ.Input.setEnabled(true);

      this.startTimerLoop();
      this.autosave();

      // If PvE and AI starts (human plays Black)
      if (mode === 'pve' && game.pos.side !== humanSide) {
        this.triggerAiMove();
      }
    },

    resumeGame() {
      const saved = window.XQ.Storage.loadCurrent();
      if (!saved) return;

      game = saved;
      game.pos = window.XQ.parseFen(game.rules.startFen);
      // Rebuild position up to current plies
      for (const p of game.plies) {
        game.pos = window.XQ.applyMove(game.pos, p.m);
      }

      window.XQ.ui.showScreen('screen-game');
      window.XQ.Render.setFlipped(game.humanSide === -1);
      window.XQ.Render.syncBoard(game.pos);
      window.XQ.Render.clearHighlights();
      if (game.lastMoveFrom >= 0 && game.lastMoveTo >= 0) {
        window.XQ.Render.showLastMove(game.lastMoveFrom, game.lastMoveTo);
      }
      window.XQ.ui.updatePlayerBars(game);
      window.XQ.ui.updateClocks(game, game.pos.side);
      window.XQ.ui.updateMoveListTable(game);
      window.XQ.Input.setEnabled(true);

      this.startTimerLoop();
    },

    startTimerLoop() {
      if (timerInterval) clearInterval(timerInterval);
      if (!game || !game.timer || game.timer.mode === 'off') return;

      let lastTime = performance.now();
      let lastSecond = -1;

      timerInterval = setInterval(() => {
        if (!game || game.status !== 'in_progress' || tabHidden) return;
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        const curSide = game.pos.side;
        const sideKey = curSide === 1 ? 'red' : 'black';

        game.timeLeft[sideKey] -= delta;
        const secLeft = Math.ceil(game.timeLeft[sideKey]);

        // Countdown sounds and effects (5..1)
        if (secLeft <= 5 && secLeft >= 1 && secLeft !== lastSecond) {
          lastSecond = secLeft;
          window.XQ.Audio.play('countdown', secLeft);
          if (navigator.vibrate) navigator.vibrate(30);
          if (secLeft === 5) {
            window.XQ.ui.announceLive(window.House.i18n.t('game.timer.secondsLeft', { n: 5 }));
          }
        }

        const isCountdown = (secLeft <= 5 && secLeft >= 1);
        window.XQ.ui.updateClocks(game, curSide, isCountdown, secLeft);

        // Time ran out!
        if (game.timeLeft[sideKey] <= 0) {
          game.timeLeft[sideKey] = 0;
          clearInterval(timerInterval);
          this.handleTimeout(curSide);
        }
      }, 100);
    },

    handleTimeout(flaggedSide) {
      if (!game) return;
      window.XQ.Input.setEnabled(false);
      const winner = flaggedSide === 1 ? 'black' : 'red';
      const loser = flaggedSide === 1 ? 'red' : 'black';

      window.XQ.toast(window.House.i18n.t('game.timer.timeUp'));
      const isHumanLoser = (game.mode === 'pve' && game.humanSide === flaggedSide);
      window.XQ.Audio.play(isHumanLoser ? 'lose' : 'win');

      this.finishGame({
        status: 'timeout',
        winner,
        loser,
        reason: 'timeout'
      });
    },

    makeMove(m) {
      if (!game || game.status !== 'in_progress') return;

      const from = (m >> 7) & 0x7F;
      const to = m & 0x7F;
      const moverSide = game.pos.side;
      const captured = game.pos.board[to];

      // Timer updates
      if (game.timer && game.timer.mode !== 'off') {
        const sideKey = moverSide === 1 ? 'red' : 'black';
        if (game.timer.mode === 'move') {
          game.timeLeft[sideKey] = game.timer.moveSec;
        } else if (game.timer.mode === 'game') {
          game.timeLeft[sideKey] += game.timer.inc;
        }
      }

      // Execute move
      const undo = window.XQ.makeMove(game.pos, m);
      game.lastMoveFrom = from;
      game.lastMoveTo = to;
      game.plies.push({ m, t: Math.floor((Date.now() - game.startedAt) / 100) });
      game.history.push({
        hashLo: undo.hashLo,
        hashHi: undo.hashHi,
        side: -game.pos.side,
        gaveCheck: window.XQ.inCheck(game.pos, game.pos.side),
        capture: captured
      });

      // Sound
      if (captured !== 0) {
        window.XQ.Audio.play('capture');
      } else {
        window.XQ.Audio.play('place', moverSide === 1 ? 1 : 2);
      }

      // Check detection
      const inChk = window.XQ.inCheck(game.pos, game.pos.side);
      if (inChk) {
        window.XQ.Audio.play('check');
        window.XQ.toast(window.House.i18n.t('game.check'));
      }

      // Animate move on 3D board
      window.XQ.Input.setEnabled(false);
      window.XQ.Render.animateMove(from, to, () => {
        window.XQ.Render.clearHighlights();
        window.XQ.Render.showLastMove(from, to);
        if (inChk) {
          window.XQ.Render.showCheck(game.pos.kingSq[game.pos.side]);
        }
        window.XQ.ui.updatePlayerBars(game);
        window.XQ.ui.updateClocks(game, game.pos.side);
        window.XQ.ui.updateMoveListTable(game);

        // Check game over
        const status = window.XQ.gameStatus(game.pos, game.history, game.rules);
        if (status.over) {
          this.finishGame(status);
        } else {
          window.XQ.Input.setEnabled(true);
          this.autosave();

          // AI reply in PvE mode
          if (game.mode === 'pve' && game.pos.side !== game.humanSide) {
            this.triggerAiMove();
          }
        }
      });
    },

    triggerAiMove() {
      if (!game || game.status !== 'in_progress') return;
      window.XQ.Input.setEnabled(false);

      const fen = window.XQ.toFen(game.pos);
      const movesHistory = game.plies.map(p => window.XQ.moveToIccs(p.m));

      // Scaling time budget for AI under game timer
      let timeBudget = 1000;
      if (game.timer && game.timer.mode === 'game') {
        const sideKey = game.pos.side === 1 ? 'red' : 'black';
        timeBudget = Math.min(1000, Math.floor(game.timeLeft[sideKey] * 50));
      }

      window.XQ.AiClient.requestMove(fen, {
        level: game.ai.level,
        timeBudget,
        historyHashes: game.history,
        movesHistory,
        rules: game.rules
      }, (reply) => {
        if (!game || game.status !== 'in_progress') return;
        if (reply && reply.moveInt) {
          this.makeMove(reply.moveInt);
        }
      });
    },

    finishGame(status) {
      if (!game) return;
      game.status = status.status;
      game.winner = status.winner;
      game.loser = status.loser;
      game.reason = status.reason;
      game.endedAt = Date.now();
      if (timerInterval) clearInterval(timerInterval);

      if (status.status === 'win') {
        const humanWon = (game.mode === 'pve' && game.winner === (game.humanSide === 1 ? 'red' : 'black')) || (game.mode === 'pvp');
        if (humanWon) {
          window.XQ.Render.triggerConfetti();
          window.XQ.Audio.play('win');
        } else {
          window.XQ.Audio.play('lose');
        }
      } else if (status.status === 'draw') {
        window.XQ.Audio.play('draw');
      }

      this.recordFinishedGame(status.status, status.winner, status.loser, status.reason);
      window.XQ.Storage.clearCurrent();
      window.XQ.ui.showGameOver(status);
    },

    recordFinishedGame(status, winner, loser, reason) {
      if (!game) return;
      const rec = {
        v: 1,
        id: game.id,
        startedAt: game.startedAt,
        endedAt: Date.now(),
        mode: game.mode,
        ai: game.ai,
        rules: game.rules,
        moves: game.plies.map(p => window.XQ.moveToIccs(p.m)).join(' '),
        times: game.plies.map(p => p.t),
        timeLeft: game.timeLeft,
        undoCount: game.undoCount,
        status,
        winner,
        loser,
        endedOnTurn: game.pos.side === 1 ? 'red' : 'black',
        moveCount: game.plies.length,
        reason
      };
      window.XQ.Storage.saveRecord(rec);
    },

    autosave() {
      if (!game || game.status !== 'in_progress') return;
      window.XQ.Storage.saveCurrent(game);
    },

    restoreLiveBoard() {
      if (!game) return;
      window.XQ.Render.syncBoard(game.pos);
      window.XQ.Render.clearHighlights();
      if (game.lastMoveFrom >= 0 && game.lastMoveTo >= 0) {
        window.XQ.Render.showLastMove(game.lastMoveFrom, game.lastMoveTo);
      }
    },

    refreshLastMoveHighlight() {
      if (game && game.lastMoveFrom >= 0 && game.lastMoveTo >= 0) {
        window.XQ.Render.showLastMove(game.lastMoveFrom, game.lastMoveTo);
      }
    },

    undo() {
      if (!game || game.status !== 'in_progress' || game.plies.length === 0) return;
      window.XQ.AiClient.cancel();

      const pliesToUndo = (game.mode === 'pve' && game.plies.length >= 2) ? 2 : 1;
      for (let i = 0; i < pliesToUndo; i++) {
        game.plies.pop();
        game.history.pop();
      }
      game.undoCount++;

      // Rebuild position
      game.pos = window.XQ.parseFen(game.rules.startFen);
      for (const p of game.plies) {
        game.pos = window.XQ.applyMove(game.pos, p.m);
      }

      if (game.plies.length > 0) {
        const lastM = game.plies[game.plies.length - 1].m;
        game.lastMoveFrom = (lastM >> 7) & 0x7F;
        game.lastMoveTo = lastM & 0x7F;
      } else {
        game.lastMoveFrom = -1;
        game.lastMoveTo = -1;
      }

      window.XQ.Render.syncBoard(game.pos);
      window.XQ.Render.clearHighlights();
      this.refreshLastMoveHighlight();
      window.XQ.ui.updatePlayerBars(game);
      window.XQ.ui.updateClocks(game, game.pos.side);
      window.XQ.ui.updateMoveListTable(game);
      window.XQ.Input.setEnabled(true);
      this.autosave();
    },

    flip() {
      const isFlipped = !window.XQ.Render.isFlipped;
      window.XQ.Render.setFlipped(isFlipped);
    },

    resign() {
      if (!game || game.status !== 'in_progress') return;
      const loser = game.pos.side === 1 ? 'red' : 'black';
      const winner = game.pos.side === 1 ? 'black' : 'red';
      this.finishGame({
        status: 'forfeit',
        winner,
        loser,
        reason: 'resign'
      });
    },

    offerDraw() {
      if (!game || game.status !== 'in_progress') return;
      if (game.mode === 'pvp') {
        window.XQ.ui.openDialog('dialog-draw-offer');
      } else {
        // AI eval check: ply >= 40 and within ±50 cp
        const ev = window.XQ.evaluate(game.pos);
        if (game.plies.length >= 40 && Math.abs(ev) <= 50) {
          this.finishGame({
            status: 'draw',
            winner: null,
            loser: null,
            reason: 'agreement'
          });
        } else {
          window.XQ.toast(window.House.i18n.t('game.aiDeclinesDraw'));
        }
      }
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.controller = Controller;

  // Tab hidden pause handling for timer
  document.addEventListener('visibilitychange', () => {
    tabHidden = document.hidden;
  });

  // DOM Event Bindings
  document.addEventListener('DOMContentLoaded', () => {
    const canvas3d = document.getElementById('canvas-3d');
    const container3d = document.querySelector('.board-container');

    window.XQ.Render.init(THREE, canvas3d, container3d);
    window.XQ.Input.init(canvas3d, {
      onMove: (m) => Controller.makeMove(m)
    });
    window.XQ.AiClient.init();
    window.XQ.Pwa.init();
    window.XQ.RulesPage.init();

    // Check if resume available
    const savedCurrent = window.XQ.Storage.loadCurrent();
    const resumeBtn = document.getElementById('btn-start-resume');
    if (resumeBtn) {
      resumeBtn.style.display = savedCurrent ? 'inline-flex' : 'none';
      resumeBtn.addEventListener('click', () => Controller.resumeGame());
    }

    // Start screen buttons
    document.getElementById('btn-start-play')?.addEventListener('click', () => {
      window.XQ.ui.openDialog('dialog-newgame');
    });
    document.getElementById('btn-start-rules')?.addEventListener('click', () => {
      window.XQ.RulesPage.open('screen-start');
    });
    document.getElementById('btn-start-history')?.addEventListener('click', () => {
      window.XQ.ui.updateHistoryList();
      window.XQ.ui.openDialog('dialog-history');
    });
    document.getElementById('btn-start-settings')?.addEventListener('click', () => {
      window.XQ.ui.openDialog('dialog-settings');
    });

    // Right side menu panel action buttons (horizontal with text)
    document.getElementById('btn-action-undo')?.addEventListener('click', () => Controller.undo());
    document.getElementById('btn-action-resign')?.addEventListener('click', () => Controller.resign());
    document.getElementById('btn-action-newgame')?.addEventListener('click', () => {
      window.XQ.ui.openDialog('dialog-newgame');
    });
    document.getElementById('btn-action-rules')?.addEventListener('click', () => {
      window.XQ.RulesPage.open('screen-game');
    });
    document.getElementById('btn-action-settings')?.addEventListener('click', () => {
      window.XQ.ui.openDialog('dialog-settings');
    });

    // Game menu options
    document.getElementById('menu-item-newgame')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-game-menu');
      window.XQ.ui.openDialog('dialog-newgame');
    });
    document.getElementById('menu-item-resign')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-game-menu');
      Controller.resign();
    });
    document.getElementById('menu-item-settings')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-game-menu');
      window.XQ.ui.openDialog('dialog-settings');
    });

    // New game sheet chips & Start button
    let selectedMode = 'pve', selectedLevel = 'medium', selectedSide = 'red';
    let selectedTimerMode = 'off', selectedMoveSec = 60, selectedBaseSec = 600, selectedIncSec = 5;

    function bindChipGroup(selector, onSelect) {
      document.querySelectorAll(selector).forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll(selector).forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          onSelect(chip.dataset.val);
        });
      });
    }

    bindChipGroup('.chip-mode', (val) => {
      selectedMode = val;
      const aiGroup = document.getElementById('newgame-ai-group');
      if (aiGroup) aiGroup.style.display = val === 'pve' ? 'flex' : 'none';
    });
    bindChipGroup('.chip-level', (val) => { selectedLevel = val; });
    bindChipGroup('.chip-side', (val) => { selectedSide = val; });
    bindChipGroup('.chip-timer-mode', (val) => {
      selectedTimerMode = val;
      const moveOpts = document.getElementById('timer-opts-move');
      const gameOpts = document.getElementById('timer-opts-game');
      if (moveOpts) moveOpts.style.display = val === 'move' ? 'flex' : 'none';
      if (gameOpts) gameOpts.style.display = val === 'game' ? 'flex' : 'none';
    });
    bindChipGroup('.chip-timer-move', (val) => { selectedMoveSec = parseInt(val, 10); });
    bindChipGroup('.chip-timer-game', (val) => {
      const [b, inc] = val.split('+').map(n => parseInt(n, 10));
      selectedBaseSec = b * 60;
      selectedIncSec = inc;
    });

    document.getElementById('btn-newgame-start')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-newgame');
      Controller.startNewGame({
        mode: selectedMode,
        level: selectedLevel,
        side: selectedSide,
        timer: {
          mode: selectedTimerMode,
          moveSec: selectedMoveSec,
          base: selectedBaseSec,
          inc: selectedIncSec
        }
      });
    });

    // Settings sheet
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.value = window.House.prefs.load().theme;
      themeSelect.addEventListener('change', (e) => {
        window.House.prefs.save({ theme: e.target.value });
        window.House.applyTheme(e.target.value);
      });
    }

    const langSelect = document.getElementById('settings-lang-select');
    if (langSelect) {
      langSelect.value = window.House.prefs.load().lang;
      langSelect.addEventListener('change', (e) => {
        window.House.prefs.save({ lang: e.target.value });
        window.House.i18n.setLang(e.target.value);
      });
    }

    const labelSelect = document.getElementById('settings-label-select');
    if (labelSelect) {
      const s = window.XQ.Storage.loadSettings();
      labelSelect.value = s.labels;
      labelSelect.addEventListener('change', (e) => {
        window.XQ.Storage.saveSettings({ labels: e.target.value });
        window.XQ.Render.setLabelMode(e.target.value);
      });
    }

    // Audio settings
    const sfxToggle = document.getElementById('settings-sfx-toggle');
    if (sfxToggle) {
      sfxToggle.checked = window.XQ.Storage.loadSettings().sfx.on;
      sfxToggle.addEventListener('change', (e) => {
        window.XQ.Storage.saveSettings({ sfx: { on: e.target.checked } });
      });
    }
    const musicToggle = document.getElementById('settings-music-toggle');
    if (musicToggle) {
      musicToggle.checked = window.XQ.Storage.loadSettings().music.on;
      musicToggle.addEventListener('change', (e) => {
        window.XQ.Storage.saveSettings({ music: { on: e.target.checked } });
        window.XQ.Audio.setMusicEnabled(e.target.checked);
      });
    }

    // Clear history & reset defaults
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (confirm(window.House.i18n.t('game.history.clearConfirm'))) {
        window.XQ.Storage.clearRecords();
        window.XQ.ui.updateHistoryList();
        window.XQ.toast('Đã xoá lịch sử đấu');
      }
    });

    document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
      window.XQ.Storage.resetDefaults();
      window.XQ.toast('Đã khôi phục cài đặt mặc định');
    });

    // Version label
    const verEl = document.getElementById('app-version-label');
    if (verEl) verEl.textContent = APP_VERSION;

    // Install app button
    document.getElementById('btn-install-app')?.addEventListener('click', () => {
      window.XQ.Pwa.install();
    });

    // Replay bar buttons
    document.getElementById('btn-replay-start')?.addEventListener('click', () => window.XQ.Replay.goToPly(0));
    document.getElementById('btn-replay-prev')?.addEventListener('click', () => window.XQ.Replay.stepBack());
    document.getElementById('btn-replay-play')?.addEventListener('click', () => window.XQ.Replay.togglePlay());
    document.getElementById('btn-replay-next')?.addEventListener('click', () => window.XQ.Replay.stepForward());
    document.getElementById('btn-replay-end')?.addEventListener('click', () => window.XQ.Replay.goToPly(999));
    document.getElementById('btn-replay-exit')?.addEventListener('click', () => window.XQ.Replay.stop());
    document.getElementById('replay-scrubber')?.addEventListener('input', (e) => {
      window.XQ.Replay.goToPly(parseInt(e.target.value, 10));
    });

    // Game over sheet buttons
    document.getElementById('btn-gameover-rematch')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-gameover');
      const g = Controller.getGame();
      if (g) {
        Controller.startNewGame({
          mode: g.mode,
          level: g.ai ? g.ai.level : 'medium',
          side: g.humanSide === 1 ? 'red' : 'black',
          timer: g.timer
        });
      }
    });
    document.getElementById('btn-gameover-replay')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-gameover');
      const records = window.XQ.Storage.loadRecords();
      if (records && records.length > 0) {
        window.XQ.Replay.start(records[0]);
      }
    });
    document.getElementById('btn-gameover-newgame')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-gameover');
      window.XQ.ui.openDialog('dialog-newgame');
    });

    // Draw offer confirm button
    document.getElementById('btn-draw-accept')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-draw-offer');
      Controller.finishGame({ status: 'draw', winner: null, loser: null, reason: 'agreement' });
    });
    document.getElementById('btn-draw-decline')?.addEventListener('click', () => {
      window.XQ.ui.closeDialog('dialog-draw-offer');
    });
  });
})();
