---
id: caro
app: caro
status: implemented
version-introduced: 2.2.0
---

# Caro & Gomoku (Cờ Caro)

## Goal

Five-in-a-row on a 30x30 board, against the computer or a second person on the same device, playable by keyboard, mouse and touch, with saved games and records.

## Requirements

- R1 Two modes: vs computer (`pve`, difficulty easy, medium or hard) and two players (`pvp`).
- R2 Rules: `gomoku` (free five) or `caro` (a five blocked at an open end does not count); options `exactFive` and `edgeBlocks`.
- R3 Board is 30x30 (`BOARD_SIZES = [30]`); the camera pans only when a stone lands within 1.2 cells of the edge, by `2 x cell` (KNOWN ISSUE-001 invariant).
- R4 Undo: vs computer reverts 2 plies, two players reverts 1 ply; undo can be turned off in settings and then says why.
- R5 Optional turn timer (off by default), presets 5 to 300 seconds; on timeout the player loses or the turn is skipped (setting).
- R6 Current game is saved after every move and survives reload, including after undo (ISSUE-009).
- R7 Results are recorded (max 200), can be replayed step by step, exported and imported as a file, and cleared.
- R8 Defaults: music off, sound effects on, timer off, theme `giay`, language `vi`.
- R9 Placing a stone by keyboard (Enter/Space on the board cursor) or by pointer tap gives the same result.
- R10 Legacy saves still load: 1.0.0 `caro.` keys, 1.1.0 saves in vi and en.
- R11 Settings include a "confirm before placing" mode (`tapConfirm`: auto, always, never).
- R12 Shortcuts N (new game), H (history), S (settings), ? (how to play), M (sound) work when no sheet is open.
- R13 Storage keys use `caro_` plus `settings`, `current`, `records`, `iosHint`; objects carry `v: 1`.
- R14 The board is drawn with Three.js; the page works with no network after load.

## Out of scope

- Online play, accounts, AI difficulty beyond the three levels.
- Sound-only or colour-only win signals (must stay readable without colour).

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | e2e D0 (keyboard game vs computer), D2 (PvP five) | e2e |
| R2 | `node caro/scripts/test-caro.mjs` (rules), e2e D2 | unit, e2e |
| R3 | e2e D4 camera pans only near edge; ISSUE-001 | e2e |
| R4 | e2e D1 (2 plies); two-player 1-ply undo and the "undo off" message: manual | e2e, manual |
| R5 | TBD (no e2e yet); manual: set 5 s timer and wait | manual |
| R6 | e2e D1 (save after undo) | e2e |
| R7 | e2e D3 (legacy saves load, one record); history export/import: manual | e2e, manual |
| R8 | e2e B12 (defaults), B3 (forced light) | e2e |
| R9 | e2e D0 (keyboard), D12 (pointer tap) | e2e |
| R10 | e2e D3 (1.1.0 vi, 1.1.0 en, 1.0.0 `caro.`) | e2e |
| R11 | TBD (no e2e yet); manual: change setting, tap a cell | manual |
| R12 | e2e B7 (N H S ? M shortcuts) | e2e |
| R13 | `node caro/scripts/test-save.mjs`; `check.mjs` storage prefix | unit |
| R14 | e2e A1 (zero external requests, boot) | e2e |

## Notes

- Code: `caro/src/` (`rules.js`, `ai-engine.js`, `game.js`, `renderer.js`, `storage.js`). Built file: `caro/index.html`.
- Invariants and past bugs: `caro/FIXED_ISSUES.md`. `caro/AGENTS.md` lists the same invariants.
- Spa music default is off (AGENTS rule 4).
