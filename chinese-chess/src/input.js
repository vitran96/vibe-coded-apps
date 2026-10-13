// input.js — pointer, drag, and keyboard interaction
(() => {
  let isEnabled = true;
  let selectedSq = -1;
  let currentLegalMoves = []; // array of { m, to, isCapture }
  let confirmPendingMove = 0;

  let pointerDown = false;
  let startX = 0, startY = 0;
  let isDragging = false;
  let draggedSq = -1;

  let focusedSq = 4; // keyboard cursor (starts near Red King at e0)

  // Callbacks hooked by controller
  let onMoveSelected = null;

  function initInput(canvas, callbacks) {
    onMoveSelected = callbacks.onMove;

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
        const pos = window.XQ.controller ? window.XQ.controller.getPos() : null;
        if (pos && pos.board[draggedSq] !== 0 && (pos.board[draggedSq] > 0 ? 1 : -1) === pos.side) {
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

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // Don't intercept when modal / dialog is open
      if (document.querySelector('dialog[open]')) return;

      const key = e.key.toLowerCase();
      if (key === 'u') {
        window.XQ.controller && window.XQ.controller.undo();
        return;
      }
      if (key === '?' || (e.shiftKey && key === '/')) {
        window.XQ.ui && window.XQ.ui.showRulesPage();
        return;
      }
      if (key === 'escape') {
        clearSelection();
        return;
      }

      if (!isEnabled) return;

      let f = focusedSq % 9;
      let r = Math.floor(focusedSq / 9);

      if (e.key === 'ArrowLeft') { f = Math.max(0, f - 1); }
      else if (e.key === 'ArrowRight') { f = Math.min(8, f + 1); }
      else if (e.key === 'ArrowUp') { r = Math.min(9, r + 1); }
      else if (e.key === 'ArrowDown') { r = Math.max(0, r - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTapSquare(focusedSq);
        return;
      } else {
        return;
      }

      e.preventDefault();
      focusedSq = r * 9 + f;
      // Visual indication for keyboard cursor
      window.XQ.Render.showSelection(focusedSq);
    });

    // Prevent pinch zoom and double tap zoom on iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  function selectSquare(sq) {
    const pos = window.XQ.controller ? window.XQ.controller.getPos() : null;
    if (!pos) return;
    const piece = pos.board[sq];
    if (piece === 0 || (piece > 0 ? 1 : -1) !== pos.side) return;

    selectedSq = sq;
    confirmPendingMove = 0;
    window.XQ.Audio.play('select');

    // Get legal moves from this square
    const allLegal = window.XQ.legalMoves(pos);
    currentLegalMoves = [];
    const quiet = [], captures = [];

    for (const m of allLegal) {
      const from = (m >> 7) & 0x7F;
      if (from === sq) {
        const to = m & 0x7F;
        const isCap = (pos.board[to] !== 0);
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
    const pos = window.XQ.controller ? window.XQ.controller.getPos() : null;
    if (!pos) return;

    // Tap on friendly piece: select/reselect
    if (pos.board[sq] !== 0 && (pos.board[sq] > 0 ? 1 : -1) === pos.side) {
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
        window.XQ.toast('Chạm lần nữa để đi');
        return;
      }

      // Commit move
      const move = matched.m;
      clearSelection();
      if (onMoveSelected) onMoveSelected(move);
    } else {
      // Illegal move clicked
      window.XQ.Audio.play('invalid');
      const pos = window.XQ.controller ? window.XQ.controller.getPos() : null;
      if (pos && window.XQ.inCheck(pos, pos.side)) {
        window.XQ.toast(window.House.i18n.t('game.invalid.inCheck'));
      }
      clearSelection();
    }
  }

  const Input = {
    init: initInput,
    setEnabled(val) { isEnabled = val; },
    clearSelection
  };

  window.XQ = window.XQ || {};
  window.XQ.Input = Input;
})();
