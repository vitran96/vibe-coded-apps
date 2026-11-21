// input.js — taps, drags and the keyboard cursor on the 3D board. Keys use House.boardCursor on the canvas.
(() => {
  const H = window.House;
  const PIECE_KEYS = ['game.piece.k', 'game.piece.a', 'game.piece.e', 'game.piece.h', 'game.piece.r', 'game.piece.c', 'game.piece.p']; // by |piece| 1..7
  let isEnabled = true;
  let selectedSq = -1;
  let currentLegalMoves = []; // array of { m, to, isCapture }
  let confirmPendingMove = 0;

  let pointerDown = false;
  let startX = 0, startY = 0;
  let isDragging = false;
  let draggedSq = -1;

  let cursor = { x: 4, y: 9 }; // screen cell; replaced by the live cursor from House.boardCursor
  let onMoveSelected = null;

  const pos = () => (window.XQ.controller ? window.XQ.controller.getPos() : null);
  const flipped = () => window.XQ.Render.getFlipped();

  // Screen cell (x 0..8 left to right, y 0..9 top to bottom) <-> square (rank * 9 + file). Black's view is flipped.
  const cellToSq = (x, y) => (flipped() ? y * 9 + (8 - x) : (9 - y) * 9 + x);
  const sqToCell = (sq) => {
    const f = sq % 9, r = Math.floor(sq / 9);
    return flipped() ? { x: 8 - f, y: r } : { x: f, y: 9 - r };
  };
  const sqName = (sq) => 'abcdefghi'[sq % 9] + Math.floor(sq / 9); // ICCS-style, e.g. e0
  window.XQ = window.XQ || {};
  window.XQ.sqName = sqName;

  function describe(x, y) {
    const sq = cellToSq(x, y);
    const p = pos() ? pos().board[sq] : 0;
    const what = p
      ? `${H.i18n.t(p > 0 ? 'game.side.red' : 'game.side.black')} ${H.i18n.t(PIECE_KEYS[Math.abs(p) - 1])}`
      : H.i18n.t('board.empty');
    return `${sqName(sq)}: ${what}`;
  }

  function initInput(canvas, callbacks) {
    onMoveSelected = callbacks.onMove;

    // Keyboard: arrows, Home/End, PageUp/PageDown move; Enter/Space act (House.boardCursor announces each move).
    cursor = H.boardCursor({
      el: canvas,
      cols: 9,
      rows: 10,
      describe,
      onMove: (x, y) => window.XQ.Render.setCursor(cellToSq(x, y)),
      onActivate: (x, y) => { if (isEnabled) handleTapSquare(cellToSq(x, y)); }
    });
    canvas.addEventListener('keydown', (e) => { if (e.key === 'Escape') clearSelection(); });

    // Pointer events
    canvas.addEventListener('pointerdown', (e) => {
      if (!isEnabled) return;
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      draggedSq = window.XQ.Render.raycastSquare(e.clientX, e.clientY);
      isDragging = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!pointerDown || !isEnabled || draggedSq < 0) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) > 8) {
        // Only start drag if draggedSq is own piece
        const p = pos();
        if (p && p.board[draggedSq] !== 0 && (p.board[draggedSq] > 0 ? 1 : -1) === p.side) {
          isDragging = true;
          selectSquare(draggedSq);
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!pointerDown) return;
      pointerDown = false;

      if (!isEnabled) return;
      const targetSq = window.XQ.Render.raycastSquare(e.clientX, e.clientY);

      if (isDragging) {
        isDragging = false;
        if (targetSq >= 0 && selectedSq >= 0 && targetSq !== selectedSq) {
          tryCommitMove(selectedSq, targetSq);
        }
        return;
      }

      // Tap handling
      if (targetSq >= 0) {
        handleTapSquare(targetSq);
      } else {
        clearSelection();
      }
    });

    // Prevent pinch zoom and double tap zoom on iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  function selectSquare(sq) {
    const p = pos();
    if (!p) return;
    const piece = p.board[sq];
    if (piece === 0 || (piece > 0 ? 1 : -1) !== p.side) return;

    selectedSq = sq;
    confirmPendingMove = 0;
    window.XQ.Audio.play('select');

    // Get legal moves from this square
    const allLegal = window.XQ.legalMoves(p);
    currentLegalMoves = [];
    const quiet = [], captures = [];

    for (const m of allLegal) {
      const from = (m >> 7) & 0x7F;
      if (from === sq) {
        const to = m & 0x7F;
        const isCap = (p.board[to] !== 0);
        currentLegalMoves.push({ m, to, isCapture: isCap });
        if (isCap) captures.push(to);
        else quiet.push(to);
      }
    }

    window.XQ.Render.clearHighlights();
    window.XQ.Render.showSelection(sq);

    const settings = window.XQ.Storage ? window.XQ.Storage.loadSettings() : {};
    if (settings.showMoves !== false) {
      window.XQ.Render.showTargets(quiet, captures);
    }
  }

  function clearSelection() {
    selectedSq = -1;
    currentLegalMoves = [];
    confirmPendingMove = 0;
    window.XQ.Render.clearHighlights();
    // Re-show last move highlight if applicable
    if (window.XQ.controller) {
      window.XQ.controller.refreshLastMoveHighlight();
    }
  }

  function handleTapSquare(sq) {
    const p = pos();
    if (!p) return;

    // Tap on friendly piece: select/reselect
    if (p.board[sq] !== 0 && (p.board[sq] > 0 ? 1 : -1) === p.side) {
      selectSquare(sq);
      return;
    }

    // If a piece is already selected, try moving to target
    if (selectedSq >= 0) {
      tryCommitMove(selectedSq, sq);
    }
  }

  function tryCommitMove(fromSq, toSq) {
    const matched = currentLegalMoves.find(item => item.to === toSq);
    if (matched) {
      const settings = window.XQ.Storage ? window.XQ.Storage.loadSettings() : {};
      if (settings.confirm && confirmPendingMove !== matched.m) {
        // Tap twice to confirm enabled: first tap
        confirmPendingMove = matched.m;
        window.XQ.toast(H.i18n.t('game.tapAgain'));
        return;
      }

      // Commit move
      const move = matched.m;
      clearSelection();
      if (onMoveSelected) onMoveSelected(move);
    } else {
      // Illegal move clicked
      window.XQ.Audio.play('invalid');
      const p = pos();
      if (p && window.XQ.inCheck(p, p.side)) {
        window.XQ.toast(H.i18n.t('game.invalid.inCheck'));
      }
      clearSelection();
    }
  }

  const Input = {
    init: initInput,
    setEnabled(val) { isEnabled = val; },
    clearSelection,
    // Put the keyboard cursor on a square (the side's own king when a game starts or resumes).
    centerOnKing(sq) {
      if (sq < 0) return;
      const c = sqToCell(sq);
      cursor.x = c.x;
      cursor.y = c.y;
      window.XQ.Render.setCursor(sq);
    }
  };

  window.XQ.Input = Input;
})();
