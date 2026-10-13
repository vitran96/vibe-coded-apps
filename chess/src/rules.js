// Chess rules engine: pure, deterministic, no DOM
// Coordinates: 0 (a1) to 63 (h8), sq = rank * 8 + file
// Pieces: 0 empty, White: 1=P, 2=N, 3=B, 4=R, 5=Q, 6=K. Black: -1..-6.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const inst = factory();
    inst.factory = factory;
    module.exports = inst;
  } else {
    root.ChessRules = factory();
    root.ChessRules.factory = factory; // used to build the AI worker source
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const PIECE_CHARS = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const CHAR_TO_PIECE = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

  const FLAGS = {
    DOUBLE: 1,
    EP: 2,
    CASTLE_K: 4,
    CASTLE_Q: 8,
    PROMO: 16,
    CAPTURE: 32,
  };

  // Precomputed ray and step tables
  const KNIGHT_OFFSETS = [-17, -15, -10, -6, 6, 10, 15, 17];
  const KING_OFFSETS = [-9, -8, -7, -1, 1, 7, 8, 9];
  const BISHOP_DIRS = [-9, -7, 7, 9];
  const ROOK_DIRS = [-8, -1, 1, 8];

  function sqToFile(sq) { return sq & 7; }
  function sqToRank(sq) { return sq >> 3; }
  function toCoord(sq) {
    return String.fromCharCode(97 + (sq & 7)) + ((sq >> 3) + 1);
  }
  function fromCoord(str) {
    if (!str || str.length < 2) return -1;
    const f = str.charCodeAt(0) - 97;
    const r = str.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return (r << 3) | f;
  }

  // PRNG for Zobrist table (Mulberry32)
  let seed = 0x12345678;
  function prng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  const ZOBRIST = {
    pieces: Array.from({ length: 64 }, () => Array.from({ length: 13 }, () => (BigInt(prng()) << 32n) | BigInt(prng()))),
    blackTurn: (BigInt(prng()) << 32n) | BigInt(prng()),
    castling: Array.from({ length: 16 }, () => (BigInt(prng()) << 32n) | BigInt(prng())),
    ep: Array.from({ length: 8 }, () => (BigInt(prng()) << 32n) | BigInt(prng())),
  };

  function pieceIndex(p) {
    // -6..-1 -> 0..5, 1..6 -> 6..11, 0 -> 12
    if (p === 0) return 12;
    return p < 0 ? -p - 1 : p + 5;
  }

  function computeHash(board, turn, castling, ep) {
    let h = 0n;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p !== 0) h ^= ZOBRIST.pieces[i][pieceIndex(p)];
    }
    if (turn === -1) h ^= ZOBRIST.blackTurn;
    h ^= ZOBRIST.castling[castling];
    if (ep >= 0) {
      // FIDE threefold: only hash ep if an enemy pawn could capture it
      const epFile = ep & 7;
      const pawnRank = turn === 1 ? 4 : 3;
      const pawnSqLeft = (pawnRank << 3) | (epFile - 1);
      const pawnSqRight = (pawnRank << 3) | (epFile + 1);
      const enemyPawn = turn === 1 ? 1 : -1;
      let canCapture = false;
      if (epFile > 0 && board[pawnSqLeft] === enemyPawn) canCapture = true;
      if (epFile < 7 && board[pawnSqRight] === enemyPawn) canCapture = true;
      if (canCapture) h ^= ZOBRIST.ep[epFile];
    }
    return h;
  }

  function fromFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const board = new Int8Array(64);
    let r = 7, f = 0;
    let wKing = -1, bKing = -1;

    for (const ch of parts[0]) {
      if (ch === '/') {
        r--;
        f = 0;
      } else if (ch >= '1' && ch <= '8') {
        f += parseInt(ch, 10);
      } else {
        const lower = ch.toLowerCase();
        const isWhite = ch !== lower;
        const pType = CHAR_TO_PIECE[lower] || 0;
        const val = isWhite ? pType : -pType;
        const sq = (r << 3) | f;
        board[sq] = val;
        if (val === K) wKing = sq;
        if (val === -K) bKing = sq;
        f++;
      }
    }

    const turn = parts[1] === 'b' ? -1 : 1;

    let castling = 0;
    if (parts[2]) {
      if (parts[2].includes('K')) castling |= 1;
      if (parts[2].includes('Q')) castling |= 2;
      if (parts[2].includes('k')) castling |= 4;
      if (parts[2].includes('q')) castling |= 8;
    }

    let ep = -1;
    if (parts[3] && parts[3] !== '-') {
      ep = fromCoord(parts[3]);
    }

    const halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    const fullmove = parts[5] ? parseInt(parts[5], 10) : 1;

    const hash = computeHash(board, turn, castling, ep);
    return {
      board,
      turn,
      castling,
      ep,
      halfmove,
      fullmove,
      kings: [wKing, bKing],
      hash,
      history: [hash],
    };
  }

  function initial() {
    return fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }

  function toFEN(state) {
    let res = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = state.board[(r << 3) | f];
        if (p === 0) {
          empty++;
        } else {
          if (empty > 0) { res += empty; empty = 0; }
          const ch = PIECE_CHARS[Math.abs(p)];
          res += p > 0 ? ch : ch.toLowerCase();
        }
      }
      if (empty > 0) res += empty;
      if (r > 0) res += '/';
    }

    res += ' ' + (state.turn === 1 ? 'w' : 'b') + ' ';

    let castStr = '';
    if (state.castling & 1) castStr += 'K';
    if (state.castling & 2) castStr += 'Q';
    if (state.castling & 4) castStr += 'k';
    if (state.castling & 8) castStr += 'q';
    res += (castStr || '-') + ' ';

    res += (state.ep >= 0 ? toCoord(state.ep) : '-') + ' ';
    res += state.halfmove + ' ' + state.fullmove;
    return res;
  }

  function isAttacked(state, sq, bySide) {
    const b = state.board;
    const f = sq & 7;
    const r = sq >> 3;

    // Pawns
    if (bySide === 1) {
      // White pawns attack sq from rank r - 1
      if (r > 0) {
        if (f > 0 && b[sq - 9] === P) return true;
        if (f < 7 && b[sq - 7] === P) return true;
      }
    } else {
      // Black pawns attack sq from rank r + 1
      if (r < 7) {
        if (f > 0 && b[sq + 7] === -P) return true;
        if (f < 7 && b[sq + 9] === -P) return true;
      }
    }

    // Knights
    const targetKnight = bySide === 1 ? N : -N;
    for (let i = 0; i < 8; i++) {
      const off = KNIGHT_OFFSETS[i];
      const to = sq + off;
      if (to >= 0 && to < 64) {
        const tf = to & 7;
        const df = Math.abs(tf - f);
        if ((df === 1 || df === 2) && b[to] === targetKnight) return true;
      }
    }

    // Kings
    const targetKing = bySide === 1 ? K : -K;
    for (let i = 0; i < 8; i++) {
      const off = KING_OFFSETS[i];
      const to = sq + off;
      if (to >= 0 && to < 64) {
        const tf = to & 7;
        if (Math.abs(tf - f) <= 1 && b[to] === targetKing) return true;
      }
    }

    // Bishops & Queens (diagonals)
    const targetBishop = bySide === 1 ? B : -B;
    const targetQueen = bySide === 1 ? Q : -Q;
    for (let i = 0; i < 4; i++) {
      const dir = BISHOP_DIRS[i];
      let cur = sq;
      while (true) {
        const cf = cur & 7;
        cur += dir;
        if (cur < 0 || cur >= 64) break;
        const nf = cur & 7;
        if (Math.abs(nf - cf) !== 1) break;
        const p = b[cur];
        if (p !== 0) {
          if (p === targetBishop || p === targetQueen) return true;
          break;
        }
      }
    }

    // Rooks & Queens (orthogonals)
    const targetRook = bySide === 1 ? R : -R;
    for (let i = 0; i < 4; i++) {
      const dir = ROOK_DIRS[i];
      let cur = sq;
      while (true) {
        const cf = cur & 7;
        cur += dir;
        if (cur < 0 || cur >= 64) break;
        const nf = cur & 7;
        if (dir === 1 || dir === -1) {
          if ((cur >> 3) !== r) break;
        } else {
          if (nf !== f) break;
        }
        const p = b[cur];
        if (p !== 0) {
          if (p === targetRook || p === targetQueen) return true;
          break;
        }
      }
    }

    return false;
  }

  function inCheck(state, side) {
    const kingSq = side === 1 ? state.kings[0] : state.kings[1];
    if (kingSq < 0) return false;
    return isAttacked(state, kingSq, -side);
  }

  function pseudoMoves(state) {
    const list = [];
    const b = state.board;
    const turn = state.turn;

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p === 0 || (p > 0 && turn !== 1) || (p < 0 && turn !== -1)) continue;

      const type = Math.abs(p);
      const f = sq & 7;
      const r = sq >> 3;

      if (type === P) {
        const fwd = turn === 1 ? 8 : -8;
        const startRank = turn === 1 ? 1 : 6;
        const promoRank = turn === 1 ? 7 : 0;
        const to1 = sq + fwd;

        // Push 1
        if (to1 >= 0 && to1 < 64 && b[to1] === 0) {
          const toRank = to1 >> 3;
          if (toRank === promoRank) {
            list.push({ from: sq, to: to1, piece: p, captured: 0, promo: Q, flags: FLAGS.PROMO });
            list.push({ from: sq, to: to1, piece: p, captured: 0, promo: R, flags: FLAGS.PROMO });
            list.push({ from: sq, to: to1, piece: p, captured: 0, promo: B, flags: FLAGS.PROMO });
            list.push({ from: sq, to: to1, piece: p, captured: 0, promo: N, flags: FLAGS.PROMO });
          } else {
            list.push({ from: sq, to: to1, piece: p, captured: 0, promo: 0, flags: 0 });
            // Push 2
            if (r === startRank) {
              const to2 = sq + fwd * 2;
              if (b[to2] === 0) {
                list.push({ from: sq, to: to2, piece: p, captured: 0, promo: 0, flags: FLAGS.DOUBLE });
              }
            }
          }
        }

        // Captures
        for (const df of [-1, 1]) {
          const tf = f + df;
          if (tf >= 0 && tf < 8) {
            const toCap = sq + fwd + df;
            const target = b[toCap];
            if (target !== 0 && (target * turn < 0)) {
              const toRank = toCap >> 3;
              if (toRank === promoRank) {
                list.push({ from: sq, to: toCap, piece: p, captured: target, promo: Q, flags: FLAGS.PROMO | FLAGS.CAPTURE });
                list.push({ from: sq, to: toCap, piece: p, captured: target, promo: R, flags: FLAGS.PROMO | FLAGS.CAPTURE });
                list.push({ from: sq, to: toCap, piece: p, captured: target, promo: B, flags: FLAGS.PROMO | FLAGS.CAPTURE });
                list.push({ from: sq, to: toCap, piece: p, captured: target, promo: N, flags: FLAGS.PROMO | FLAGS.CAPTURE });
              } else {
                list.push({ from: sq, to: toCap, piece: p, captured: target, promo: 0, flags: FLAGS.CAPTURE });
              }
            } else if (toCap === state.ep) {
              // En passant
              list.push({ from: sq, to: toCap, piece: p, captured: -turn * P, promo: 0, flags: FLAGS.EP | FLAGS.CAPTURE });
            }
          }
        }
      } else if (type === N) {
        for (let i = 0; i < 8; i++) {
          const off = KNIGHT_OFFSETS[i];
          const to = sq + off;
          if (to >= 0 && to < 64) {
            const tf = to & 7;
            if (Math.abs(tf - f) === 1 || Math.abs(tf - f) === 2) {
              const target = b[to];
              if (target === 0) {
                list.push({ from: sq, to, piece: p, captured: 0, promo: 0, flags: 0 });
              } else if (target * turn < 0) {
                list.push({ from: sq, to, piece: p, captured: target, promo: 0, flags: FLAGS.CAPTURE });
              }
            }
          }
        }
      } else if (type === B || type === R || type === Q) {
        const dirs = type === B ? BISHOP_DIRS : type === R ? ROOK_DIRS : BISHOP_DIRS.concat(ROOK_DIRS);
        for (let i = 0; i < dirs.length; i++) {
          const dir = dirs[i];
          let cur = sq;
          while (true) {
            const cf = cur & 7;
            cur += dir;
            if (cur < 0 || cur >= 64) break;
            const nf = cur & 7;
            if (dir === 1 || dir === -1) {
              if ((cur >> 3) !== r) break;
            } else if (dir === 8 || dir === -8) {
              if (nf !== f) break;
            } else {
              if (Math.abs(nf - cf) !== 1) break;
            }
            const target = b[cur];
            if (target === 0) {
              list.push({ from: sq, to: cur, piece: p, captured: 0, promo: 0, flags: 0 });
            } else {
              if (target * turn < 0) {
                list.push({ from: sq, to: cur, piece: p, captured: target, promo: 0, flags: FLAGS.CAPTURE });
              }
              break;
            }
          }
        }
      } else if (type === K) {
        for (let i = 0; i < 8; i++) {
          const off = KING_OFFSETS[i];
          const to = sq + off;
          if (to >= 0 && to < 64) {
            const tf = to & 7;
            if (Math.abs(tf - f) <= 1) {
              const target = b[to];
              if (target === 0) {
                list.push({ from: sq, to, piece: p, captured: 0, promo: 0, flags: 0 });
              } else if (target * turn < 0) {
                list.push({ from: sq, to, piece: p, captured: target, promo: 0, flags: FLAGS.CAPTURE });
              }
            }
          }
        }

        // Castling
        if (turn === 1 && sq === 4) {
          // White Kingside: e1 -> g1 (squares 5, 6 empty)
          if ((state.castling & 1) && b[5] === 0 && b[6] === 0 && b[7] === R) {
            if (!isAttacked(state, 4, -1) && !isAttacked(state, 5, -1) && !isAttacked(state, 6, -1)) {
              list.push({ from: 4, to: 6, piece: p, captured: 0, promo: 0, flags: FLAGS.CASTLE_K });
            }
          }
          // White Queenside: e1 -> c1 (squares 1, 2, 3 empty)
          if ((state.castling & 2) && b[1] === 0 && b[2] === 0 && b[3] === 0 && b[0] === R) {
            if (!isAttacked(state, 4, -1) && !isAttacked(state, 3, -1) && !isAttacked(state, 2, -1)) {
              list.push({ from: 4, to: 2, piece: p, captured: 0, promo: 0, flags: FLAGS.CASTLE_Q });
            }
          }
        } else if (turn === -1 && sq === 60) {
          // Black Kingside: e8 -> g8 (squares 61, 62 empty)
          if ((state.castling & 4) && b[61] === 0 && b[62] === 0 && b[63] === -R) {
            if (!isAttacked(state, 60, 1) && !isAttacked(state, 61, 1) && !isAttacked(state, 62, 1)) {
              list.push({ from: 60, to: 62, piece: p, captured: 0, promo: 0, flags: FLAGS.CASTLE_K });
            }
          }
          // Black Queenside: e8 -> c8 (squares 57, 58, 59 empty)
          if ((state.castling & 8) && b[57] === 0 && b[58] === 0 && b[59] === 0 && b[56] === -R) {
            if (!isAttacked(state, 60, 1) && !isAttacked(state, 59, 1) && !isAttacked(state, 58, 1)) {
              list.push({ from: 60, to: 58, piece: p, captured: 0, promo: 0, flags: FLAGS.CASTLE_Q });
            }
          }
        }
      }
    }

    return list;
  }

  function make(state, move) {
    const nextBoard = new Int8Array(state.board);
    const turn = state.turn;
    let wKing = state.kings[0];
    let bKing = state.kings[1];

    nextBoard[move.from] = 0;
    const finalPiece = move.promo ? (turn === 1 ? move.promo : -move.promo) : move.piece;
    nextBoard[move.to] = finalPiece;

    if (move.flags & FLAGS.EP) {
      const epCapSq = state.ep - (turn === 1 ? 8 : -8);
      nextBoard[epCapSq] = 0;
    } else if (move.flags & FLAGS.CASTLE_K) {
      if (turn === 1) {
        nextBoard[7] = 0;
        nextBoard[5] = R;
      } else {
        nextBoard[63] = 0;
        nextBoard[61] = -R;
      }
    } else if (move.flags & FLAGS.CASTLE_Q) {
      if (turn === 1) {
        nextBoard[0] = 0;
        nextBoard[3] = R;
      } else {
        nextBoard[56] = 0;
        nextBoard[59] = -R;
      }
    }

    if (Math.abs(move.piece) === K) {
      if (turn === 1) wKing = move.to;
      else bKing = move.to;
    }

    // Update castling rights
    let castling = state.castling;
    if (move.from === 4 || move.to === 4) castling &= ~3; // White King moved/captured
    if (move.from === 60 || move.to === 60) castling &= ~12; // Black King moved/captured
    if (move.from === 7 || move.to === 7) castling &= ~1; // h1 rook
    if (move.from === 0 || move.to === 0) castling &= ~2; // a1 rook
    if (move.from === 63 || move.to === 63) castling &= ~4; // h8 rook
    if (move.from === 56 || move.to === 56) castling &= ~8; // a8 rook

    const ep = (move.flags & FLAGS.DOUBLE) ? (move.from + (turn === 1 ? 8 : -8)) : -1;
    const halfmove = (Math.abs(move.piece) === P || move.captured !== 0) ? 0 : state.halfmove + 1;
    const fullmove = turn === -1 ? state.fullmove + 1 : state.fullmove;

    const nextTurn = -turn;
    const hash = computeHash(nextBoard, nextTurn, castling, ep);

    return {
      board: nextBoard,
      turn: nextTurn,
      castling,
      ep,
      halfmove,
      fullmove,
      kings: [wKing, bKing],
      hash,
      history: [...state.history, hash],
    };
  }

  function makeInPlace(state, move, undo) {
    const b = state.board;
    const turn = state.turn;

    undo.castling = state.castling;
    undo.ep = state.ep;
    undo.halfmove = state.halfmove;
    undo.kings0 = state.kings[0];
    undo.kings1 = state.kings[1];
    undo.hash = state.hash;

    b[move.from] = 0;
    const finalPiece = move.promo ? (turn === 1 ? move.promo : -move.promo) : move.piece;
    b[move.to] = finalPiece;

    if (move.flags & FLAGS.EP) {
      const epCapSq = state.ep - (turn === 1 ? 8 : -8);
      b[epCapSq] = 0;
    } else if (move.flags & FLAGS.CASTLE_K) {
      if (turn === 1) { b[7] = 0; b[5] = R; }
      else { b[63] = 0; b[61] = -R; }
    } else if (move.flags & FLAGS.CASTLE_Q) {
      if (turn === 1) { b[0] = 0; b[3] = R; }
      else { b[56] = 0; b[59] = -R; }
    }

    if (Math.abs(move.piece) === K) {
      if (turn === 1) state.kings[0] = move.to;
      else state.kings[1] = move.to;
    }

    if (move.from === 4 || move.to === 4) state.castling &= ~3;
    if (move.from === 60 || move.to === 60) state.castling &= ~12;
    if (move.from === 7 || move.to === 7) state.castling &= ~1;
    if (move.from === 0 || move.to === 0) state.castling &= ~2;
    if (move.from === 63 || move.to === 63) state.castling &= ~4;
    if (move.from === 56 || move.to === 56) state.castling &= ~8;

    state.ep = (move.flags & FLAGS.DOUBLE) ? (move.from + (turn === 1 ? 8 : -8)) : -1;
    state.halfmove = (Math.abs(move.piece) === P || move.captured !== 0) ? 0 : state.halfmove + 1;
    if (turn === -1) state.fullmove++;
    state.turn = -turn;
    state.hash = computeHash(b, state.turn, state.castling, state.ep);
  }

  function unmake(state, move, undo) {
    const b = state.board;
    const prevTurn = -state.turn;

    state.turn = prevTurn;
    if (prevTurn === -1) state.fullmove--;
    state.castling = undo.castling;
    state.ep = undo.ep;
    state.halfmove = undo.halfmove;
    state.kings[0] = undo.kings0;
    state.kings[1] = undo.kings1;
    state.hash = undo.hash;

    b[move.from] = move.piece;
    b[move.to] = move.captured;

    if (move.flags & FLAGS.EP) {
      const epCapSq = undo.ep - (prevTurn === 1 ? 8 : -8);
      b[epCapSq] = -prevTurn * P;
      b[move.to] = 0;
    } else if (move.flags & FLAGS.CASTLE_K) {
      if (prevTurn === 1) { b[7] = R; b[5] = 0; }
      else { b[63] = -R; b[61] = 0; }
    } else if (move.flags & FLAGS.CASTLE_Q) {
      if (prevTurn === 1) { b[0] = R; b[3] = 0; }
      else { b[56] = -R; b[59] = 0; }
    }
  }

  function legalMoves(state) {
    const pms = pseudoMoves(state);
    const res = [];
    const undo = {};
    for (let i = 0; i < pms.length; i++) {
      const m = pms[i];
      makeInPlace(state, m, undo);
      // King of the mover (which is -state.turn after makeInPlace) must not be in check
      if (!inCheck(state, -state.turn)) {
        res.push(m);
      }
      unmake(state, m, undo);
    }
    return res;
  }

  function legalMovesFrom(state, sq) {
    const all = legalMoves(state);
    return all.filter((m) => m.from === sq);
  }

  function insufficientMaterial(state) {
    const b = state.board;
    let wPieces = [], bPieces = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === 0) continue;
      if (Math.abs(p) === P || Math.abs(p) === R || Math.abs(p) === Q) return false;
      if (p > 0) wPieces.push({ type: p, sq: i });
      else bPieces.push({ type: -p, sq: i });
    }

    // Both sides must have at least King
    if (wPieces.length === 1 && bPieces.length === 1) return true; // K vs K
    if (wPieces.length === 2 && bPieces.length === 1) {
      const minor = wPieces.find((x) => x.type !== K);
      if (minor && (minor.type === B || minor.type === N)) return true; // K+B vs K or K+N vs K
    }
    if (bPieces.length === 2 && wPieces.length === 1) {
      const minor = bPieces.find((x) => x.type !== K);
      if (minor && (minor.type === B || minor.type === N)) return true;
    }
    if (wPieces.length === 2 && bPieces.length === 2) {
      const wB = wPieces.find((x) => x.type === B);
      const bB = bPieces.find((x) => x.type === B);
      if (wB && bB) {
        // Bishops on same-color squares:
        // Square color = ((sq >> 3) + (sq & 7)) % 2
        const wColor = ((wB.sq >> 3) + (wB.sq & 7)) & 1;
        const bColor = ((bB.sq >> 3) + (bB.sq & 7)) & 1;
        if (wColor === bColor) return true;
      }
    }
    return false;
  }

  function status(state) {
    const legals = legalMoves(state);
    if (legals.length === 0) {
      if (inCheck(state, state.turn)) {
        return {
          over: true,
          result: state.turn === 1 ? '0-1' : '1-0',
          reason: 'checkmate',
        };
      }
      return {
        over: true,
        result: '1/2-1/2',
        reason: 'stalemate',
      };
    }

    if (insufficientMaterial(state)) {
      return { over: true, result: '1/2-1/2', reason: 'insufficient' };
    }

    if (state.halfmove >= 100) {
      return { over: true, result: '1/2-1/2', reason: 'fifty' };
    }

    // Threefold repetition
    let count = 0;
    const currentHash = state.hash;
    for (let i = 0; i < state.history.length; i++) {
      if (state.history[i] === currentHash) {
        count++;
        if (count >= 3) {
          return { over: true, result: '1/2-1/2', reason: 'threefold' };
        }
      }
    }

    return { over: false, result: null, reason: null };
  }

  function toSAN(state, move) {
    if (move.flags & FLAGS.CASTLE_K) {
      const next = make(state, move);
      const chk = inCheck(next, next.turn);
      const mates = chk && legalMoves(next).length === 0;
      return 'O-O' + (mates ? '#' : chk ? '+' : '');
    }
    if (move.flags & FLAGS.CASTLE_Q) {
      const next = make(state, move);
      const chk = inCheck(next, next.turn);
      const mates = chk && legalMoves(next).length === 0;
      return 'O-O-O' + (mates ? '#' : chk ? '+' : '');
    }

    const pieceType = Math.abs(move.piece);
    let san = '';

    if (pieceType === P) {
      if (move.captured !== 0 || (move.flags & FLAGS.EP)) {
        san += String.fromCharCode(97 + (move.from & 7)) + 'x' + toCoord(move.to);
      } else {
        san += toCoord(move.to);
      }
      if (move.promo) {
        san += '=' + PIECE_CHARS[move.promo];
      }
    } else {
      san += PIECE_CHARS[pieceType];

      // Disambiguation among other pieces of same type that could also move to `move.to`
      const legals = legalMoves(state);
      const others = legals.filter((m) =>
        m.from !== move.from &&
        m.to === move.to &&
        Math.abs(m.piece) === pieceType
      );

      if (others.length > 0) {
        const sameFile = others.some((m) => (m.from & 7) === (move.from & 7));
        const sameRank = others.some((m) => (m.from >> 3) === (move.from >> 3));
        if (!sameFile) {
          san += String.fromCharCode(97 + (move.from & 7));
        } else if (!sameRank) {
          san += ((move.from >> 3) + 1);
        } else {
          san += toCoord(move.from);
        }
      }

      if (move.captured !== 0) san += 'x';
      san += toCoord(move.to);
    }

    const next = make(state, move);
    const chk = inCheck(next, next.turn);
    if (chk) {
      const mates = legalMoves(next).length === 0;
      san += mates ? '#' : '+';
    }

    return san;
  }

  function toUCI(move) {
    let uci = toCoord(move.from) + toCoord(move.to);
    if (move.promo) uci += PIECE_CHARS[move.promo].toLowerCase();
    return uci;
  }

  function fromUCI(state, uci) {
    if (!uci || uci.length < 4) return null;
    const from = fromCoord(uci.slice(0, 2));
    const to = fromCoord(uci.slice(2, 4));
    let promo = 0;
    if (uci.length >= 5) {
      promo = CHAR_TO_PIECE[uci[4].toLowerCase()] || 0;
    }
    const legals = legalMoves(state);
    return legals.find((m) => m.from === from && m.to === to && (promo ? m.promo === promo : !m.promo)) || null;
  }

  function fromSAN(state, san) {
    if (!san) return null;
    const clean = san.replace(/[+#?!=]/g, '').trim();
    const legals = legalMoves(state);
    for (let i = 0; i < legals.length; i++) {
      const m = legals[i];
      if (toSAN(state, m) === san) return m;
      const sClean = toSAN(state, m).replace(/[+#?!=]/g, '').trim();
      if (sClean === clean) return m;
    }
    return null;
  }

  function toPGN(game) {
    // game = { headers: {}, moves: [san...] }
    const headers = Object.assign({
      Event: 'Casual Game',
      Site: 'Antigravity Chess',
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      Round: '1',
      White: 'White',
      Black: 'Black',
      Result: '*',
    }, game.headers || {});

    let pgn = '';
    for (const [k, v] of Object.entries(headers)) {
      pgn += `[${k} "${v}"]\n`;
    }
    pgn += '\n';

    const moves = game.moves || [];
    let line = '';
    for (let i = 0; i < moves.length; i++) {
      const num = (i % 2 === 0) ? `${Math.floor(i / 2) + 1}. ` : '';
      const token = num + moves[i] + ' ';
      if (line.length + token.length > 80) {
        pgn += line.trimEnd() + '\n';
        line = token;
      } else {
        line += token;
      }
    }
    if (headers.Result) line += headers.Result;
    pgn += line.trimEnd() + '\n';
    return pgn;
  }

  function perft(state, depth) {
    if (depth <= 0) return 1;
    const moves = legalMoves(state);
    if (depth === 1) return moves.length;
    let nodes = 0;
    const undo = {};
    for (let i = 0; i < moves.length; i++) {
      makeInPlace(state, moves[i], undo);
      nodes += perft(state, depth - 1);
      unmake(state, moves[i], undo);
    }
    return nodes;
  }

  return {
    FLAGS,
    P, N, B, R, Q, K,
    initial,
    fromFEN,
    toFEN,
    toCoord,
    fromCoord,
    isAttacked,
    inCheck,
    pseudoMoves,
    legalMoves,
    legalMovesFrom,
    make,
    makeInPlace,
    unmake,
    insufficientMaterial,
    status,
    toSAN,
    fromSAN,
    toUCI,
    fromUCI,
    toPGN,
    perft,
  };
});
