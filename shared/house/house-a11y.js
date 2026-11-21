// Accessibility helpers: live announcements, dialog focus return, board keyboard cursor.
// Nothing touches the DOM at load time, so the Node self-test can load this file.
(() => {
  const H = (globalThis.House ??= {});
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  // One visually-hidden aria-live region for the whole page.
  let region = null;
  H.announce = (text, { assertive = false } = {}) => {
    if (!region) {
      region = document.createElement('div');
      region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      document.body.append(region);
    }
    region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    region.textContent = '';
    region.textContent = text;
  };

  // Native <dialog> helpers: Esc closes (native), focus goes back to the opener, open/close sounds.
  H.dialogs = {
    open(dlg) {
      if (dlg.open) return;
      const opener = document.activeElement;
      dlg.addEventListener('close', () => { opener?.focus?.(); H.audio?.play('close'); }, { once: true });
      dlg.showModal();
      H.audio?.play('open');
    },
    close(dlg) { if (dlg.open) dlg.close(); },
  };

  // Pure step for the cursor: returns the next cell, or null when the key is not a cursor key.
  H.boardStep = (x, y, key, cols, rows) => {
    if (ARROW[key]) {
      const [dx, dy] = ARROW[key];
      return { x: clamp(x + dx, 0, cols - 1), y: clamp(y + dy, 0, rows - 1) };
    }
    if (key === 'Home') return { x: 0, y };
    if (key === 'End') return { x: cols - 1, y };
    if (key === 'PageUp') return { x, y: 0 };
    if (key === 'PageDown') return { x, y: rows - 1 };
    return null;
  };

  // Read-only test hook, filled by each app: cellToClient(x, y) -> {x, y} CSS px, camera() -> {x, y, z}. No setters.
  H.debug = {};

  // Board keyboard cursor on `el`. Arrows/Home/End/PageUp/PageDown move; Enter/Space activate.
  // describe(x, y) gives the localized text announced on each move. Returns the live cursor {x, y}.
  H.boardCursor = ({ el, cols, rows, describe, onMove, onActivate }) => {
    const cur = { x: 0, y: 0 };
    el.setAttribute('role', 'application');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.addEventListener('keydown', (e) => {
      const next = H.boardStep(cur.x, cur.y, e.key, cols, rows);
      if (next) {
        e.preventDefault();
        Object.assign(cur, next);
        H.announce(describe(cur.x, cur.y));
        onMove?.(cur.x, cur.y);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate?.(cur.x, cur.y);
      }
    });
    return cur;
  };
})();
