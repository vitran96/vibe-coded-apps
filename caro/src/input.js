'use strict';
// 07 Input Controller (Unified Pointer Events, Pan/Zoom, Tap-to-confirm, Keyboard)
// ============================================================
class InputController {
  constructor(renderer, onPlaceAttempt) {
    this.renderer = renderer;
    this.onPlaceAttempt = onPlaceAttempt;
    this.host = renderer.host;

    this.pointers = new Map();
    this.dragStart = null;
    this.isDragging = false;
    this.pinchDist = null;
    this.pinchCenter = null;
    this.tapStartTime = 0;
    this.pendingConfirmCell = null;

    // Keyboard cursor
    this.cursorX = Math.floor(renderer.N / 2);
    this.cursorY = Math.floor(renderer.N / 2);

    this.initPointers();
    this.initWheel();
    this.initKeyboard();
    this.initConfirmBar();
  }

  initPointers() {
    this.host.addEventListener('pointerdown', (e) => {
      App.audio.unlock();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.tapStartTime = performance.now();
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.isDragging = false;
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.pinchCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        this.isDragging = true;
      }
      this.host.setPointerCapture(e.pointerId);
    });

    this.host.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) {
        // Hover ghost for mouse
        if (e.pointerType === 'mouse' && !App.game.isThinking && App.game.state === 'playing') {
          const cell = this.clientToCell(e.clientX, e.clientY);
          if (cell && App.game.board[cell.cy * App.game.session.boardSize + cell.cx] === 0) {
            this.renderer.setGhost(cell.cx, cell.cy, App.game.turn);
          } else {
            this.renderer.setGhost(null, null);
          }
        }
        return;
      }

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (!this.isDragging && Math.hypot(dx, dy) > 8) {
          this.isDragging = true;
        }
        if (this.isDragging) {
          const zoom = this.renderer.camera.zoom;
          this.renderer.camera.position.x -= dx / zoom;
          this.renderer.camera.position.y += dy / zoom;
          this.renderer.clampCamera();
          this.renderer.needsRender = true;
          this.dragStart = { x: e.clientX, y: e.clientY };
        }
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

        if (this.pinchDist && dist > 0) {
          const factor = dist / this.pinchDist;
          this.zoomAtPoint(center.x, center.y, factor);
        }
        this.pinchDist = dist;
        this.pinchCenter = center;
      }
    });

    const onPointerEnd = (e) => {
      if (this.pointers.has(e.pointerId)) {
        this.pointers.delete(e.pointerId);
        try { this.host.releasePointerCapture(e.pointerId); } catch {}
      }

      if (this.pointers.size === 0) {
        const duration = performance.now() - this.tapStartTime;
        if (!this.isDragging && duration < 350) {
          this.handleTap(e.clientX, e.clientY);
        }
        this.isDragging = false;
        this.pinchDist = null;
      }
    };

    this.host.addEventListener('pointerup', onPointerEnd);
    this.host.addEventListener('pointercancel', onPointerEnd);

    // Prevent Safari gesture zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('gesturechange', e => e.preventDefault());
  }

  initWheel() {
    this.host.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoomAtPoint(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });
  }

  zoomAtPoint(clientX, clientY, factor) {
    const camera = this.renderer.camera;
    const oldZoom = camera.zoom;
    const fullFit = Math.min(this.host.clientWidth, this.host.clientHeight) / ((this.renderer.N + 3) * this.renderer.cellSize);
    const targetZoom = this.renderer.getTargetZoom();
    const minZoom = IS_TOUCH_DEVICE ? Math.max(fullFit, targetZoom * 0.5) : fullFit;
    const maxZoom = 120;
    const newZoom = clamp(oldZoom * factor, minZoom, maxZoom);

    if (Math.abs(newZoom - oldZoom) < 0.001) return;

    // Zoom centered at client point
    const rect = this.host.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = -(clientY - rect.top - rect.height / 2);

    const worldX = camera.position.x + px / oldZoom;
    const worldY = camera.position.y + py / oldZoom;

    camera.zoom = newZoom;
    camera.position.x = worldX - px / newZoom;
    camera.position.y = worldY - py / newZoom;
    this.renderer.clampCamera();
    camera.updateProjectionMatrix();
    this.renderer.needsRender = true;
  }

  clientToCell(clientX, clientY) {
    const rect = this.host.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = -(clientY - rect.top - rect.height / 2);

    const camera = this.renderer.camera;
    const wx = camera.position.x + px / camera.zoom;
    const wy = camera.position.y + py / camera.zoom;

    const { cx, cy } = this.renderer.worldToCell(wx, wy);
    if (cx < 0 || cy < 0 || cx >= this.renderer.N || cy >= this.renderer.N) return null;
    return { cx, cy };
  }

  handleTap(clientX, clientY) {
    if (App.game.isThinking || App.game.state !== 'playing') return;

    const cell = this.clientToCell(clientX, clientY);
    if (!cell) {
      this.dismissConfirm();
      return;
    }

    const { cx, cy } = cell;
    const N = App.game.session.boardSize;
    if (App.game.board[cy * N + cx] !== 0) {
      App.audio.playInvalid();
      this.dismissConfirm();
      return;
    }

    // Tap-to-confirm evaluation
    const confirmMode = App.settings.display.tapConfirm;
    const requiresConfirm = confirmMode === 'always' || (confirmMode === 'auto' && IS_COARSE);

    if (requiresConfirm) {
      if (this.pendingConfirmCell && this.pendingConfirmCell.cx === cx && this.pendingConfirmCell.cy === cy) {
        // Tapped same cell second time -> confirm
        this.confirmMove();
      } else {
        // First tap -> preview ghost and show bar
        this.pendingConfirmCell = { cx, cy };
        this.renderer.setGhost(cx, cy, App.game.turn);
        App.audio.playPreview();
        this.showConfirmBar();
      }
    } else {
      this.onPlaceAttempt(cx, cy);
    }
  }

  showConfirmBar() {
    const bar = $('#confirm-bar');
    if (bar) bar.hidden = false;
  }

  dismissConfirm() {
    this.pendingConfirmCell = null;
    const bar = $('#confirm-bar');
    if (bar) bar.hidden = true;
    this.renderer.setGhost(null, null);
  }

  confirmMove() {
    if (this.pendingConfirmCell) {
      const { cx, cy } = this.pendingConfirmCell;
      this.dismissConfirm();
      this.onPlaceAttempt(cx, cy);
    }
  }

  initConfirmBar() {
    $('#btn-confirm-yes')?.addEventListener('click', () => this.confirmMove());
    $('#btn-confirm-no')?.addEventListener('click', () => this.dismissConfirm());
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore keyboard if inside input/dialog
      if (e.target.matches('input, select, textarea, button') && e.key !== 'Escape') return;

      const N = this.renderer.N;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
          this.cursorX = Math.max(0, this.cursorX - 1);
          handled = true;
          break;
        case 'ArrowRight':
          this.cursorX = Math.min(N - 1, this.cursorX + 1);
          handled = true;
          break;
        case 'ArrowUp':
          this.cursorY = Math.max(0, this.cursorY - 1);
          handled = true;
          break;
        case 'ArrowDown':
          this.cursorY = Math.min(N - 1, this.cursorY + 1);
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (App.game.state === 'playing' && !App.game.isThinking) {
            this.onPlaceAttempt(this.cursorX, this.cursorY);
          }
          handled = true;
          break;
        case '+':
        case '=':
          this.zoomAtPoint(window.innerWidth / 2, window.innerHeight / 2, 1.25);
          handled = true;
          break;
        case '-':
        case '_':
          this.zoomAtPoint(window.innerWidth / 2, window.innerHeight / 2, 0.8);
          handled = true;
          break;
        case 'f':
        case 'F':
          this.renderer.fitBoard();
          handled = true;
          break;
        case 'u':
        case 'U':
          if (App.settings.game.allowUndo !== false) App.game.undo();
          handled = true;
          break;
        case 'Escape':
          this.dismissConfirm();
          $$('dialog[open]').forEach(d => d.close());
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          this.renderer.setGhost(this.cursorX, this.cursorY, App.game.turn);
        }
      }
    });
  }
}

// ============================================================
