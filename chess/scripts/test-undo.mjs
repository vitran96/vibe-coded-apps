import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ChessRules = require('../src/rules.js');

console.log('Running Chess Undo Unit Tests...');

function canUndoGame(game, isAIThinking) {
  if (!game || game.isReplay || !game.allowUndo) return false;
  if (game.mode === 'pvp') {
    return game.moves.length > 0;
  }
  if (isAIThinking) {
    return game.humanSide === 'b' ? game.moves.length >= 2 : game.moves.length >= 1;
  }
  return game.moves.length >= 2;
}

function applyUndo(game, isAIThinking) {
  if (!canUndoGame(game, isAIThinking)) return false;

  if (game.mode === 'pve') {
    if (isAIThinking) {
      game.moves.pop();
    } else {
      game.moves.pop(); // bot move
      if (game.moves.length > 0) game.moves.pop(); // human move
    }
  } else {
    game.moves.pop();
  }

  game.state = ChessRules.fromFEN(game.startFEN);
  for (const m of game.moves) {
    const realM = ChessRules.fromUCI(game.state, m.uci);
    if (realM) game.state = ChessRules.make(game.state, realM);
  }
  return true;
}

// 1. PvP undo (single-ply)
{
  const start = ChessRules.initial();
  const game = {
    mode: 'pvp',
    allowUndo: true,
    startFEN: ChessRules.toFEN(start),
    state: start,
    moves: [{ uci: 'e2e4' }],
  };
  assert.strictEqual(canUndoGame(game, false), true);
  applyUndo(game, false);
  assert.strictEqual(game.moves.length, 0);
  assert.strictEqual(game.state.turn, 1, 'Turn returns to White after undo');
}

// 2. PvE undo with Human White (undoes both bot and human moves)
{
  const start = ChessRules.initial();
  const game = {
    mode: 'pve',
    humanSide: 'w',
    allowUndo: true,
    startFEN: ChessRules.toFEN(start),
    state: start,
    moves: [{ uci: 'e2e4' }, { uci: 'e7e5' }],
  };
  assert.strictEqual(canUndoGame(game, false), true);
  applyUndo(game, false);
  assert.strictEqual(game.moves.length, 0, 'Both human and bot moves removed');
  assert.strictEqual(game.state.turn, 1, 'Turn returns to White (Human)');
}

// 3. PvE undo with Human Black
{
  const start = ChessRules.initial();
  const game = {
    mode: 'pve',
    humanSide: 'b',
    allowUndo: true,
    startFEN: ChessRules.toFEN(start),
    state: start,
    moves: [{ uci: 'e2e4' }],
  };
  // Before Black makes any move, human cannot undo
  assert.strictEqual(canUndoGame(game, false), false, 'Cannot undo before human black moved');

  // Human Black plays e7e5, Bot plays g1f3
  game.moves.push({ uci: 'e7e5' }, { uci: 'g1f3' });
  assert.strictEqual(canUndoGame(game, false), true);
  applyUndo(game, false);
  assert.strictEqual(game.moves.length, 1, 'Reverted to only bot opening move');
  assert.strictEqual(game.moves[0].uci, 'e2e4');
  assert.strictEqual(game.state.turn, -1, 'Turn returns to Black (Human)');
}

// 4. Undo while AI is thinking in PvE
{
  const start = ChessRules.initial();
  const game = {
    mode: 'pve',
    humanSide: 'w',
    allowUndo: true,
    startFEN: ChessRules.toFEN(start),
    state: start,
    moves: [{ uci: 'e2e4' }],
  };
  assert.strictEqual(canUndoGame(game, true), true, 'Can undo while AI is thinking');
  applyUndo(game, true);
  assert.strictEqual(game.moves.length, 0, 'Human move reverted');
  assert.strictEqual(game.state.turn, 1);
}

// 5. Undo disabled
{
  const start = ChessRules.initial();
  const game = {
    mode: 'pvp',
    allowUndo: false,
    startFEN: ChessRules.toFEN(start),
    state: start,
    moves: [{ uci: 'e2e4' }],
  };
  assert.strictEqual(canUndoGame(game, false), false, 'Undo disallowed when allowUndo is false');
  const res = applyUndo(game, false);
  assert.strictEqual(res, false);
  assert.strictEqual(game.moves.length, 1);
}

console.log('All Undo Unit Tests passed successfully!');
