'use strict';
// 04 Game Controller (State machine, turn management, autosave)
// ============================================================
class GameController {
  constructor() {
    this.state = 'idle'; // idle | playing | paused | finished | replaying
    this.session = null;
    this.board = null;
    this.moves = [];
    this.turn = 1;
    this.isThinking = false;
    this.undoCount = 0;
    this.timer = new GameTimer((timedOutPlayer) => this.handleTimeout(timedOutPlayer));
  }

  startNewGame(customSession = null) {
    this.timer.stop();
    App.renderer.clearWinningLine();
    App.renderer.setGhost(null, null);

    const s = customSession || this.createDefaultSession();
    this.session = s;
    this.state = 'playing';
    this.board = new Int8Array(s.boardSize * s.boardSize);
    this.moves = [];
    this.turn = s.firstPlayer;
    this.isThinking = false;
    this.undoCount = 0;

    App.renderer.buildBoard(s.boardSize);
    App.renderer.setLastMove(null, null);

    // Initial camera positioning with comfortable zoom for finger-touch cell size
    const center = Math.floor(s.boardSize / 2);
    App.renderer.focusCell(center, center, false);
    App.renderer.camera.zoom = App.renderer.getTargetZoom();
    App.renderer.camera.updateProjectionMatrix();

    this.updateHUD();
    this.clearMoveList();
    this.autosave();

    if (this.isAITurn()) {
      this.triggerAIMove();
    } else if (s.timer.enabled) {
      this.timer.start(this.turn, s.timer.seconds);
    }
  }

  createDefaultSession() {
    const g = App.settings.game;
    let first = 1;
    if (g.mode === 'pve') {
      if (g.playAs === 'o') first = 2;
      else if (g.playAs === 'random') first = Math.random() < 0.5 ? 1 : 2;
    }
    const aiSide = g.mode === 'pve' ? (first === 1 ? 2 : 1) : null;
    const diffName = t(g.difficulty || 'medium');
    const youName = t('playAsYou');
    return {
      id: uuid(),
      startedAt: Date.now(),
      mode: g.mode,
      ai: g.mode === 'pve' ? { difficulty: g.difficulty, side: aiSide } : null,
      boardSize: g.boardSize,
      rules: {
        mode: g.rule,
        exactFive: g.exactFive,
        edgeBlocks: g.edgeBlocks
      },
      timer: {
        enabled: g.timerEnabled,
        seconds: g.timerSeconds,
        onTimeout: g.onTimeout
      },
      players: {
        1: { name: g.mode === 'pve' ? (aiSide === 1 ? `AI (${diffName})` : youName) : g.name1 || t('defaultP1') },
        2: { name: g.mode === 'pve' ? (aiSide === 2 ? `AI (${diffName})` : youName) : g.name2 || t('defaultP2') }
      },
      firstPlayer: first
    };
  }

  isAITurn() {
    return this.session && this.session.mode === 'pve' && this.session.ai && this.session.ai.side === this.turn;
  }

  placeStone(x, y, fromAI = false) {
    if (this.state !== 'playing') return false;
    if (this.isThinking && !fromAI) return false;
    if (!fromAI && this.isAITurn()) return false;

    const N = this.session.boardSize;
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    const idx = y * N + x;
    if (this.board[idx] !== 0) return false;

    const p = this.turn;
    this.board[idx] = p;
    const t = Date.now() - this.session.startedAt;
    this.moves.push({ x, y, p, t });

    App.audio.playPlace(p);
    App.renderer.setStone(x, y, p, true);
    App.renderer.setLastMove(x, y);
    App.renderer.ensureVisible(x, y, true);
    this.appendMoveToList(x, y, p);

    // Announce to screen reader
    const live = $('#live');
    if (live) live.textContent = `${pieceName(p)} at ${coordName(x, y, N)}`;

    // Check Win
    const win = checkWin(this.board, N, x, y, p, this.session.rules);
    if (win) {
      this.finishGame(p, 'five', win.line);
      return true;
    }

    // Check Draw
    if (isDraw(this.board, N)) {
      this.finishGame(0, 'draw', null);
      return true;
    }

    // Next turn
    this.turn = 3 - p;
    this.updateHUD();
    this.autosave();

    if (this.isAITurn()) {
      this.timer.stop();
      this.triggerAIMove();
    } else if (this.session.timer.enabled) {
      this.timer.start(this.turn, this.session.timer.seconds);
    }

    return true;
  }

  async triggerAIMove() {
    this.isThinking = true;
    this.updateHUD();

    const diff = this.session.ai.difficulty;
    const minDelay = AI_DELAY[diff] || 350;
    const t0 = performance.now();

    try {
      const res = await App.ai.getMove({
        board: this.board,
        N: this.session.boardSize,
        player: this.turn,
        rules: this.session.rules,
        difficulty: diff,
        budget: AI_BUDGET
      });

      const elapsed = performance.now() - t0;
      const wait = Math.max(0, minDelay - elapsed);
      await new Promise(r => setTimeout(r, wait));

      if (this.state === 'playing' && this.isAITurn()) {
        this.isThinking = false;
        this.placeStone(res.x, res.y, true);
      }
    } catch {
      this.isThinking = false;
      this.updateHUD();
    }
  }

