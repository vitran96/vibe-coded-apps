// replay.js — Full game replay viewer and scrubber
(() => {
  let activeRecord = null;
  let positions = []; // array of Pos for each ply
  let movesList = []; // array of ICCS moves
  let currentPly = 0;
  let isPlaying = false;
  let playbackSpeed = 1.0; // 0.5x, 1x, 2x, 4x
  let playTimer = null;

  function buildPositions(record) {
    const startFen = (record.rules && record.rules.startFen) || window.XQ.START_FEN;
    let pos = window.XQ.parseFen(startFen);
    positions = [pos];
    movesList = record.moves ? record.moves.trim().split(/\s+/).filter(Boolean) : [];

    for (let i = 0; i < movesList.length; i++) {
      const m = window.XQ.iccsToMove(movesList[i]);
      pos = window.XQ.applyMove(pos, m);
      positions.push(pos);
    }
  }

  function goToPly(ply) {
    if (ply < 0) ply = 0;
    if (ply >= positions.length) ply = positions.length - 1;
    currentPly = ply;

    const pos = positions[currentPly];
    window.XQ.Render.syncBoard(pos);
    window.XQ.Render.clearHighlights();

    if (currentPly > 0) {
      const prevMove = window.XQ.iccsToMove(movesList[currentPly - 1]);
      const from = (prevMove >> 7) & 0x7F;
      const to = prevMove & 0x7F;
      window.XQ.Render.showLastMove(from, to);
      window.XQ.Audio.play('place', pos.side === 1 ? 2 : 1);
    }

    // Update scrubber UI
    const slider = document.getElementById('replay-scrubber');
    if (slider) slider.value = currentPly;

    const plyLabel = document.getElementById('replay-ply-label');
    if (plyLabel) plyLabel.textContent = `${currentPly} / ${movesList.length}`;

    // Highlight current move in side table
    const cells = document.querySelectorAll('#side-movelist-container .move-cell');
    cells.forEach(c => c.classList.remove('active-ply'));
    if (currentPly > 0) {
      const activeCell = document.querySelector(`#side-movelist-container .move-cell[data-ply="${currentPly - 1}"]`);
      if (activeCell) {
        activeCell.classList.add('active-ply');
        activeCell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  function stepForward() {
    if (currentPly < positions.length - 1) {
      goToPly(currentPly + 1);
    } else {
      pause();
    }
  }

  function stepBack() {
    if (currentPly > 0) {
      goToPly(currentPly - 1);
    }
  }

  function play() {
    isPlaying = true;
    const playBtn = document.getElementById('btn-replay-play');
    if (playBtn) playBtn.textContent = '⏸';

    clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (currentPly >= positions.length - 1) {
        pause();
      } else {
        stepForward();
      }
    }, Math.floor(1000 / playbackSpeed));
  }

  function pause() {
    isPlaying = false;
    clearInterval(playTimer);
    const playBtn = document.getElementById('btn-replay-play');
    if (playBtn) playBtn.textContent = '▶';
  }

  const Replay = {
    start(record, initialPly) {
      activeRecord = record;
      buildPositions(record);
      currentPly = 0;
      isPlaying = false;

      // Board flip based on human side
      const humanSide = (record.humanSide !== undefined) ? record.humanSide : (record.ai ? -record.ai.side : 1);
      window.XQ.Render.setFlipped(humanSide === -1);

      // Switch to game screen in replay mode
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const gameScreen = document.getElementById('screen-game');
      if (gameScreen) gameScreen.classList.add('active');

      const replayBar = document.getElementById('replay-toolbar');
      if (replayBar) replayBar.style.display = 'flex';

      // Setup scrubber slider
      const slider = document.getElementById('replay-scrubber');
      if (slider) {
        slider.min = 0;
        slider.max = movesList.length;
        slider.value = 0;
      }

      // Populate move list and player bars in side panel
      const dummyGame = {
        plies: movesList.map(mStr => ({ m: window.XQ.iccsToMove(mStr) })),
        rules: record.rules,
        mode: record.mode,
        humanSide,
        ai: record.ai,
        timeLeft: record.timeLeft
      };
      window.XQ.ui.updatePlayerBars(dummyGame);
      window.XQ.ui.updateMoveListTable(dummyGame);

      window.XQ.Input.setEnabled(false);
      const startAt = (initialPly !== undefined && initialPly !== null) ? initialPly : 0;
      goToPly(startAt);
    },

    stop(skipRestore = false) {
      pause();
      activeRecord = null;
      const replayBar = document.getElementById('replay-toolbar');
      if (replayBar) replayBar.style.display = 'none';

      window.XQ.Input.setEnabled(true);
      if (!skipRestore) {
        if (window.XQ.controller && window.XQ.controller.getGame() && window.XQ.controller.getGame().status === 'in_progress') {
          window.XQ.controller.restoreLiveBoard();
        } else {
          window.XQ.ui.showScreen('screen-start');
        }
      }
    },

    stepForward,
    stepBack,
    togglePlay() {
      if (isPlaying) pause();
      else play();
    },
    setSpeed(speed) {
      playbackSpeed = speed;
      if (isPlaying) play();
    },
    goToPly,
    getActiveRecord() {
      return activeRecord;
    },
    getCurrentPly() {
      return currentPly;
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.Replay = Replay;
})();
