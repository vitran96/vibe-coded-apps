---
name: fixed-issues
description: Fixed issues and guidelines for Cờ Tướng (Chinese Chess) to prevent future mistakes and regressions
---

# Fixed Issues & Review Guidelines: Cờ Tướng

This document tracks identified bugs, design corrections, and architectural rules to prevent regressions in future reviews and implementations.

---

## 1. Review & Verification Instructions (Preventing Mistakes)

Before finalizing any changes or reviews, always execute this mandatory checklist:

1. **Build Single HTML Standalone:**
   - Run `node scripts/build-single-html.mjs src/index.html index.html`.
   - Ensure the generated `index.html` builds without errors and remains fully self-contained.

2. **Run Engine & Rule Test Suite:**
   - Run `node scripts/run-rules-tests.mjs`.
   - All 25 rules, perft, notation, and perpetual check tests MUST pass (25 passed, 0 failed).

3. **Verify 3D Piece Glyph Orientation Visually:**
   - In Three.js `CylinderGeometry(0.44, 0.44, 0.16, 48)`:
     - Top cap UVs align the character vertical head-to-foot axis along local `+X` (head at `+X`, feet at `-X`).
     - Camera looks down along `-Y`, so screen TOP is world `-Z` (NDC `+Y`), screen BOTTOM is world `+Z` (NDC `-Y`), screen RIGHT is world `+X`, screen LEFT is world `-X`.
     - `rotation.y = 0` points glyphs sideways to the **RIGHT** (world `+X`).
     - `rotation.y = Math.PI` points glyphs sideways to the **LEFT** (world `-X`).
     - **NEVER** set `rotation.y` to `0` or `Math.PI` — that makes piece glyphs face sideways to the left or right!
     - **Orientation rule (board position based, regardless of color):**
       - **Top board pieces (`coords.z < 0`, ranks 5..9):** MUST be set to `mesh.rotation.y = -Math.PI / 2` (-90°).
       - **Bottom board pieces (`coords.z >= 0`, ranks 0..4):** MUST be set to `mesh.rotation.y = Math.PI / 2` (+90°).
       - Use helper `getPieceRotation(z) = z < 0 ? -Math.PI / 2 : Math.PI / 2`.
       - When a piece moves across the river, its orientation must update to match the destination board half upon move completion.

4. **Verify Board Orientation & Automation (No Manual Flip Button):**
   - There must **NOT** be any manual flip button (`Controller.flip` is disabled).
   - The board orientation MUST automatically and strictly flip based on Player 1's chosen side:
     - Player 1 = Red / White → Normal view (`setFlipped(false)`).
     - Player 1 = Black → 180° rotated view (`setFlipped(true)`).
     - When flipped for Player 1 = Black, Black pieces at the bottom automatically read upright facing Player 1.

5. **Verify Single-Ply Undo Integrity:**
   - Each Undo click MUST undo strictly **1 single ply** (`game.plies.pop()`, `game.history.pop()`).
   - It MUST undo only the last black or white move, **never both moves together**.
   - If Undo is disabled via settings (`allowUndo: false`), clicking Undo must NOT revert moves and must display a toast warning.

6. **Verify Translation & Reason Key Completeness (i18n):**
   - Every `reason` enum emitted by the controller (`checkmate`, `stalemate`, `perpetual_check`, `repetition`, `move_limit`, `no_material`, `agreement`, `resign`, `timeout`, `abandoned`) must have a corresponding `game.reason.<reason>` entry in both `vi` and `en` dictionaries.
   - Game-over modal must handle all statuses (`win`, `draw`, `forfeit`, `timeout`) and format winner/loser side names using localized names.

7. **Game Screen Layout & Side Panel (Responsive UX):**
   - Dedicated right-side panel (`#game-side-panel`) contains:
     - The real-time scrollable move list table (`#side-movelist-container`) above the menu actions.
     - 2-column grid of rectangular action box buttons (`.btn-action`) with icons and explicit text.


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

### Issue #011: Undo Behavior (Single-Move / Single-Ply Undo)
- **Symptom:** In PvE mode, clicking Undo took back 2 plies (both AI's move and player's move), preventing players from undoing only the most recent move or stepping back move by move.
- **Root Cause:** `pliesToUndo = (game.mode === 'pve' && game.plies.length >= 2) ? 2 : 1;` in `Controller.undo()` forcibly popped 2 plies in PvE.
- **Fix:** Changed `Controller.undo()` in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js) to pop strictly 1 ply per click (`game.plies.pop()`, `game.history.pop()`), undoing only the last Red or Black move.