  undo() {
    if (App.settings.game.allowUndo === false) return;
    if (this.state !== 'playing' || this.isThinking || this.moves.length === 0) return;

    this.timer.stop();
    const isBot = this.session && this.session.mode === 'pve' && this.session.ai;
    const count = isBot ? Math.min(2, this.moves.length) : 1;

    for (let i = 0; i < count; i++) {
      const last = this.moves.pop();
      if (!last.pass) {
        const idx = last.y * this.session.boardSize + last.x;
        this.board[idx] = 0;
        App.renderer.setStone(last.x, last.y, 0, false);
      }
      this.turn = last.p;
    }
    this.undoCount++;

    const prev = this.moves[this.moves.length - 1];
    if (prev && !prev.pass) {
      App.renderer.setLastMove(prev.x, prev.y);
    } else {
      App.renderer.setLastMove(null, null);
    }

    this.refreshMoveList();
    this.updateHUD();
    this.autosave();

    if (this.isAITurn()) {
      this.triggerAIMove();
    } else if (this.session.timer.enabled) {
      this.timer.start(this.turn, this.session.timer.seconds);
    }
  }

  handleTimeout(timedOutPlayer) {
    if (this.state !== 'playing') return;

    if (this.session.timer.onTimeout === 'lose') {
      const winner = 3 - timedOutPlayer;
      App.audio.playTimeout();
      this.finishGame(winner, 'timeout', null);
    } else {
      // Auto-pass turn
      const pName = this.session.players[timedOutPlayer].name;
      toast(t('timeoutTurnSkipped', pName));
      this.moves.push({ pass: true, p: timedOutPlayer, t: Date.now() - this.session.startedAt });
      this.turn = 3 - timedOutPlayer;
      this.updateHUD();
      this.autosave();

      if (this.isAITurn()) {
        this.triggerAIMove();
      } else if (this.session.timer.enabled) {
        this.timer.start(this.turn, this.session.timer.seconds);
      }
    }
  }

  resign() {
    if (this.state !== 'playing') return;
    const resigningPlayer = (this.session.mode === 'pve' && this.session.ai) ? (3 - this.session.ai.side) : this.turn;
    const winner = 3 - resigningPlayer;
    this.finishGame(winner, 'forfeit', null, resigningPlayer);
  }

  forfeit() {
    if (this.state !== 'playing') return;
    const forfeitingPlayer = (this.session.mode === 'pve' && this.session.ai) ? (3 - this.session.ai.side) : this.turn;
    const winner = 3 - forfeitingPlayer;
    this.finishGame(winner, 'forfeit', null, forfeitingPlayer);
  }

  finishGame(winner, reason, winLine = null, forfeitedBy = null) {
    this.state = 'finished';
    this.timer.stop();
    this.isThinking = false;

    if (winLine) {
      App.renderer.showWinningLine(winLine);
    }

    // Play SFX
    if (winner === 0) {
      App.audio.playDraw();
    } else if (this.session.mode === 'pve' && this.session.ai) {
      if (winner === this.session.ai.side) App.audio.playLose();
      else App.audio.playWin();
    } else {
      App.audio.playWin();
    }

    const rec = {
      id: this.session.id,
      v: 1,
      startedAt: this.session.startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - this.session.startedAt,
      session: JSON.parse(JSON.stringify(this.session)),
      moves: this.moves.slice(),
      result: {
        winner,
        reason,
        line: winLine,
        turnAtEnd: this.turn,
        forfeitedBy: reason === 'forfeit' ? (forfeitedBy || (3 - winner)) : undefined
      },
      undoCount: this.undoCount
    };

    App.records.unshift(rec);
    saveRecords();
    store.remove(LS.current);

    this.updateHUD();
    this.showResultDialog(winner, reason, forfeitedBy);
  }

  showResultDialog(winner, reason, forfeitedBy = null) {
    const dlg = $('#dlg-result');
    const title = $('#rs-title');
    const sub = $('#rs-sub');

    let titleText = '';
    if (reason === 'forfeit') {
      const fPlayer = forfeitedBy || (3 - winner);
      if (this.session.mode === 'pve' && this.session.ai) {
        titleText = winner === this.session.ai.side ? t('youForfeited') : t('aiForfeited');
      } else {
        const pName = this.session.players[fPlayer]?.name || pieceName(fPlayer);
        titleText = t('playerForfeited', pName);
      }
    } else if (winner === 0) {
      titleText = t('drawGame');
    } else if (this.session.mode === 'pve' && this.session.ai) {
      titleText = winner === this.session.ai.side ? t('aiWins') : t('youWin');
    } else {
      titleText = t('playerWins', this.session.players[winner].name);
    }

    const turnName = pieceName(this.turn);
    let subText = '';
    if (reason === 'five') subText = t('reasonFive', turnName);
    else if (reason === 'timeout') subText = t('reasonTimeout', turnName);
    else if (reason === 'resign' || reason === 'forfeit') subText = t('reasonForfeit', turnName);
    else if (reason === 'draw') subText = t('reasonDraw', turnName);

    title.textContent = titleText;
    sub.textContent = subText;
    dlg.showModal();
  }

