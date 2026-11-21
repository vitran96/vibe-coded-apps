# Caro & Gomoku - Fixed Issues & Regression Log

This document logs resolved bugs and architectural fixes to prevent regressions. All listed invariants must be preserved in future modifications.

---

### [ISSUE-001] Screen Auto-Move Triggering Unnecessarily
- **Symptom:** Placing a stone in normal gameplay caused unwanted camera panning, even when the cell was nowhere near the screen boundary.
- **Root Cause:** `ensureVisible(x, y)` calculated viewport margins as a percentage (`halfW * 0.22`), which spanned 4-5 cells on desktop and triggered pan jumps for almost half the board.
- **Invariant:**
  - Placed pieces that are not near the screen edge must **never** move the camera.
  - If the entire board dimension fits on screen, camera remains fixed or centered.
  - When near an edge (within 1.2 cell size), camera moves **only slightly** (`clearance = 2.0 * S`) to comfortably reveal the piece without disorienting the player.
- **Location:** `src/renderer.js` → `BoardRenderer.ensureVisible()`.

---

### [ISSUE-002] PvE Bot Undo Reverting Only 1 Move
- **Symptom:** In vs-AI (PvE) games, pressing Undo removed only the AI's move, leaving the turn stuck on the AI or causing the AI to instantly replay.
- **Root Cause:** `undo()` unconditionally popped exactly 1 move regardless of game mode.
- **Invariant:**
  - When playing against AI (`session.mode === 'pve' && session.ai`), Undo **must revert 2 moves** (the bot move and the human move), returning the turn to the human.
  - When playing 2 players / pass-and-play (`pvp`), Undo reverts **1 move**.
- **Location:** `src/game.js` → `GameController.undo()`.

---

### [ISSUE-003] Local Storage Key Prefix Standard
- **Symptom:** Storage keys were formatted with dot notation (`caro.settings`, `caro.records`), inconsistent with the `caro_` namespace prefix.
- **Root Cause:** `LS` constant used legacy dot syntax.
- **Invariant:**
  - All LocalStorage keys start with prefix `caro_` (`caro_settings`, `caro_current`, `caro_records`, `caro_iosHint`); the suffixes are in `LS`.
  - `House.store('caro_', { legacy: ['caro.'] })` still reads legacy `caro.` keys to prevent player data loss.
- **Test:** `scripts/test-caro.mjs` checks the storage prefix; `scripts/test-save.mjs` checks old saves load.
- **Location:** `src/constants.js` → `LS` and `STORAGE_PREFIX`; `src/storage.js` → `store` (House.store); `scripts/test-caro.mjs`.

---

### [ISSUE-004] Console 404 on every served load (optional service worker probe)
- **Symptom:** Opening the game over http(s) logged `404 sw.js` in the browser console; the E2E guard failed on it.
- **Root Cause:** `src/pwa.js` probed for an optional `sw.js` that caro does not ship.
- **Invariant:** Caro does not probe for or register `sw.js` unless it ships that file. Served loads log no 4xx/5xx responses.
- **Test:** `tools/e2e/specs/boot.spec.mjs` (A1; the guard fails on any HTTP status >= 400).
- **Location:** `src/pwa.js` (probe removed).

### [ISSUE-005] Shortcuts N, H, S, ?, M missing; How-to-play sheet unreachable and English-only
- **Symptom:** Pressing N, H, S, ? or M did nothing. The How-to-play sheet existed but no key or button opened it, and its text was English only.
- **Root Cause:** `input.js` handled only the board keys; the sheet was never wired. Its text was hard-coded in `index.html`.
- **Invariant:** N, H, S, ? open new game, history, settings and help; M toggles the Sound setting. Help is also in the menu (`#mn-help`) and is translated through `helpBody` (`vi` and `en`).
- **Test:** `tools/e2e/specs/house.spec.mjs` B7 (shortcuts, M, sheet-open guard).
- **Location:** `src/input.js` → `initKeyboard`; `src/ui.js` → `openHelp`, `toggleSound`; `src/i18n.js` → `helpBody`; `src/index.html` → `#dlg-help`, `#mn-help`.

### [ISSUE-006] Keys ignored after a sheet closed while a button had focus
- **Symptom:** After closing Settings with Esc, letter shortcuts (M, H, ...) did nothing until the player clicked the board.
- **Root Cause:** The keyboard guard dropped every key whose target was a `button`, and focus returns to the opener button after a sheet closes.
- **Invariant:** Only text fields swallow keys; a focused button swallows only Enter and Space (they stay native). Keys are ignored while a sheet is open, except Esc.
- **Test:** B7 (M toggles after a sheet closes) and B8 (focus returns to the opener).
- **Location:** `src/input.js` → `initKeyboard` guard.

### [ISSUE-007] Danger buttons unreadable on the light theme (contrast 2.8:1)
- **Symptom:** The "Đầu hàng" / "Khôi phục" buttons were hard to read.
- **Root Cause:** `.btn.danger` used the warning colour token. The shared Paper and Sea `--danger` tokens were also below 4.5:1 on their surfaces.
- **Invariant:** `.btn.danger` uses `--danger`. In `shared/house/house-theme.css`, Paper `--danger` is `#A33C27` and Sea `--muted`/`--danger` are `#4B6066`/`#A33C27` (all ≥ 4.5:1 on their surfaces).
- **Test:** B13 (axe, serious/critical colour-contrast, all 4 themes).
- **Location:** `caro/src/style.css` → `.btn.danger`; `shared/house/house-theme.css` (`giay`, `bien`). Also rebuilt in chess and chinese-chess.

### [ISSUE-008] Unnamed settings switches and aria-label on plain divs (axe critical)
- **Symptom:** Screen readers announced unnamed checkboxes in Settings and the new-game dialog. The board and move list had `aria-label` on a `div` with no role.
- **Root Cause:** Switch inputs had no accessible name; `.lbl` text was not linked to them. Board and move list had no role.
- **Invariant:** Every `label.switch input` is named by the `.lbl` text of its row (`labelSwitches`). `#canvas-host` has `role="application"`, `#movelist` has `role="region"`.
- **Test:** B13 (axe).
- **Location:** `src/ui.js` → `labelSwitches`, `openSettings`, `openNewGame`; `src/i18n.js` → `applyI18n`; `src/index.html` → `#canvas-host`, `#movelist`.

### [ISSUE-009] Undo was not saved: a reload brought back the undone moves
- **Symptom:** In a game against the computer, after Undo and a page reload the undone stones came back.
- **Root Cause:** `undo()` changed the board but did not call `autosave()`, so `caro_current` kept the old moves. An undo to zero moves also left the old save in place (`autosave()` only wrote when moves existed).
- **Invariant:** Every undo re-saves the game; a playing game with no moves removes `caro_current`.
- **Test:** caro.spec.mjs D1 (reads `caro_current` after U).
- **Location:** `src/game.js` → `undo()`, `autosave()`.
