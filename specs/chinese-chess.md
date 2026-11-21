---
id: chinese-chess
app: chinese-chess
status: implemented
version-introduced: 2.2.0
---

# Chinese Chess (Cờ Tướng, Xiangqi)

## Goal

Xiangqi against the computer or a second person on the same device, with 3D pieces, a move list, undo control, saved and replayable games, and full keyboard play.

## Requirements

- R1 Two modes: vs computer (levels easy, medium, hard; play as red, black or random) and two players.
- R2 Move by keyboard with a board cursor; the computer's reply is announced in the live region as "Đen: ..." (black move text).
- R3 Built-in opening book is used by the computer in the opening (`book.js`).
- R4 Undo: each click reverts one ply in two-player mode, and one computer move plus one human move in vs computer. Undo can be turned off in the New Game menu or Settings; when off, Undo does not revert and a toast says why.
- R5 Optional clocks: off (default), per move, or per game with increment.
- R6 Side panel shows a scrollable move list and rectangular action buttons with visible text (resign, undo, new game, and similar).
- R7 Resign shows a translated reason; the result sheet shows the outcome in the current language.
- R8 There is no flip-board button and no draw offer. The `f` key does nothing.
- R9 Finished and forfeited games can be replayed (interactive replay) and past matches are recorded move by move while playing.
- R10 Pieces are 3D (Three.js); each piece faces the player on its own half of the board (position-based orientation, ISSUE-014).
- R11 Storage prefix `cotuong_`; legacy `co-tuong:` keys read; the old `cotuong_prefs` migrates into `house:prefs`.
- R12 Defaults: theme `giay`, language `vi`, sound effects on, music off.

## Out of scope

- Draw offers, flip button (removed on purpose), online play.
- Engine strength targets beyond the three levels: TBD.

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | e2e D0 (keyboard game and resign) | e2e |
| R2 | e2e A5 (computer reply announced "Đen:") | e2e |
| R3 | `node chinese-chess/scripts/run-rules-tests.mjs` (book lines); manual: opening play | unit, manual |
| R4 | e2e D10 (undo off tells the player); two-ply undo: `run-rules-tests.mjs` and manual | e2e, unit |
| R5 | TBD (no e2e yet); manual: set per-move clock | manual |
| R6 | e2e D10 (move list fills after a ply; visible text on buttons) | e2e |
| R7 | e2e D9 (resign reason translated) | e2e |
| R8 | e2e D8 (no flip, no draw offer, no `f` shortcut) | e2e |
| R9 | FIXED_ISSUES #007, #008; manual: replay a finished game | manual |
| R10 | FIXED_ISSUES #014; manual: visual check at both halves | manual |
| R11 | e2e D7 (legacy resume, prefs migration) | e2e |
| R12 | e2e B12 (defaults) | e2e |

Extra tests run by hand: `node chinese-chess/scripts/run-rules-tests.mjs` (25 rules tests) and `node chinese-chess/scripts/selfplay.mjs`.

## Notes

- Code: `chinese-chess/src/` (`rules.js`, `engine.js`, `book.js`, `render.js`, `main.js`, `storage.js`). Built file: `chinese-chess/index.html`.
- Past bugs and their invariants: `chinese-chess/FIXED_ISSUES.md` (19 entries). It has no `AGENTS.md`.
