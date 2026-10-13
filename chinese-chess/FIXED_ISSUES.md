---
name: fixed-issues
description: Fixed issues and guidelines for Cờ Tướng (Chinese Chess) to prevent future mistakes and regressions
---

# Fixed Issues & Review Guidelines: Cờ Tướng

This document tracks identified bugs, design corrections, and architectural rules to prevent regressions in future reviews and implementations.

---

## 1. Review Guidelines (Preventing Mistakes)

1. **3D Piece Glyph Orientation (Three.js Top-Cap UVs)**
   - In Three.js `CylinderGeometry`, top-cap UV `v=1.0` (top of texture) lies along the local `+X` axis.
   - When viewed from top-down (`y=20, lookAt(0,0,0)`), unrotated cylinders render glyphs horizontally (facing left).
   - **Rule:** Always orient Red pieces with `mesh.rotation.y = Math.PI / 2` (top of glyph faces `-Z`, reading upright for Red at bottom) and Black pieces with `mesh.rotation.y = -Math.PI / 2` (top of glyph faces `+Z`, reading upright for Black at top).
   - Never rely on 2D canvas texture mirroring or rotating when 3D mesh rotation can position the physical object directly.

2. **Translation & Reason Key Completeness (i18n)**
   - Every `reason` enum emitted by the controller (`checkmate`, `stalemate`, `perpetual_check`, `repetition`, `move_limit`, `no_material`, `agreement`, `resign`, `timeout`, `abandoned`) must have a corresponding `game.reason.<reason>` entry in both `vi` and `en` dictionaries.
   - Game-over modal must handle all statuses (`win`, `draw`, `forfeit`, `timeout`) and format winner/loser side names using localized names, never leaving English fallback keys or empty captions.

3. **Game Screen Layout & Side Panel (Responsive UX)**
   - On desktop/tablet (width ≥ 768px), display a dedicated right-side panel next to the board (`.board-column` and `.game-side-panel`).
   - The side panel must directly show:
     - The real-time scrollable move list table (`#side-movelist-container`) showing notation for all plies taken so far.
     - Horizontal action buttons with icons and explicit text (`.btn-action`), rather than floating round icon-only buttons.
   - On mobile screens (< 768px), stack the panel below the board with horizontal scrolling for action buttons.

4. **Board Orientation & Flipping Automation**
   - Do NOT provide a manual flip button that can desynchronize perspective.
   - The board orientation must automatically and strictly flip based on Player 1's chosen side:
     - Player 1 = Red → Normal view (`setFlipped(false)`).
     - Player 1 = Black → 180° rotated view (`setFlipped(true)`).

5. **Clean Menu Options (YAGNI / Minimal Surface)**
   - Do not include speculative options (e.g. Draw offer button) unless explicitly specified.

---

## 2. Issue Log

### Issue #001: 3D Piece Characters Facing Sideways (Left)
- **Symptom:** Chinese characters on the wooden piece discs were rotated 90 degrees counter-clockwise (facing left) instead of facing the player.
- **Root Cause:** Default `CylinderGeometry` top-cap UVs align the vertical axis with local `+X`. With `rotation.y = 0`, glyph tops pointed to the right of the screen.
- **Fix:** In [src/render.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/render.js), set `mesh.rotation.y = piece > 0 ? Math.PI / 2 : -Math.PI / 2` in `syncBoard` and `refreshPieces`. This points Red glyphs towards `-Z` (facing Red player) and Black glyphs towards `+Z` (facing Black player).

### Issue #002: Missing Resign Translation String & Game Over Result Handling
- **Symptom:** When a player resigned, the game-over dialog displayed a fallback string and reason key `game.reason.resign` was untranslated.
- **Root Cause:** `game.reason.resign` and `game.reason.timeout` were omitted from `GAME_STRINGS` in [src/i18n.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/i18n.js), and `showGameOver` only branched on `status === 'win'`.
- **Fix:** Added `game.reason.resign` and `game.reason.timeout` to both `vi` and `en` in [src/i18n.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/i18n.js). Updated [src/ui.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/ui.js) to properly format `status === 'forfeit'` in title, reason, and history badges.

### Issue #003: Action Buttons Displayed as Icon-Only Floating Toolbar
- **Symptom:** In-game actions were icon-only circular buttons requiring hovering/guessing.
- **Root Cause:** Toolbar only had `.btn-icon` elements without text labels.
- **Fix:** Replaced toolbar with horizontal action buttons (`.btn-action`) in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html) and [src/game.css](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/game.css), containing SVG icons and localized text ("Đi lại", "Xin thua", "Ván mới", "Luật chơi", "Cài đặt").

### Issue #004: In-Game Moves List Hidden in Modal Dialog
- **Symptom:** Players could not see the moves played so far without opening a separate dialog.
- **Root Cause:** Move table was only rendered inside `<dialog id="dialog-movelist">`.
- **Fix:** Added `#side-movelist-container` directly into the right-side panel in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html), and updated `updateMoveListTable` in [src/ui.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/ui.js) to automatically populate and auto-scroll to the latest move after every turn.

### Issue #005: Manual Flip Board Button
- **Symptom:** Flip board button allowed manual toggling that was redundant and could confuse side orientation.
- **Root Cause:** Manual flip button and keyboard shortcut `f` were present.
- **Fix:** Removed flip button from UI and removed keyboard shortcut `f` in [src/input.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/input.js). In [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js), board automatically flips if and only if Player 1 plays Black (`humanSide === -1`).

### Issue #006: Unwanted Draw Button
- **Symptom:** "Cầu hoà" (Offer draw) button was present in game menu.
- **Root Cause:** Speculative multiplayer draw feature.
- **Fix:** Removed "Cầu hoà" button and associated dialog in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html) and event handlers in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js).