### Issue #012: Undo Toggle (Enable/Disable Undo in New Game & Settings)
- **Symptom:** Players could not disable the Undo feature to play strict/competitive games without takebacks.
- **Root Cause:** Undo was unconditionally available in all matches without a configuration setting.
- **Fix:**
  1. Added an undo toggle choice chip group (`.chip-undo`) in New Game dialog (`#dialog-newgame`) and a toggle switch (`#settings-undo-toggle`) in Settings dialog (`#dialog-settings`).
  2. Persisted setting in `Storage.saveSettings({ allowUndo })` and `Storage.saveNewGame({ allowUndo })` with default `allowUndo: true`.
  3. Added bilingual i18n strings (`game.set.allowUndoDesc`).
  4. Synchronized changes bidirectionally between settings checkbox and new game chips in [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js).
  5. Updated `Controller.updateUndoButtonState()` to dim `#btn-action-undo` (`aria-disabled="true"`, `opacity: 0.35`, `cursor: not-allowed`).
  6. Allowed click events on dimmed undo button so clicking it provides clear toast feedback (`"Ván đấu không cho phép đi lại!"` / `"Undo is disabled in this match!"`) without reverting plies.
### Issue #013: 3D Piece Characters Facing Left & Board Flip / Single-Ply Undo Integrity
- **Symptom:**
  1. Characters/glyphs on chess pieces were rendered sideways facing left instead of facing the player on their respective sides (opposite each other).
  2. Manual flip board button or methods existed that could desynchronize board orientation.
  3. Risk of Undo reverting both players' moves at once instead of strictly 1 ply.
- **Root Cause:**
  1. Setting `rotation.y = 0` or `Math.PI` turned glyphs 90° sideways to the left or right due to Three.js `CylinderGeometry` top-cap UV coordinate system.
  2. `Controller.flip()` provided an ad-hoc flip mechanism that could conflict with Player 1's perspective.
- **Fix:**
  1. Updated `src/render.js` so that `mesh.rotation.y = piece > 0 ? Math.PI / 2 : -Math.PI / 2` in `syncBoard()` and `refreshPieces()`. Red pieces at bottom face DOWN/upright towards bottom player (`Math.PI / 2`), Black pieces at top face UP towards top player (`-Math.PI / 2`).
  2. Added automated unit test in `src/tests.js` checking piece rotations to prevent regressions.
  3. Verified that when Player 1 plays Black (`humanSide === -1`), the board automatically flips 180° (`camera.rotation.z = Math.PI`), making Black pieces appear upright facing the player at the bottom.
  4. Removed `Controller.flip()` to guarantee orientation only auto-flips based on Player 1's side.
  5. Verified `Controller.undo()` strictly pops 1 ply per click (`game.plies.pop()`, `game.history.pop()`), undoing only the last Black or White move, never both together.

### Issue #014: 3D Piece Characters Facing Sideways / Inverted (Position-Based Orientation)
- **Symptom:** Black pieces faced right (player 2) and Red pieces faced left (player 1), or pieces faced sideways/inverted relative to their board side.
- **Root Cause:**
  1. Top-cap UV head vector aligns with local `+X`. Camera NDC top is world `-Z` and NDC bottom is world `+Z`.
  2. Setting `rotation.y = 0` or `Math.PI` pointed glyphs to screen right (`+X`) and left (`-X`).
  3. Branching on `piece > 0` coupled orientation to piece color instead of board position, causing pieces on the top board to face backwards or invert incorrectly when crossing the river.
- **Fix:**
  1. In [src/render.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/render.js), added `getPieceRotation(z)` where top board (`z < 0`) is strictly `-Math.PI / 2` and bottom board (`z >= 0`) is strictly `Math.PI / 2`, regardless of color.
  2. Applied `getPieceRotation(coords.z)` in `syncBoard()`, `refreshPieces()`, and on move completion in `animateMove()`.
  3. Updated piece orientation unit tests in [src/tests.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/tests.js) to assert position-based orientation (`z < 0` -> `-Math.PI / 2`, `z >= 0` -> `Math.PI / 2`).

### Issue #015: Cannot Switch to Play as Black on New Match
- **Symptom:** In the New Game dialog (`#dialog-newgame`), clicking the "Đen" (Black) side chip did not switch sides or select the chip; games always started with player 1 playing Red.
- **Root Cause:**
  1. The `.chip-side` chip group lacked an event listener (`bindChipGroup('.chip-side')` was missing in `src/main.js`).
  2. `savedNg.side` was not loaded into `.chip-side` elements on boot.
  3. In `startNewGame`, `if (mode === 'pvp') humanSide = 1` forcibly overrode player 1 to Red regardless of option.
- **Fix:**
  1. In [src/main.js](file:///home/vi-tran/repos/vibe-coded-apps/chinese-chess/src/main.js), added `bindChipGroup('.chip-side', ...)` to update `selectedSide` and persist in storage.
  2. Restored `savedNg.side` to `.chip-side` elements during initialization.
  3. Allowed `humanSide` to respect `options.side` in both PvE and PvP so choosing Black correctly sets `humanSide = -1` and auto-flips the board.
