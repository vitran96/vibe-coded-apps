// engine.js — AI evaluation and search engine for Cờ Tướng (Xiangqi)
function defineEngine(XQ) {
  const { K, A, E, H, R, C, P } = XQ.PIECES;

  // Base piece values (centipawns)
  const PIECE_VAL = {
    [K]: 10000,
    [R]: 900,
    [C]: 450,
    [H]: 400,
    [A]: 200,
    [E]: 200,
    [P]: 100,
  };

  // Piece-Square Tables (from Red's perspective, ranks 0..9, files 0..8)
  // Ranks 0..9: 0 is back rank, 9 is enemy back rank.
  const PST_R = [
    [14, 14, 12, 18, 16, 18, 12, 14, 14],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [12, 12, 12, 18, 18, 18, 12, 12, 12],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [14, 16, 14, 20, 20, 20, 14, 16, 14],
    [16, 18, 16, 22, 24, 22, 16, 18, 16],
    [18, 22, 20, 26, 28, 26, 20, 22, 18],
    [18, 24, 22, 28, 30, 28, 22, 24, 18],
    [20, 26, 24, 30, 32, 30, 24, 26, 20],
    [20, 26, 24, 30, 32, 30, 24, 26, 20],
  ].flat();

  const PST_H = [
    [ 4,  8, 16, 12,  4, 12, 16,  8,  4],
    [ 4, 10, 28, 16,  8, 16, 28, 10,  4],
    [12, 14, 18, 20, 16, 20, 18, 14, 12],
    [ 8, 24, 18, 24, 20, 24, 18, 24,  8],
    [ 6, 16, 14, 18, 16, 18, 14, 16,  6],
    [10, 26, 20, 28, 22, 28, 20, 26, 10],
    [12, 24, 22, 26, 24, 26, 22, 24, 12],
    [14, 28, 24, 28, 26, 28, 24, 28, 14],
    [ 4, 12, 16, 14,  4, 14, 16, 12,  4],
    [ 2,  4,  8,  6,  2,  6,  8,  4,  2],
  ].flat();

  const PST_C = [
    [ 6,  4,  0, -10, -12, -10,  0,  4,  6],
    [ 2,  2,  0,  -4, -14,  -4,  0,  2,  2],
    [ 2,  2,  0, -10,  -8, -10,  0,  2,  2],
    [ 0,  0, -2,   4,  10,   4, -2,  0,  0],
    [ 0,  0,  0,   2,   8,   2,  0,  0,  0],
    [-2,  0,  4,   0,  10,   0,  4,  0, -2],
    [ 0,  0,  0,   2,   8,   2,  0,  0,  0],
    [ 2, 10,  4,   6,  12,   6,  4, 10,  2],
    [ 2,  4,  4,   4,  -2,   4,  4,  4,  2],
    [ 0,  0,  2,   6,   6,   6,  2,  0,  0],
  ].flat();

  const PST_P = [
    [ 0,  0,  0,   0,   0,   0,  0,  0,  0],
    [ 0,  0,  0,   0,   0,   0,  0,  0,  0],
    [ 0,  0,  0,  -2,   4,  -2,  0,  0,  0],
    [ 0,  0,  0,   0,   0,   0,  0,  0,  0],
    [ 0,  0,  0,  -2,   4,  -2,  0,  0,  0],
    [10, 18, 22,  35,  40,  35, 22, 18, 10],
    [20, 28, 34,  45,  50,  45, 34, 28, 20],
    [30, 38, 44,  55,  60,  55, 44, 38, 30],
    [35, 40, 45,  55,  60,  55, 45, 40, 35],
    [15, 20, 25,  30,  35,  30, 25, 20, 15],
  ].flat();

  function getPst(type, sq, side) {
    // If Black (side === -1), mirror vertically: rank -> 9 - rank
    const r = Math.floor(sq / 9);
    const f = sq % 9;
    const effSq = side === 1 ? sq : ((9 - r) * 9 + f);
    switch (type) {
      case R: return PST_R[effSq];
      case H: return PST_H[effSq];
      case C: return PST_C[effSq];
      case P: return PST_P[effSq];
      default: return 0;
    }
  }

  // Transposition table
  const TT_SIZE = 1 << 18; // 262,144 entries
  const TT_MASK = TT_SIZE - 1;
  const TT_KEY_LO = new Uint32Array(TT_SIZE);
  const TT_KEY_HI = new Uint32Array(TT_SIZE);
  const TT_DEPTH = new Int8Array(TT_SIZE);
  const TT_FLAG = new Uint8Array(TT_SIZE); // 1 = EXACT, 2 = LOWER, 3 = UPPER
  const TT_SCORE = new Int16Array(TT_SIZE);
  const TT_MOVE = new Int32Array(TT_SIZE);

  function clearTT() {
    TT_KEY_LO.fill(0);
    TT_KEY_HI.fill(0);
    TT_DEPTH.fill(0);
    TT_FLAG.fill(0);
    TT_SCORE.fill(0);
    TT_MOVE.fill(0);
  }

  // Killer moves and history heuristic
  const KILLERS = Array.from({ length: 32 }, () => new Int32Array(2));
  const HISTORY = new Int32Array(90 * 90);

  function evaluate(pos) {
    const b = pos.board;
    let score = 0;
    let nonPawnRed = 0, nonPawnBlack = 0;

    let redAdvisors = 0, redElephants = 0;
    let blackAdvisors = 0, blackElephants = 0;

    for (let sq = 0; sq < 90; sq++) {
      const p = b[sq];
      if (p === 0) continue;
      const type = Math.abs(p);
      const side = p > 0 ? 1 : -1;

      let val = PIECE_VAL[type] || 0;
      if (type === R || type === H || type === C) {
        if (side === 1) nonPawnRed += val;
        else nonPawnBlack += val;
      }
      if (type === A) {
        if (side === 1) redAdvisors++; else blackAdvisors++;
      }
      if (type === E) {
        if (side === 1) redElephants++; else blackElephants++;
      }

      val += getPst(type, sq, side);

      if (type === P) {
        const r = Math.floor(sq / 9);
        const crossed = side === 1 ? (r >= 5) : (r <= 4);
        if (crossed) val += 100; // crossed river bonus
        if ((side === 1 && r === 9) || (side === -1 && r === 0)) val -= 50; // edge reduction on last rank
      }

      score += (side * val);
    }

    // Dynamic Endgame adjustments: Cannons decrease slightly, Horses increase slightly
    const totalNonPawn = nonPawnRed + nonPawnBlack;
    const isEndgame = totalNonPawn < 2400;
    if (isEndgame) {
      // Small penalty if missing guards when opponent has strong attackers
      if (nonPawnBlack > 1000) {
        score -= (2 - redAdvisors) * 30;
        score -= (2 - redElephants) * 20;
      }
      if (nonPawnRed > 1000) {
        score += (2 - blackAdvisors) * 30;
        score += (2 - blackElephants) * 20;
      }
    }

    // Perspective score: positive means good for pos.side
    return pos.side * score;
  }

  XQ.evaluate = evaluate;

  const MATE_SCORE = 20000;

  // Move scoring for ordering
  function scoreMove(pos, m, ttMove, ply) {
    if (m === ttMove) return 1000000;
    const from = (m >> 7) & 0x7F;
    const to = m & 0x7F;
    const mover = Math.abs(pos.board[from]);
    const captured = Math.abs(pos.board[to]);

    if (captured !== 0) {
      // MVV-LVA
      return 100000 + (PIECE_VAL[captured] || 0) * 10 - (PIECE_VAL[mover] || 0);
    }
    if (ply < 32) {
      if (KILLERS[ply][0] === m) return 90000;
      if (KILLERS[ply][1] === m) return 80000;
    }
    return HISTORY[from * 90 + to] || 0;
  }

  function quiescence(pos, alpha, beta, ply, nodes) {
    nodes.count++;
    const inChk = XQ.inCheck(pos, pos.side);

    if (!inChk) {
      const standPat = evaluate(pos);
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    }

    const moves = XQ.legalMoves(pos);
    if (moves.length === 0) {
      return inChk ? (-MATE_SCORE + ply) : 0;
    }

    // Generate moves: if in check, all moves; else captures only
    const candidates = [];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const to = m & 0x7F;
      if (inChk || pos.board[to] !== 0) {
        candidates.push({ m, score: scoreMove(pos, m, 0, ply) });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    for (let i = 0; i < candidates.length; i++) {
      const m = candidates[i].m;
      const undo = XQ.makeMove(pos, m);
      const score = -quiescence(pos, -beta, -alpha, ply + 1, nodes);
      XQ.unmakeMove(pos, m, undo);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  function searchRoot(pos, options = {}) {
    const level = options.level || 'medium';
    const timeBudget = options.timeBudget || 1000;
    const historyHashes = options.historyHashes || [];
    const movesHistory = options.movesHistory || [];
    const startTime = Date.now();
    const hardDeadline = startTime + Math.min(1300, Math.floor(timeBudget * 1.3));

    // 1. Opening book check for Hard mode
    if (level === 'hard' && XQ.getBookMove) {
      const bookIccs = XQ.getBookMove(movesHistory);
      if (bookIccs) {
        const bookM = XQ.iccsToMove(bookIccs);
        const legal = XQ.legalMoves(pos);
        if (legal.includes(bookM)) {
          return {
            move: bookIccs,
            moveInt: bookM,
            score: 0,
            depth: 1,
            nodes: 1,
            book: true
          };
        }
      }
    }

    const legal = XQ.legalMoves(pos);
    if (legal.length === 0) {
      return { move: null, moveInt: 0, score: 0, depth: 0, nodes: 0 };
    }
    if (legal.length === 1) {
      return {
        move: XQ.moveToIccs(legal[0]),
        moveInt: legal[0],
        score: evaluate(pos),
        depth: 1,
        nodes: 1
      };
    }

    // Filter root moves to avoid perpetual check loss
    function wouldCausePerpetualLoss(m) {
      if (!options.rules || !options.rules.perpetual) return false;
      const undo = XQ.makeMove(pos, m);
      const curLo = pos.hashLo, curHi = pos.hashHi, curSide = pos.side;
      let count = 1;
      for (let i = historyHashes.length - 1; i >= 0; i--) {
        const h = historyHashes[i];
        if (h.hashLo === curLo && h.hashHi === curHi && h.side === curSide) {
          count++;
          if (count >= 3) break;
        }
      }
      const inChk = XQ.inCheck(pos, pos.side);
      XQ.unmakeMove(pos, m, undo);
      return count >= 3 && inChk;
    }

    const nodes = { count: 0 };
    let bestMove = legal[0];
    let bestScore = -MATE_SCORE;

    // Easy mode
    if (level === 'easy') {
      const scored = [];
      for (const m of legal) {
        const undo = XQ.makeMove(pos, m);
        let s = -quiescence(pos, -30000, 30000, 1, nodes);
        XQ.unmakeMove(pos, m, undo);
        // Add ±120 cp noise
        s += (Math.random() * 240 - 120);
        scored.push({ m, s });
      }
      scored.sort((a, b) => b.s - a.s);

      // 20% random choice among top moves
      if (Math.random() < 0.20 && scored.length > 1) {
        const pick = scored[Math.floor(Math.random() * Math.min(3, scored.length))];
        bestMove = pick.m;
        bestScore = pick.s;
      } else {
        bestMove = scored[0].m;
        bestScore = scored[0].s;
      }

      return {
        move: XQ.moveToIccs(bestMove),
        moveInt: bestMove,
        score: Math.round(bestScore),
        depth: 1,
        nodes: nodes.count
      };
    }

    // Medium mode: fixed depth 2 + quiescence
    if (level === 'medium') {
      const scored = [];
      for (const m of legal) {
        const undo = XQ.makeMove(pos, m);
        let s = -negamax(pos, 1, -30000, 30000, 1, true, nodes, hardDeadline);
        XQ.unmakeMove(pos, m, undo);
        scored.push({ m, s });
      }
      scored.sort((a, b) => b.s - a.s);

      // Random tie-break among moves within 10 cp of best
      const topScore = scored[0].s;
      const topCandidates = scored.filter(item => Math.abs(item.s - topScore) <= 10);
      const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];

      return {
        move: XQ.moveToIccs(chosen.m),
        moveInt: chosen.m,
        score: chosen.s,
        depth: 2,
        nodes: nodes.count
      };
    }

    // Hard mode: Iterative deepening with alpha-beta + PVS + TT
    let maxDepth = 12;
    clearTT();
    let currentDepth = 1;

    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -MATE_SCORE;
      let beta = MATE_SCORE;
      let depthBestMove = bestMove;
      let depthBestScore = -MATE_SCORE;
      let timedOut = false;

      // Root move sorting
      const rootCandidates = legal.map(m => ({
        m,
        score: (m === bestMove ? 2000000 : scoreMove(pos, m, bestMove, 0)) - (wouldCausePerpetualLoss(m) ? 500000 : 0)
      })).sort((a, b) => b.score - a.score);

      for (let i = 0; i < rootCandidates.length; i++) {
        const m = rootCandidates[i].m;
        const undo = XQ.makeMove(pos, m);
        let score;

        if (i === 0) {
          score = -negamax(pos, depth - 1, -beta, -alpha, 1, true, nodes, hardDeadline);
        } else {
          // PVS
          score = -negamax(pos, depth - 1, -alpha - 1, -alpha, 1, true, nodes, hardDeadline);
          if (score > alpha && score < beta) {
            score = -negamax(pos, depth - 1, -beta, -alpha, 1, true, nodes, hardDeadline);
          }
        }

        XQ.unmakeMove(pos, m, undo);

        if (Date.now() >= hardDeadline) {
          timedOut = true;
          break;
        }

        if (score > depthBestScore) {
          depthBestScore = score;
          depthBestMove = m;
        }
        if (score > alpha) {
          alpha = score;
        }
      }

      if (timedOut) break;

      bestMove = depthBestMove;
      bestScore = depthBestScore;
      currentDepth = depth;

      // If mate found or time budget > 55% used, finish
      if (Math.abs(bestScore) >= MATE_SCORE - 20) break;
      const elapsed = Date.now() - startTime;
      if (elapsed > timeBudget * 0.55) break;
    }

    return {
      move: XQ.moveToIccs(bestMove),
      moveInt: bestMove,
      score: bestScore,
      depth: currentDepth,
      nodes: nodes.count
    };
  }

  function negamax(pos, depth, alpha, beta, ply, allowNull, nodes, hardDeadline) {
    if ((nodes.count & 2047) === 0 && Date.now() >= hardDeadline) {
      return 0;
    }
    nodes.count++;

    const inChk = XQ.inCheck(pos, pos.side);
    if (inChk) depth++; // Check extension

    if (depth <= 0) {
      return quiescence(pos, alpha, beta, ply, nodes);
    }

    // TT lookup
    const ttIndex = pos.hashLo & TT_MASK;
    let ttMove = 0;
    if (TT_KEY_LO[ttIndex] === pos.hashLo && TT_KEY_HI[ttIndex] === pos.hashHi) {
      ttMove = TT_MOVE[ttIndex];
      if (TT_DEPTH[ttIndex] >= depth) {
        const flag = TT_FLAG[ttIndex];
        const ttScore = TT_SCORE[ttIndex];
        if (flag === 1) return ttScore; // EXACT
        if (flag === 2 && ttScore >= beta) return beta; // LOWER
        if (flag === 3 && ttScore <= alpha) return alpha; // UPPER
      }
    }

    // Null move pruning
    if (allowNull && !inChk && depth >= 3) {
      const b = pos.board;
      let majorCount = 0;
      for (let sq = 0; sq < 90; sq++) {
        const p = b[sq];
        if (p !== 0 && (p > 0 ? 1 : -1) === pos.side) {
          const t = Math.abs(p);
          if (t === R || t === C || t === H) majorCount++;
        }
      }
      if (majorCount >= 2) {
        pos.side = -pos.side;
        pos.hashLo ^= 0x55AA55AA;
        const nullScore = -negamax(pos, depth - 1 - 2, -beta, -beta + 1, ply + 1, false, nodes, hardDeadline);
        pos.side = -pos.side;
        pos.hashLo ^= 0x55AA55AA;
        if (nullScore >= beta) return beta;
      }
    }

    const moves = XQ.legalMoves(pos);
    if (moves.length === 0) {
      return inChk ? (-MATE_SCORE + ply) : 0;
    }

    const scored = moves.map(m => ({ m, score: scoreMove(pos, m, ttMove, ply) }))
      .sort((a, b) => b.score - a.score);

    let bestScore = -MATE_SCORE;
    let localBestMove = moves[0];
    const origAlpha = alpha;

    for (let i = 0; i < scored.length; i++) {
      const m = scored[i].m;
      const undo = XQ.makeMove(pos, m);
      let score;

      if (i === 0) {
        score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, true, nodes, hardDeadline);
      } else {
        score = -negamax(pos, depth - 1, -alpha - 1, -alpha, ply + 1, true, nodes, hardDeadline);
        if (score > alpha && score < beta) {
          score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, true, nodes, hardDeadline);
        }
      }

      XQ.unmakeMove(pos, m, undo);

      if (score > bestScore) {
        bestScore = score;
        localBestMove = m;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (alpha >= beta) {
        // Killer and history recording
        const from = (m >> 7) & 0x7F, to = m & 0x7F;
        if (pos.board[to] === 0 && ply < 32) {
          KILLERS[ply][1] = KILLERS[ply][0];
          KILLERS[ply][0] = m;
          HISTORY[from * 90 + to] += depth * depth;
        }
        break;
      }
    }

    // Save TT
    TT_KEY_LO[ttIndex] = pos.hashLo;
    TT_KEY_HI[ttIndex] = pos.hashHi;
    TT_DEPTH[ttIndex] = depth;
    TT_SCORE[ttIndex] = bestScore;
    TT_MOVE[ttIndex] = localBestMove;
    if (bestScore <= origAlpha) TT_FLAG[ttIndex] = 3; // UPPER
    else if (bestScore >= beta) TT_FLAG[ttIndex] = 2; // LOWER
    else TT_FLAG[ttIndex] = 1; // EXACT

    return bestScore;
  }

  XQ.searchRoot = searchRoot;
}

if (typeof window !== 'undefined') {
  window.XQ = window.XQ || {};
  defineEngine(window.XQ);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defineEngine;
}
