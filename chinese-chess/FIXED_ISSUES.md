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

### Issue #007: Inability to Play Old Ended or Forfeited Games (Interactive Replay)
- **Symptom:** Previously ended or forfeited matches could only be observed passively through the replay scrubber with board interaction locked; players could not play from the ended/forfeited board state or retry the position.
- **Root Cause:** Replay system only supported passive scrubbing (`Input.setEnabled(false)`); there was no controller API to spin up a live game from recorded plies/FEN, no "Chơi tiếp" button in History, and no "Chơi từ đây" button in the replay viewer toolbar. Furthermore, `humanSide` was not persisted in records, and in-game side panel lacked a History button.
- **Fix:** 
  1. Implemented `playFromRecord(record, plyIndex)` in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js), reconstructing board state and move history to allow instant live play against AI or human from any ply (including the final forfeited position).
  2. Added "Chơi từ đây" (`#btn-replay-play-from-here`) to the replay toolbar in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html).
  3. Added "Chơi tiếp" (`.btn-history-play`) alongside "Xem lại" in the History list in [src/ui.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/ui.js).
  4. Added "Lịch sử" (`#btn-action-history`) to `.panel-menu-actions` on the game screen.
  5. Saved `humanSide` in records and ensured board orientation and side notation sync correctly during replay and play resumption.

### Issue #008: Missing Undo Toggle in New Game Menu & Real-Time Auto-Recording for Watching Past Matches
- **Symptom:** 
  1. New Game menu lacked a toggle setting to enable or disable the Undo ("Đi lại") action.
  2. Matches were only recorded upon formal checkmate/resignation/draw modals. Any match refreshed, left, or abandoned was lost, leaving players unable to find and watch their recent games.
- **Root Cause:** 
  1. `dialog-newgame` did not have an `allowUndo` option, and `Controller.undo()` had no rule gating.
  2. Storage saving was coupled solely to `finishGame()` rather than per-ply streaming.
- **Fix:** 
  1. Added `allowUndo` toggle chips (`Bật` / `Tắt`) to `dialog-newgame` in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html), persisted preference in storage, and dynamically disabled the in-game undo button when turned off.
  2. Implemented `autoRecordMatch()` in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js) and in-place record updating by ID in [src/storage.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/storage.js) to continuously auto-record every move, undo, page reload, and game termination.
### Issue #009: Bot Unresponsiveness & Game Freeze
- **Symptom:** Regardless of AI level (easy, medium, hard), the bot would fail to make a move after player input, leaving the game in an unplayable frozen state until browser refresh.
- **Root Cause:**
  1. The Web Worker in `src/ai-client.js` lacked error handlers (`worker.onerror`) and a watchdog timeout. When a blob worker failed or encountered silent errors, no message returned to the main thread.
  2. The main thread disabled input via `window.XQ.Input.setEnabled(false)` while waiting for the AI. Because no callback was invoked, input remained disabled forever.
- **Fix:**
  1. Added `worker.onerror` handler and try-catch wrappers inside the worker in [src/ai-client.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/ai-client.js).
  2. Added an automatic watchdog timeout in `requestMove()` to fall back seamlessly to synchronous `window.XQ.searchRoot` on the main thread if the worker hangs or errors.
  3. Added legal-move fallbacks so AI always plays a move and re-enables player input, guaranteeing the game never freezes.

### Issue #010: UI Modernization (Right Side Panel Menu, Box Buttons, In-Game Forfeit Dialog, Default Light Theme, Move History & Replay)
- **Symptom:**
  1. Menu was not properly structured in a dedicated right side panel with move history above the menu.
  2. Menu buttons lacked clean rectangular box button styling with explicit text.
  3. Draw button was redundant and non-functional.
  4. Forfeit (Xin thua) lacked an in-game confirmation dialog (or used browser alert).
  5. Settings button did not open reliably due to DOMContentLoaded event race condition.
  6. Dark theme was applied by default on devices with dark mode preference.
  7. Replay feature was missing from side panel and move history table.
- **Root Cause:**
  1. `document.addEventListener('DOMContentLoaded', ...)` in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js) did not handle cases where `document.readyState !== 'loading'`, leading to unattached click handlers.
  2. Forfeit immediately called `resign()` without an in-game modal dialog.
  3. Default theme was `'auto'`, resolving to `'dem'` (dark).
  4. Move history table in side panel lacked clickable cells and replay integration.
- **Fix:**
  1. Replaced DOMContentLoaded listener with a robust `boot()` check (`document.readyState === 'loading' ? ... : boot()`).
  2. Moved move history (`#side-movelist-container`) above the menu actions in `#game-side-panel`, and styled `.panel-menu-actions` as a 2-column grid of rectangular box buttons (`.btn-action`) with icons and text ("Đi lại", "Xin thua", "Xem lại", "Ván mới", "Lịch sử", "Luật chơi", "Cài đặt").
  3. Fully removed any draw button from game UI.
  4. Added `<dialog id="dialog-resign-confirm">` for forfeit confirmation in [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html) with custom "Huỷ" and "Xin thua" buttons, eliminating browser alerts.
  5. Defaulted default theme to light theme (`giay`) in [src/house-kit.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/house-kit.js), [src/index.html](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/index.html), and [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js).
  6. Added `#btn-action-replay` ("Xem lại") to the side panel menu and made each move cell in the move list table clickable to instantly jump to and inspect that move in replay mode.


