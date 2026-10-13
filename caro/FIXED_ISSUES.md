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
- **Location:** `index.html` → `BoardRenderer.ensureVisible()`.

---

### [ISSUE-002] PvE Bot Undo Reverting Only 1 Move
- **Symptom:** In vs-AI (PvE) games, pressing Undo removed only the AI's move, leaving the turn stuck on the AI or causing the AI to instantly replay.
- **Root Cause:** `undo()` unconditionally popped exactly 1 move regardless of game mode.
- **Invariant:**
  - When playing against AI (`session.mode === 'pve' && session.ai`), Undo **must revert 2 moves** (the bot move and the human move), returning the turn to the human.
  - When playing 2 players / pass-and-play (`pvp`), Undo reverts **1 move**.
- **Location:** `index.html` → `GameController.undo()`.

---

### [ISSUE-003] Local Storage Key Prefix Standard
- **Symptom:** Storage keys were formatted with dot notation (`caro.settings`, `caro.records`), inconsistent with the `caro_` namespace prefix.
- **Root Cause:** `LS` constant used legacy dot syntax.
- **Invariant:**
  - All LocalStorage keys must strictly start with prefix `caro_` (`caro_settings`, `caro_current`, `caro_records`, `caro_iosHint`).
  - `Store.read()` maintains backward-compatible fallback for legacy `caro.` keys to prevent player data loss.
- **Test:** Unit test in `runTests()` verifies all `LS` values start with `caro_`.
- **Location:** `index.html` → `LS` constant, `Store` object, `runTests()`.
