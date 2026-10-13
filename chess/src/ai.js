// Chess AI Engine: Evaluation, Minimax / Alpha-Beta search, Opening book, Worker dispatcher
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const inst = factory(require('./rules.js'));
    inst.factory = factory;
    module.exports = inst;
  } else {
    root.ChessAI = factory(root.ChessRules);
    root.ChessAI.factory = factory; // used to build the AI worker source
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ChessRules) {
  'use strict';

  const PIECE_VALS = { 1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 20000 };

  // PST (Piece-Square Tables) - values oriented for White (rank 0 = rank 1)
  // [Rank 0 to 7, a to h]
  const PAWN_PST_MG = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0
  ];
  const PAWN_PST_EG = [
     0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,
    10, 10, 10, 10, 10, 10, 10, 10,
    20, 20, 20, 20, 20, 20, 20, 20,
    30, 30, 30, 30, 30, 30, 30, 30,
    50, 50, 50, 50, 50, 50, 50, 50,
    80, 80, 80, 80, 80, 80, 80, 80,
     0,  0,  0,  0,  0,  0,  0,  0
  ];

  const KNIGHT_PST = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ];

  const BISHOP_PST = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ];

  const ROOK_PST = [
      0,  0,  0,  5,  5,  0,  0,  0,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      5, 10, 10, 10, 10, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
  ];

  const QUEEN_PST = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -10,  5,  5,  5,  5,  5,  0,-10,
      0,  0,  5,  5,  5,  5,  0, -5,
     -5,  0,  5,  5,  5,  5,  0, -5,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ];

  const KING_PST_MG = [
     20, 30, 10,  0,  0, 10, 30, 20,
     20, 20,  0,  0,  0,  0, 20, 20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30
  ];

  const KING_PST_EG = [
    -50,-30,-30,-30,-30,-30,-30,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50
  ];

  // Tiny Opening Book (SAN moves)
  const OPENING_BOOK = [
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], // Italian Game
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],  // Ruy Lopez
    ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4'],  // Sicilian
    ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'],   // French Defense
    ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],   // Queen's Gambit Declined
    ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'],  // King's Indian
    ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4'],  // Caro-Kann
    ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'c5'],  // London System
  ];

  function evaluate(state) {
    const b = state.board;
    let mgScore = 0;
    let egScore = 0;
    let phase = 0; // 0 = endgame, 24 = opening/middlegame

    let wBishops = 0, bBishops = 0;
    let wRookFiles = 0, bRookFiles = 0;
    let pawnFilesW = new Int8Array(8);
    let pawnFilesB = new Int8Array(8);

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p === 0) continue;
      const type = Math.abs(p);
      const isWhite = p > 0;
      const f = sq & 7;
      const r = sq >> 3;
      const pstSq = isWhite ? sq : ((7 - r) << 3) | f;

      const val = PIECE_VALS[type];
      const sign = isWhite ? 1 : -1;

      // Phase weighting
      if (type === ChessRules.N || type === ChessRules.B) phase += 1;
      else if (type === ChessRules.R) phase += 2;
      else if (type === ChessRules.Q) phase += 4;

      if (type === ChessRules.P) {
        if (isWhite) pawnFilesW[f]++;
        else pawnFilesB[f]++;
        const mg = val + PAWN_PST_MG[pstSq];
        const eg = val + PAWN_PST_EG[pstSq];
        mgScore += sign * mg;
        egScore += sign * eg;
      } else if (type === ChessRules.N) {
        const mg = val + KNIGHT_PST[pstSq];
        mgScore += sign * mg;
        egScore += sign * mg;
      } else if (type === ChessRules.B) {
        if (isWhite) wBishops++; else bBishops++;
        const mg = val + BISHOP_PST[pstSq];
        mgScore += sign * mg;
        egScore += sign * mg;
      } else if (type === ChessRules.R) {
        if (isWhite) wRookFiles |= (1 << f); else bRookFiles |= (1 << f);
        const mg = val + ROOK_PST[pstSq];
        mgScore += sign * mg;
        egScore += sign * mg;
      } else if (type === ChessRules.Q) {
        const mg = val + QUEEN_PST[pstSq];
        mgScore += sign * mg;
        egScore += sign * mg;
      } else if (type === ChessRules.K) {
        const mg = KING_PST_MG[pstSq];
        const eg = KING_PST_EG[pstSq];
        mgScore += sign * mg;
        egScore += sign * eg;
      }
    }

    // Bishop pair
    if (wBishops >= 2) { mgScore += 30; egScore += 30; }
    if (bBishops >= 2) { mgScore -= 30; egScore -= 30; }

    // Rooks on open/semi-open files
    for (let f = 0; f < 8; f++) {
      if (wRookFiles & (1 << f)) {
        if (pawnFilesW[f] === 0 && pawnFilesB[f] === 0) mgScore += 15;
        else if (pawnFilesW[f] === 0) mgScore += 8;
      }
      if (bRookFiles & (1 << f)) {
        if (pawnFilesW[f] === 0 && pawnFilesB[f] === 0) mgScore -= 15;
        else if (pawnFilesB[f] === 0) mgScore -= 8;
      }
      // Doubled pawns penalty
      if (pawnFilesW[f] > 1) { mgScore -= 15; egScore -= 15; }
      if (pawnFilesB[f] > 1) { mgScore += 15; egScore += 15; }
    }

    // Tapered score
    if (phase > 24) phase = 24;
    const score = Math.round((mgScore * phase + egScore * (24 - phase)) / 24);
    return state.turn === 1 ? score : -score;
  }

  // Transposition Table
  const TT_SIZE = 1 << 18; // 262,144 entries
  const ttKeys = new BigInt64Array(TT_SIZE);
  const ttDepths = new Int8Array(TT_SIZE);
  const ttFlags = new Int8Array(TT_SIZE); // 1 = EXACT, 2 = LOWER, 3 = UPPER
  const ttScores = new Int16Array(TT_SIZE);
  const ttMoves = new Int16Array(TT_SIZE); // packed (from << 6) | to

  function ttProbe(hash, depth, alpha, beta) {
    const idx = Number(hash & BigInt(TT_SIZE - 1));
    if (ttKeys[idx] === hash) {
      if (ttDepths[idx] >= depth) {
        const sc = ttScores[idx];
        const fl = ttFlags[idx];
        if (fl === 1) return { score: sc, move: ttMoves[idx] };
        if (fl === 2 && sc >= beta) return { score: sc, move: ttMoves[idx] };
        if (fl === 3 && sc <= alpha) return { score: sc, move: ttMoves[idx] };
      }
      return { score: null, move: ttMoves[idx] };
    }
    return { score: null, move: -1 };
  }

  function ttStore(hash, depth, score, flag, move) {
    const idx = Number(hash & BigInt(TT_SIZE - 1));
    ttKeys[idx] = hash;
    ttDepths[idx] = depth;
    ttScores[idx] = score;
    ttFlags[idx] = flag;
    if (move >= 0) ttMoves[idx] = move;
  }

  // Quiescence search
  function quiesce(state, alpha, beta, nodesObj) {
    nodesObj.count++;
    const standPat = evaluate(state);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = ChessRules.legalMoves(state).filter(m => (m.flags & ChessRules.FLAGS.CAPTURE) || (m.flags & ChessRules.FLAGS.PROMO));
    // Sort captures by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    moves.sort((a, b) => {
      const va = (PIECE_VALS[Math.abs(a.captured)] || 0) - (PIECE_VALS[Math.abs(a.piece)] || 0);
      const vb = (PIECE_VALS[Math.abs(b.captured)] || 0) - (PIECE_VALS[Math.abs(b.piece)] || 0);
      return vb - va;
    });

    const undo = {};
    for (let i = 0; i < moves.length; i++) {
      ChessRules.makeInPlace(state, moves[i], undo);
      const score = -quiesce(state, -beta, -alpha, nodesObj);
      ChessRules.unmake(state, moves[i], undo);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // Negamax with Alpha-Beta
  function negamax(state, depth, alpha, beta, isRoot, deadline, nodesObj) {
    if ((nodesObj.count & 2047) === 0 && performance.now() > deadline) {
      nodesObj.stopped = true;
      return 0;
    }

    nodesObj.count++;

    if (depth <= 0) {
      return quiesce(state, alpha, beta, nodesObj);
    }

    const tt = ttProbe(state.hash, depth, alpha, beta);
    if (!isRoot && tt.score !== null) {
      return tt.score;
    }

    const inChk = ChessRules.inCheck(state, state.turn);

    // Null-move pruning
    if (depth >= 3 && !inChk && !isRoot) {
      // Switch turn with null move
      state.turn = -state.turn;
      const prevEp = state.ep;
      state.ep = -1;
      const nmScore = -negamax(state, depth - 1 - 2, -beta, -beta + 1, false, deadline, nodesObj);
      state.ep = prevEp;
      state.turn = -state.turn;
      if (nodesObj.stopped) return 0;
      if (nmScore >= beta) return beta;
    }

    const moves = ChessRules.legalMoves(state);
    if (moves.length === 0) {
      return inChk ? (-20000 + (100 - depth)) : 0; // Checkmate or stalemate
    }

    // Move ordering
    const ttMoveVal = tt.move;
    moves.sort((a, b) => {
      const aPack = (a.from << 6) | a.to;
      const bPack = (b.from << 6) | b.to;
      if (aPack === ttMoveVal) return -100000;
      if (bPack === ttMoveVal) return 100000;
      const aScore = ((a.flags & ChessRules.FLAGS.CAPTURE) ? 1000 + (PIECE_VALS[Math.abs(a.captured)] || 0) : 0) + (a.promo ? 500 : 0);
      const bScore = ((b.flags & ChessRules.FLAGS.CAPTURE) ? 1000 + (PIECE_VALS[Math.abs(b.captured)] || 0) : 0) + (b.promo ? 500 : 0);
      return bScore - aScore;
    });

    let bestScore = -30000;
    let bestMove = -1;
    let origAlpha = alpha;
    const undo = {};

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      ChessRules.makeInPlace(state, m, undo);
      const score = -negamax(state, depth - 1, -beta, -alpha, false, deadline, nodesObj);
      ChessRules.unmake(state, m, undo);

      if (nodesObj.stopped) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = (m.from << 6) | m.to;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (alpha >= beta) {
        break; // Beta cutoff
      }
    }

    let flag = 1; // EXACT
    if (bestScore <= origAlpha) flag = 3; // UPPER
    else if (bestScore >= beta) flag = 2; // LOWER
    ttStore(state.hash, depth, bestScore, flag, bestMove);

    return bestScore;
  }

  // Easy AI
  function searchEasy(state) {
    const moves = ChessRules.legalMoves(state);
    if (moves.length === 0) return null;

    // Check if can mate in 1 (50% chance to play it)
    for (const m of moves) {
      const next = ChessRules.make(state, m);
      if (ChessRules.status(next).reason === 'checkmate' && Math.random() < 0.5) {
        return { uci: ChessRules.toUCI(m), eval: 9999, depth: 1, nodes: 1 };
      }
    }

    // Score all moves at depth 1 with noise
    const scored = moves.map((m) => {
      const next = ChessRules.make(state, m);
      let ev = -evaluate(next);
      ev += (Math.random() * 300 - 150); // +/- 150 noise
      // 25% of the time, ignore hanging own pieces
      return { move: m, score: ev };
    });

    scored.sort((a, b) => b.score - a.score);
    const bestScore = scored[0].score;
    const nearBest = scored.filter(s => s.score >= bestScore - 200);
    const pick = nearBest[Math.floor(Math.random() * nearBest.length)].move;

    return { uci: ChessRules.toUCI(pick), eval: Math.round(scored[0].score), depth: 1, nodes: moves.length };
  }

  // Medium AI
  function searchMedium(state, historyHashes = []) {
    const moves = ChessRules.legalMoves(state);
    if (moves.length === 0) return null;

    // Opening book check (first 6 plies)
    if (state.fullmove <= 3) {
      for (const line of OPENING_BOOK) {
        let sim = ChessRules.initial();
        let match = true;
        for (let i = 0; i < line.length; i++) {
          if (ChessRules.toFEN(sim) === ChessRules.toFEN(state)) {
            const bookMove = ChessRules.fromSAN(sim, line[i]);
            if (bookMove) {
              return { uci: ChessRules.toUCI(bookMove), eval: 0, depth: 2, nodes: 1 };
            }
          }
          const m = ChessRules.fromSAN(sim, line[i]);
          if (!m) { match = false; break; }
          sim = ChessRules.make(sim, m);
        }
      }
    }

    // Always play mate-in-1
    for (const m of moves) {
      const next = ChessRules.make(state, m);
      if (ChessRules.status(next).reason === 'checkmate') {
        return { uci: ChessRules.toUCI(m), eval: 10000, depth: 2, nodes: moves.length };
      }
    }

    // Depth 2 alpha-beta + capture quiescence
    const scored = [];
    const undo = {};
    const nodesObj = { count: 0, stopped: false };

    for (const m of moves) {
      ChessRules.makeInPlace(state, m, undo);

      // Check if opponent has mate-in-1
      let oppCanMate = false;
      const oppMoves = ChessRules.legalMoves(state);
      for (const om of oppMoves) {
        const afterOpp = ChessRules.make(state, om);
        if (ChessRules.status(afterOpp).reason === 'checkmate') {
          oppCanMate = true;
          break;
        }
      }

      let score = 0;
      if (oppCanMate) {
        score = -10000;
      } else {
        score = -quiesce(state, -30000, 30000, nodesObj);
      }

      ChessRules.unmake(state, m, undo);
      scored.push({ move: m, score: score + (Math.random() * 40 - 20) });
    }

    scored.sort((a, b) => b.score - a.score);
    const pick = scored[0].move;
    return { uci: ChessRules.toUCI(pick), eval: Math.round(scored[0].score), depth: 2, nodes: nodesObj.count };
  }

  // Hard AI
  function searchHard(state, timeBudgetMs = 1000, historyHashes = []) {
    const moves = ChessRules.legalMoves(state);
    if (moves.length === 0) return null;
    if (moves.length === 1) return { uci: ChessRules.toUCI(moves[0]), eval: 0, depth: 1, nodes: 1 };

    // Opening book check
    if (state.fullmove <= 3) {
      const bookMatches = [];
      for (const line of OPENING_BOOK) {
        let sim = ChessRules.initial();
        for (let i = 0; i < line.length; i++) {
          if (ChessRules.toFEN(sim) === ChessRules.toFEN(state)) {
            const bm = ChessRules.fromSAN(sim, line[i]);
            if (bm) bookMatches.push(bm);
          }
          const m = ChessRules.fromSAN(sim, line[i]);
          if (!m) break;
          sim = ChessRules.make(sim, m);
        }
      }
      if (bookMatches.length > 0) {
        const pick = bookMatches[Math.floor(Math.random() * bookMatches.length)];
        return { uci: ChessRules.toUCI(pick), eval: 20, depth: 1, nodes: 1 };
      }
    }

    const deadline = performance.now() + Math.max(150, timeBudgetMs);
    const nodesObj = { count: 0, stopped: false };
    let bestMove = moves[0];
    let bestEval = 0;
    let completedDepth = 1;

    // Iterative Deepening
    for (let depth = 1; depth <= 8; depth++) {
      if (performance.now() > deadline) break;

      let alpha = -30000;
      let beta = 30000;
      let curBestMove = bestMove;
      let curBestEval = -30000;

      // Root search
      const rootMoves = moves.slice();
      // Sort root moves so previous best is tried first
      rootMoves.sort((a, b) => {
        if (a === bestMove) return -1;
        if (b === bestMove) return 1;
        return 0;
      });

      const undo = {};
      for (let i = 0; i < rootMoves.length; i++) {
        const m = rootMoves[i];
        ChessRules.makeInPlace(state, m, undo);
        const score = -negamax(state, depth - 1, -beta, -alpha, false, deadline, nodesObj);
        ChessRules.unmake(state, m, undo);

        if (nodesObj.stopped) break;

        if (score > curBestEval) {
          curBestEval = score;
          curBestMove = m;
        }
        if (score > alpha) {
          alpha = score;
        }
      }

      if (!nodesObj.stopped) {
        bestMove = curBestMove;
        bestEval = curBestEval;
        completedDepth = depth;
        if (Math.abs(bestEval) >= 19000) break; // Found checkmate
      }
    }

    return {
      uci: ChessRules.toUCI(bestMove),
      eval: bestEval,
      depth: completedDepth,
      nodes: nodesObj.count,
    };
  }

  function search(fen, level, timeBudgetMs, historyHashes = []) {
    const state = ChessRules.fromFEN(fen);
    if (historyHashes && historyHashes.length > 0) {
      state.history = historyHashes;
    }

    if (level === 'easy') {
      return searchEasy(state);
    } else if (level === 'medium') {
      return searchMedium(state, historyHashes);
    } else {
      return searchHard(state, timeBudgetMs, historyHashes);
    }
  }

  return {
    evaluate,
    search,
    searchEasy,
    searchMedium,
    searchHard,
  };
});
