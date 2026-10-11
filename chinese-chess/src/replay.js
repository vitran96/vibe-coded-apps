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
    start(record) {
      activeRecord = record;
      buildPositions(record);
      currentPly = 0;
      isPlaying = false;

      // Switch to game screen in replay mode
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const gameScreen = document.getElementById('screen-game');
      if (gameScreen) gameScreen.classList.add('active');

      const replayBar = document.getElementById('replay-toolbar');
      if (replayBar) replayBar.style.display = 'flex';
      const normalBar = document.getElementById('game-normal-toolbar');
      if (normalBar) normalBar.style.display = 'none';

      // Setup scrubber slider
      const slider = document.getElementById('replay-scrubber');
      if (slider) {
        slider.min = 0;
        slider.max = movesList.length;
        slider.value = 0;
      }

      window.XQ.Input.setEnabled(false);
      goToPly(0);
    },

    stop() {
      pause();
      activeRecord = null;
      const replayBar = document.getElementById('replay-toolbar');
      if (replayBar) replayBar.style.display = 'none';
      const normalBar = document.getElementById('game-normal-toolbar');
      if (normalBar) normalBar.style.display = 'flex';

      window.XQ.Input.setEnabled(true);
      // Restore live game
      if (window.XQ.controller) {
        window.XQ.controller.restoreLiveBoard();
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
    goToPly
  };

  window.XQ = window.XQ || {};
  window.XQ.Replay = Replay;
})();