  updateHUD() {
    const chip1 = $('#chip-1');
    const chip2 = $('#chip-2');
    const name1 = $('#chip-1 .pname');
    const name2 = $('#chip-2 .pname');
    const p1Ico = $('#chip-1 .pico');
    const p2Ico = $('#chip-2 .pico');
    const badge = $('#rule-badge');
    const moveNo = $('#move-no');
    const statusLine = $('#status-line');

    if (!this.session) return;

    name1.textContent = this.session.players[1].name;
    name2.textContent = this.session.players[2].name;

    p1Ico.innerHTML = '<svg class="piece" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    p2Ico.innerHTML = '<svg class="piece" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="8"/></svg>';

    chip1.classList.toggle('active', this.turn === 1 && this.state === 'playing');
    chip2.classList.toggle('active', this.turn === 2 && this.state === 'playing');

    badge.textContent = this.session.rules.mode === 'caro' ? 'Caro' : 'Gomoku';
    const nonPassMoves = this.moves.filter(m => !m.pass).length;
    moveNo.textContent = t('moveNo', nonPassMoves);

    if (this.state === 'playing') {
      if (this.isThinking) {
        statusLine.textContent = t('aiThinking');
        statusLine.classList.add('thinking');
      } else {
        statusLine.classList.remove('thinking');
        const pName = this.session.players[this.turn].name;
        statusLine.textContent = t('turnPlayer', pName);
      }
    } else if (this.state === 'finished') {
      statusLine.classList.remove('thinking');
      statusLine.textContent = '';
    } else if (this.state === 'replaying') {
      statusLine.classList.remove('thinking');
      statusLine.textContent = t('viewingReplay');
    }

    const undoBtn = $('#btn-undo');
    if (undoBtn) {
      const allowed = App.settings.game.allowUndo !== false;
      undoBtn.hidden = !allowed;
      undoBtn.disabled = !allowed || this.moves.length === 0 || this.isThinking || this.state !== 'playing';
    }
  }

  appendMoveToList(x, y, p) {
    const list = $('#movelist ol');
    if (!list) return;
    const li = document.createElement('li');
    li.innerHTML = `<span class="m${p === 1 ? 'x' : 'o'}">${pieceName(p)}</span> ${coordName(x, y, this.session.boardSize)}`;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  }

  clearMoveList() {
    const list = $('#movelist ol');
    if (list) list.innerHTML = '';
  }

  refreshMoveList() {
    this.clearMoveList();
    this.moves.forEach(m => {
      if (!m.pass) this.appendMoveToList(m.x, m.y, m.p);
    });
  }

  autosave() {
    if (this.state === 'playing' && this.moves.length > 0) {
      const data = {
        session: this.session,
        moves: this.moves,
        turn: this.turn,
        undoCount: this.undoCount,
        timerRemaining: this.timer.running ? this.timer.remaining : null
      };
      store.set(LS.current, data);
    }
  }

  restoreGame(data) {
    if (!validSession(data.session) || !validMoves(data.moves, data.session.boardSize)) return false;

    this.timer.stop();
    App.renderer.clearWinningLine();

    this.session = data.session;
    this.state = 'playing';
    this.board = new Int8Array(this.session.boardSize * this.session.boardSize);
    this.moves = [];
    this.turn = data.turn;
    this.undoCount = data.undoCount || 0;

    App.renderer.buildBoard(this.session.boardSize);
    this.clearMoveList();

    data.moves.forEach(m => {
      this.moves.push(m);
      if (!m.pass) {
        this.board[m.y * this.session.boardSize + m.x] = m.p;
        App.renderer.setStone(m.x, m.y, m.p, false);
      }
    });

    const last = this.moves[this.moves.length - 1];
    if (last && !last.pass) {
      App.renderer.setLastMove(last.x, last.y);
      App.renderer.focusCell(last.x, last.y, false);
    } else {
      App.renderer.fitBoard();
    }

    this.refreshMoveList();
    this.updateHUD();

    if (this.isAITurn()) {
      this.triggerAIMove();
    } else if (this.session.timer.enabled) {
      this.timer.start(this.turn, this.session.timer.seconds, data.timerRemaining);
    }

    return true;
  }
}

// ============================================================
