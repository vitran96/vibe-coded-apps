---
id: chess
app: chess
status: implemented
version-introduced: 2.2.0
---

# Chess (Cờ vua)

## Goal

Standard chess against the computer or a second person on the same device, playable by keyboard alone, with the board readable by screen readers.

## Requirements

- R1 Two modes: vs computer (levels easy, medium, hard; computer side opposite the human) and two players.
- R2 Move by keyboard: the board cursor moves with arrow keys; Enter selects a square, then the destination; a move the rules do not allow is refused.
- R3 Resign is available from the keyboard; the result (win, draw, resign) is announced and the game is recorded.
- R4 Undo: vs computer reverts 2 plies (computer and human) so the human is on turn; two players reverts 1 ply. Undo is off during the computer's turn.
- R5 Undo is a setting (`allowUndo`, default on); when off, Undo does nothing and says why. There is no flip-board button.
- R6 Optional clocks: off (default), per move, or per game with increment. Low-time warning under 10 seconds.
- R7 Board text (`#board-text`) describes the position for screen readers; `aria-live` announces each result.
- R8 Pointer tap on a square makes the same move as the keyboard.
- R9 Saved game resumes after reload; legacy `chess:` keys still read; new writes go to `covua_`.
- R10 Defaults: sound effects on, theme `giay`, language `vi`.

## Out of scope

- Online play, rating, opening book, engine analysis lines (TBD if wanted).
- Board flip button (removed on purpose).

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | e2e A5 (computer answers a human move); TBD for hard level | e2e |
| R2 | e2e D0 (cursor, Enter moves, resign by keyboard) | e2e |
| R3 | e2e D0 (result announced, record kept) | e2e |
| R4 | e2e D1 (two plies, turn back to human) | e2e |
| R5 | e2e D6 (undo is a setting; off means no undo) | e2e |
| R6 | TBD (no e2e); manual: set per-move clock and wait | manual |
| R7 | e2e D0 `#board-text` and announcements; `check.mjs` a11y smoke | e2e, unit |
| R8 | e2e D12 (pointer tap equals keyboard) | e2e |
| R9 | e2e D5 (legacy resume, writes to `covua_`) | e2e |
| R10 | `node chess/scripts/test-house.mjs`; e2e B12 | unit, e2e |

Extra tests run by hand: `cd chess && node scripts/perft.mjs` (move generation), `node scripts/test-rules.mjs`, `node scripts/test-undo.mjs`, `node scripts/check-contrast.mjs`.

## Notes

- Code: `chess/src/` (`rules.js`, `ai.js`, `main.js`, `i18n.js`, `rulesdocs.js`). Built file: `chess/index.html`.
- No `.claude/rules/chess.md` or `FIXED_ISSUES.md` yet; TBD if past bugs need logging.
- Storage prefix `covua_` (legacy `chess:`).
