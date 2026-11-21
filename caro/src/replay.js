'use strict';
// 10 Replay Controller (History replay, scrubbing, playback)
// ============================================================
class ReplayController {
  constructor() {
    this.record = null;
    this.stepIndex = 0;
    this.isPlaying = false;
    this.speed = 1.0;
    this.useRealTiming = false;
    this.showNumbers = false;
    this.timerId = null;
    this.savedLiveState = null;

    this.initUI();
  }

  startReplay(record) {
    this.record = record;
    this.stepIndex = 0;
    this.isPlaying = false;
    clearTimeout(this.timerId);

    // Save live game state if exists
    if (App.game.state === 'playing') {
      this.savedLiveState = {
        session: App.game.session,
        moves: App.game.moves.slice(),
        turn: App.game.turn,
        undoCount: App.game.undoCount,
        timerRemaining: App.game.timer.remaining
      };
      App.game.timer.pause();
    } else {
      this.savedLiveState = null;
    }

    App.game.state = 'replaying';
    App.renderer.clearWinningLine();
    App.renderer.buildBoard(record.session.boardSize);
    App.renderer.fitBoard();

    // Show replay bar & update controls
    const rb = $('#replay-bar');
    if (rb) rb.hidden = false;
    const scrub = $('#rb-scrub');
    if (scrub) {
      scrub.max = record.moves.length;
      scrub.value = 0;
    }

    this.updateDisplay();
    App.game.updateHUD();
  }

  exitReplay() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    const rb = $('#replay-bar');
    if (rb) rb.hidden = true;

    if (this.savedLiveState) {
      App.game.restoreGame(this.savedLiveState);
    } else {
      App.game.startNewGame();
    }
  }

  playFromHere() {
    const movesUpToHere = this.record.moves.slice(0, this.stepIndex);
    this.isPlaying = false;
    clearTimeout(this.timerId);

    const rb = $('#replay-bar');
    if (rb) rb.hidden = true;

    const newSession = JSON.parse(JSON.stringify(this.record.session));
    newSession.id = uuid();
    newSession.startedAt = Date.now();

    App.game.startNewGame(newSession);
    movesUpToHere.forEach(m => {
      if (!m.pass) {
        App.game.placeStone(m.x, m.y, true);
      }
    });
    toast(t('startFromReplay'));
  }

  seekTo(idx) {
    this.stepIndex = clamp(idx, 0, this.record.moves.length);
    App.renderer.clearWinningLine();

    // Rebuild board state up to stepIndex
    const N = this.record.session.boardSize;
    App.renderer.buildStones(N);

    for (let i = 0; i < this.stepIndex; i++) {
      const m = this.record.moves[i];
      if (!m.pass) {
        App.renderer.setStone(m.x, m.y, m.p, false);
      }
    }

    const last = this.record.moves[this.stepIndex - 1];
    if (last && !last.pass) {
      App.renderer.setLastMove(last.x, last.y);
    } else {
      App.renderer.setLastMove(null, null);
    }

    if (this.stepIndex === this.record.moves.length && this.record.result.line) {
      App.renderer.showWinningLine(this.record.result.line);
    }

    this.updateDisplay();
  }

  step(delta) {
    this.pause();
    this.seekTo(this.stepIndex + delta);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.stepIndex >= this.record.moves.length) {
        this.seekTo(0);
      }
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    this.updatePlayBtn();
    this.tickPlayback();
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    this.updatePlayBtn();
  }

  tickPlayback() {
    if (!this.isPlaying) return;

    if (this.stepIndex >= this.record.moves.length) {
      this.pause();
      return;
    }

    let delay = 700 / this.speed;
    if (this.useRealTiming && this.stepIndex > 0) {
      const prevT = this.record.moves[this.stepIndex - 1].t || 0;
      const currT = this.record.moves[this.stepIndex].t || 0;
      const realDt = clamp(currT - prevT, 200, 3000);
      delay = realDt / this.speed;
    }

    this.seekTo(this.stepIndex + 1);

    const m = this.record.moves[this.stepIndex - 1];
    if (m && !m.pass) App.audio.playPlace(m.p);

    this.timerId = setTimeout(() => this.tickPlayback(), delay);
  }

  updateDisplay() {
    const count = $('#rb-count');
    const scrub = $('#rb-scrub');
    const total = this.record ? this.record.moves.length : 0;
    if (count) count.textContent = `${this.stepIndex} / ${total}`;
    if (scrub) scrub.value = this.stepIndex;
  }

  updatePlayBtn() {
    const btn = $('#rb-play');
    if (!btn) return;
    if (this.isPlaying) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
      btn.title = 'Pause';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>';
      btn.title = 'Play';
    }
  }

  initUI() {
    $('#rb-start')?.addEventListener('click', () => { this.pause(); this.seekTo(0); });
    $('#rb-back')?.addEventListener('click', () => this.step(-1));
    $('#rb-play')?.addEventListener('click', () => this.togglePlay());
    $('#rb-fwd')?.addEventListener('click', () => this.step(1));
    $('#rb-end')?.addEventListener('click', () => { this.pause(); this.seekTo(this.record.moves.length); });

    $('#rb-scrub')?.addEventListener('input', (e) => {
      this.pause();
      this.seekTo(parseInt(e.target.value, 10));
    });

    $('#rb-speed')?.addEventListener('change', (e) => {
      this.speed = parseFloat(e.target.value);
    });

    $('#rb-real')?.addEventListener('change', (e) => {
      this.useRealTiming = !!e.target.checked;
    });

    $('#rb-exit')?.addEventListener('click', () => this.exitReplay());
    $('#rb-from')?.addEventListener('click', () => this.playFromHere());
  }
}

// ============================================================
