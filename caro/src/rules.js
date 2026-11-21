'use strict';
// 03 rules engine (pure — also copied into the AI worker)
// ============================================================
function checkWin(board, N, x, y, player, rules) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const cellEnd = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 'edge' : board[j * N + i] === 0 ? 'empty' : 'opp';
  for (const [dx, dy] of dirs) {
    const line = [[x, y]];
    let i = x + dx, j = y + dy;
    while (i >= 0 && j >= 0 && i < N && j < N && board[j * N + i] === player) { line.push([i, j]); i += dx; j += dy; }
    const endA = cellEnd(i, j);
    i = x - dx; j = y - dy;
    while (i >= 0 && j >= 0 && i < N && j < N && board[j * N + i] === player) { line.unshift([i, j]); i -= dx; j -= dy; }
    const endB = cellEnd(i, j);
    if (line.length < 5) continue;
    if (rules.mode === 'caro') {
      const blocked = e => e === 'opp' || (e === 'edge' && rules.edgeBlocks);
      if (blocked(endA) && blocked(endB)) continue;
    } else if (rules.exactFive && line.length !== 5) continue;
    return { line, reason: 'five' };
  }
  return null;
}

function isDraw(board, N) {
  for (let i = 0; i < N * N; i++) if (board[i] === 0) return false;
  return true;
}

// ============================================================
