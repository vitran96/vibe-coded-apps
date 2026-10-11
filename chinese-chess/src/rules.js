// rules.js — pure, DOM-free Cờ Tướng (Xiangqi) rules engine
function defineRules(XQ) {
  const K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;
  XQ.PIECES = { K, A, E, H, R, C, P };

  const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  XQ.START_FEN = START_FEN;

  // PRNG for Zobrist (mulberry32 with seed 0xC0707007)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      let t = (a += 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0);
    };
  }

  const rng = mulberry32(0xC0707007);
  const ZOBRIST_PIECES_LO = new Uint32Array(90 * 15);
  const ZOBRIST_PIECES_HI = new Uint32Array(90 * 15);
  for (let i = 0; i < 90 * 15; i++) {
    ZOBRIST_PIECES_LO[i] = rng();
    ZOBRIST_PIECES_HI[i] = rng();
  }
  const ZOBRIST_SIDE_LO = rng();
  const ZOBRIST_SIDE_HI = rng();

  function pidx(piece) {
    return piece + 7; // -7..-1 -> 0..6, 0 -> 7, 1..7 -> 8..14
  }

  // Precomputed tables
  const IN_PALACE_RED = new Uint8Array(90);
  const IN_PALACE_BLACK = new Uint8Array(90);
  for (let sq = 0; sq < 90; sq++) {
    const f = sq % 9, r = Math.floor(sq / 9);
    if (f >= 3 && f <= 5) {
      if (r >= 0 && r <= 2) IN_PALACE_RED[sq] = 1;
      if (r >= 7 && r <= 9) IN_PALACE_BLACK[sq] = 1;
    }
  }

  // King moves
  const KING_MOVES = [];
  for (let sq = 0; sq < 90; sq++) {
    const f = sq % 9, r = Math.floor(sq / 9);
    const mRed = [], mBlack = [];
    const deltas = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [df, dr] of deltas) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf <= 8 && nr >= 0 && nr <= 9) {
        const nsq = nr * 9 + nf;
        if (IN_PALACE_RED[nsq]) mRed.push(nsq);
        if (IN_PALACE_BLACK[nsq]) mBlack.push(nsq);
      }
    }
    KING_MOVES[sq] = { red: new Int8Array(mRed), black: new Int8Array(mBlack) };
  }

  // Advisor moves
  const ADVISOR_MOVES = [];
  for (let sq = 0; sq < 90; sq++) {
    const f = sq % 9, r = Math.floor(sq / 9);
    const mRed = [], mBlack = [];
    const deltas = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [df, dr] of deltas) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf <= 8 && nr >= 0 && nr <= 9) {
        const nsq = nr * 9 + nf;
        if (IN_PALACE_RED[nsq]) mRed.push(nsq);
        if (IN_PALACE_BLACK[nsq]) mBlack.push(nsq);
      }
    }
    ADVISOR_MOVES[sq] = { red: new Int8Array(mRed), black: new Int8Array(mBlack) };
  }

  // Elephant moves
  const ELEPHANT_MOVES = [];
  for (let sq = 0; sq < 90; sq++) {
    const f = sq % 9, r = Math.floor(sq / 9);
    const mRed = [], mBlack = [];
    const deltas = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
    for (const [df, dr] of deltas) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf <= 8 && nr >= 0 && nr <= 9) {
        const eye = (r + dr / 2) * 9 + (f + df / 2);
        const to = nr * 9 + nf;
        if (nr <= 4) mRed.push({ to, eye });
        if (nr >= 5) mBlack.push({ to, eye });
      }
    }
    ELEPHANT_MOVES[sq] = { red: mRed, black: mBlack };
  }

  // Horse moves
  const HORSE_MOVES = [];
  for (let sq = 0; sq < 90; sq++) {
    const f = sq % 9, r = Math.floor(sq / 9);
    const jumps = [
      { df: 1, dr: 2, legF: 0, legR: 1 },
      { df: -1, dr: 2, legF: 0, legR: 1 },
      { df: 1, dr: -2, legF: 0, legR: -1 },
      { df: -1, dr: -2, legF: 0, legR: -1 },
      { df: 2, dr: 1, legF: 1, legR: 0 },
      { df: 2, dr: -1, legF: 1, legR: 0 },
      { df: -2, dr: 1, legF: -1, legR: 0 },
      { df: -2, dr: -1, legF: -1, legR: 0 },
    ];
    const valid = [];
    for (const j of jumps) {
      const nf = f + j.df, nr = r + j.dr;
      if (nf >= 0 && nf <= 8 && nr >= 0 && nr <= 9) {
        valid.push({
          to: nr * 9 + nf,
          leg: (r + j.legR) * 9 + (f + j.legF)
        });
      }
    }
    HORSE_MOVES[sq] = valid;
  }

  // Pos constructor
  function Pos() {
    this.board = new Int8Array(90);
    this.side = 1; // 1 = Red, -1 = Black
    this.hashLo = 0;
    this.hashHi = 0;
    this.ply = 0;
    this.halfmove = 0;
    this.kingSq = { 1: -1, [-1]: -1 };
  }

  XQ.Pos = Pos;

  function recomputeHash(pos) {
    let lo = 0 >>> 0, hi = 0 >>> 0;
    for (let sq = 0; sq < 90; sq++) {
      const p = pos.board[sq];
      if (p !== 0) {
        const idx = sq * 15 + pidx(p);
        lo ^= ZOBRIST_PIECES_LO[idx];
        hi ^= ZOBRIST_PIECES_HI[idx];
      }
    }
    if (pos.side === -1) {
      lo ^= ZOBRIST_SIDE_LO;
      hi ^= ZOBRIST_SIDE_HI;
    }
    pos.hashLo = lo >>> 0;
    pos.hashHi = hi >>> 0;
  }

  XQ.recomputeHash = recomputeHash;

  function parseFen(fen) {
    const pos = new Pos();
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    let rank = 9;
    for (const row of rows) {
      let file = 0;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c >= '1' && c <= '9') {
          file += parseInt(c, 10);
        } else {
          const sq = rank * 9 + file;
          let p = 0;
          switch (c.toUpperCase()) {
            case 'K': p = K; break;
            case 'A': p = A; break;
            case 'B': case 'E': p = E; break;
            case 'N': case 'H': p = H; break;
            case 'R': p = R; break;
            case 'C': p = C; break;
            case 'P': p = P; break;
          }
          if (c === c.toLowerCase()) p = -p;
          pos.board[sq] = p;
          if (p === K) pos.kingSq[1] = sq;
          if (p === -K) pos.kingSq[-1] = sq;
          file++;
        }
      }
      rank--;
    }
    pos.side = (parts[1] && parts[1].toLowerCase() === 'b') ? -1 : 1;
    pos.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    const fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    pos.ply = (fullmove - 1) * 2 + (pos.side === -1 ? 1 : 0);
    recomputeHash(pos);
    return pos;
  }

  XQ.parseFen = parseFen;

  function toFen(pos) {
    const rows = [];
    for (let r = 9; r >= 0; r--) {
      let empty = 0;
      let rowStr = '';
      for (let f = 0; f < 9; f++) {
        const p = pos.board[r * 9 + f];
        if (p === 0) {
          empty++;
        } else {
          if (empty > 0) {
            rowStr += empty;
            empty = 0;
          }
          let char = '';
          switch (Math.abs(p)) {
            case K: char = 'k'; break;
            case A: char = 'a'; break;
            case E: char = 'b'; break;
            case H: char = 'n'; break;
            case R: char = 'r'; break;
            case C: char = 'c'; break;
            case P: char = 'p'; break;
          }
          rowStr += p > 0 ? char.toUpperCase() : char;
        }
      }
      if (empty > 0) rowStr += empty;
      rows.push(rowStr);
    }
    const sideChar = pos.side === 1 ? 'w' : 'b';
    const fullmove = Math.floor(pos.ply / 2) + 1;
    return `${rows.join('/')} ${sideChar} - - ${pos.halfmove} ${fullmove}`;
  }

  XQ.toFen = toFen;

  function clonePos(pos) {
    const next = new Pos();
    next.board.set(pos.board);
    next.side = pos.side;
    next.hashLo = pos.hashLo;
    next.hashHi = pos.hashHi;
    next.ply = pos.ply;
    next.halfmove = pos.halfmove;
    next.kingSq[1] = pos.kingSq[1];
    next.kingSq[-1] = pos.kingSq[-1];
    return next;
  }

  XQ.clonePos = clonePos;

  function moveToIccs(m) {
    const from = (m >> 7) & 0x7F;
    const to = m & 0x7F;
    const ff = String.fromCharCode(97 + (from % 9));
    const fr = Math.floor(from / 9);
    const tf = String.fromCharCode(97 + (to % 9));
    const tr = Math.floor(to / 9);
    return `${ff}${fr}${tf}${tr}`;
  }

  XQ.moveToIccs = moveToIccs;

  function iccsToMove(s) {
    if (!s || s.length < 4) return 0;
    const ff = s.charCodeAt(0) - 97;
    const fr = parseInt(s[1], 10);
    const tf = s.charCodeAt(2) - 97;
    const tr = parseInt(s[3], 10);
    const from = fr * 9 + ff;
    const to = tr * 9 + tf;
    return (from << 7) | to;
  }

  XQ.iccsToMove = iccsToMove;

  // Flying General check
  function isFlyingGeneral(pos) {
    const kRed = pos.kingSq[1];
    const kBlack = pos.kingSq[-1];
    if (kRed < 0 || kBlack < 0) return false;
    const fRed = kRed % 9, fBlack = kBlack % 9;
    if (fRed !== fBlack) return false;
    const rMin = Math.min(Math.floor(kRed / 9), Math.floor(kBlack / 9));
    const rMax = Math.max(Math.floor(kRed / 9), Math.floor(kBlack / 9));
    for (let r = rMin + 1; r < rMax; r++) {
      if (pos.board[r * 9 + fRed] !== 0) return false;
    }
    return true;
  }

  // Attack test: is sq attacked by bySide?
  function isAttacked(pos, sq, bySide) {
    if (sq < 0 || sq >= 90) return false;
    const b = pos.board;
    const f = sq % 9, r = Math.floor(sq / 9);

    // 1. Soldier attack
    if (bySide === 1) { // Red soldier attacks
      // Red soldier moves up: attacked from r - 1
      if (r > 0 && b[(r - 1) * 9 + f] === P) return true;
      // Red soldier sideways if crossed river (r >= 5):
      if (r >= 5) {
        if (f > 0 && b[r * 9 + (f - 1)] === P) return true;
        if (f < 8 && b[r * 9 + (f + 1)] === P) return true;
      }
    } else { // Black soldier attacks
      // Black soldier moves down: attacked from r + 1
      if (r < 9 && b[(r + 1) * 9 + f] === -P) return true;
      // Black soldier sideways if crossed river (r <= 4):
      if (r <= 4) {
        if (f > 0 && b[r * 9 + (f - 1)] === -P) return true;
        if (f < 8 && b[r * 9 + (f + 1)] === -P) return true;
      }
    }

    // 2. Horse attack
    const hJumps = [
      { df: 1, dr: 2, legF: 0, legR: 1 },
      { df: -1, dr: 2, legF: 0, legR: 1 },
      { df: 1, dr: -2, legF: 0, legR: -1 },
      { df: -1, dr: -2, legF: 0, legR: -1 },
      { df: 2, dr: 1, legF: 1, legR: 0 },
      { df: 2, dr: -1, legF: 1, legR: 0 },
      { df: -2, dr: 1, legF: -1, legR: 0 },
      { df: -2, dr: -1, legF: -1, legR: 0 },
    ];
    const targetHorse = bySide * H;
    for (const j of hJumps) {
      const hf = f + j.df, hr = r + j.dr;
      if (hf >= 0 && hf <= 8 && hr >= 0 && hr <= 9) {
        if (b[hr * 9 + hf] === targetHorse) {
          // Check leg: the leg is adjacent to horse towards target sq!
          // Since j.df, j.dr are from sq to horse:
          // leg from horse towards sq is (hf - j.legF, hr - j.legR) == (f + (j.df - j.legF), r + (j.dr - j.legR)) == (f + j.legF, r + j.legR)
          const legSq = (r + j.legR) * 9 + (f + j.legF);
          if (b[legSq] === 0) return true;
        }
      }
    }

    // 3. Chariot and Cannon attack (and flying general check)
    const targetRook = bySide * R;
    const targetCannon = bySide * C;
    const targetKing = bySide * K;

    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [df, dr] of dirs) {
      let cf = f + df, cr = r + dr;
      let screen = false;
      while (cf >= 0 && cf <= 8 && cr >= 0 && cr <= 9) {
        const p = b[cr * 9 + cf];
        if (p !== 0) {
          if (!screen) {
            if (p === targetRook) return true;
            if (p === targetKing && df === 0) return true; // flying general along file
            screen = true;
          } else {
            if (p === targetCannon) return true;
            break; // Cannon can only jump 1 piece
          }
        }
        cf += df;
        cr += dr;
      }
    }

    return false;
  }

  XQ.isAttacked = isAttacked;

  function inCheck(pos, side) {
    if (isFlyingGeneral(pos)) return true;
    const kSq = pos.kingSq[side];
    if (kSq < 0) return false;
    return isAttacked(pos, kSq, -side);
  }

  XQ.inCheck = inCheck;

  // Pseudo-legal move generator
  function pseudoMoves(pos, out = []) {
    const side = pos.side;
    const b = pos.board;
    let count = 0;

    for (let sq = 0; sq < 90; sq++) {
      const p = b[sq];
      if (p === 0 || (p > 0 ? 1 : -1) !== side) continue;
      const type = Math.abs(p);
      const f = sq % 9, r = Math.floor(sq / 9);

      switch (type) {
        case K: {
          const list = side === 1 ? KING_MOVES[sq].red : KING_MOVES[sq].black;
          for (let i = 0; i < list.length; i++) {
            const to = list[i];
            const dest = b[to];
            if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
              out[count++] = (sq << 7) | to;
            }
          }
          break;
        }

        case A: {
          const list = side === 1 ? ADVISOR_MOVES[sq].red : ADVISOR_MOVES[sq].black;
          for (let i = 0; i < list.length; i++) {
            const to = list[i];
            const dest = b[to];
            if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
              out[count++] = (sq << 7) | to;
            }
          }
          break;
        }

        case E: {
          const list = side === 1 ? ELEPHANT_MOVES[sq].red : ELEPHANT_MOVES[sq].black;
          for (let i = 0; i < list.length; i++) {
            const m = list[i];
            if (b[m.eye] === 0) {
              const dest = b[m.to];
              if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
                out[count++] = (sq << 7) | m.to;
              }
            }
          }
          break;
        }

        case H: {
          const list = HORSE_MOVES[sq];
          for (let i = 0; i < list.length; i++) {
            const m = list[i];
            if (b[m.leg] === 0) {
              const dest = b[m.to];
              if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
                out[count++] = (sq << 7) | m.to;
              }
            }
          }
          break;
        }

        case R: {
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const [df, dr] of dirs) {
            let cf = f + df, cr = r + dr;
            while (cf >= 0 && cf <= 8 && cr >= 0 && cr <= 9) {
              const to = cr * 9 + cf;
              const dest = b[to];
              if (dest === 0) {
                out[count++] = (sq << 7) | to;
              } else {
                if ((dest > 0 ? 1 : -1) !== side) {
                  out[count++] = (sq << 7) | to;
                }
                break;
              }
              cf += df;
              cr += dr;
            }
          }
          break;
        }

        case C: {
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const [df, dr] of dirs) {
            let cf = f + df, cr = r + dr;
            let screen = false;
            while (cf >= 0 && cf <= 8 && cr >= 0 && cr <= 9) {
              const to = cr * 9 + cf;
              const dest = b[to];
              if (!screen) {
                if (dest === 0) {
                  out[count++] = (sq << 7) | to;
                } else {
                  screen = true;
                }
              } else {
                if (dest !== 0) {
                  if ((dest > 0 ? 1 : -1) !== side) {
                    out[count++] = (sq << 7) | to;
                  }
                  break;
                }
              }
              cf += df;
              cr += dr;
            }
          }
          break;
        }

        case P: {
          const dr = side === 1 ? 1 : -1;
          const nr = r + dr;
          if (nr >= 0 && nr <= 9) {
            const to = nr * 9 + f;
            const dest = b[to];
            if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
              out[count++] = (sq << 7) | to;
            }
          }
          const crossed = side === 1 ? (r >= 5) : (r <= 4);
          if (crossed) {
            if (f > 0) {
              const to = r * 9 + (f - 1);
              const dest = b[to];
              if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
                out[count++] = (sq << 7) | to;
              }
            }
            if (f < 8) {
              const to = r * 9 + (f + 1);
              const dest = b[to];
              if (dest === 0 || (dest > 0 ? 1 : -1) !== side) {
                out[count++] = (sq << 7) | to;
              }
            }
          }
          break;
        }
      }
    }
    out.length = count;
    return out;
  }

  XQ.pseudoMoves = pseudoMoves;

  function makeMove(pos, m) {
    const from = (m >> 7) & 0x7F;
    const to = m & 0x7F;
    const p = pos.board[from];
    const captured = pos.board[to];

    const undo = {
      m,
      piece: p,
      captured,
      hashLo: pos.hashLo,
      hashHi: pos.hashHi,
      halfmove: pos.halfmove,
      kingSq1: pos.kingSq[1],
      kingSqM1: pos.kingSq[-1]
    };

    // Update board
    pos.board[from] = 0;
    pos.board[to] = p;

    // Update king position
    if (p === K) pos.kingSq[1] = to;
    else if (p === -K) pos.kingSq[-1] = to;

    // Update Zobrist hash
    let lo = pos.hashLo, hi = pos.hashHi;
    const fromIdx = from * 15 + pidx(p);
    const toIdx = to * 15 + pidx(p);
    lo ^= ZOBRIST_PIECES_LO[fromIdx] ^ ZOBRIST_PIECES_LO[toIdx];
    hi ^= ZOBRIST_PIECES_HI[fromIdx] ^ ZOBRIST_PIECES_HI[toIdx];

    if (captured !== 0) {
      const capIdx = to * 15 + pidx(captured);
      lo ^= ZOBRIST_PIECES_LO[capIdx];
      hi ^= ZOBRIST_PIECES_HI[capIdx];
      pos.halfmove = 0;
    } else {
      pos.halfmove++;
    }

    lo ^= ZOBRIST_SIDE_LO;
    hi ^= ZOBRIST_SIDE_HI;
    pos.hashLo = lo >>> 0;
    pos.hashHi = hi >>> 0;

    pos.side = -pos.side;
    pos.ply++;

    return undo;
  }

  XQ.makeMove = makeMove;

  function unmakeMove(pos, m, undo) {
    const from = (m >> 7) & 0x7F;
    const to = m & 0x7F;

    pos.board[from] = undo.piece;
    pos.board[to] = undo.captured;
    pos.hashLo = undo.hashLo;
    pos.hashHi = undo.hashHi;
    pos.halfmove = undo.halfmove;
    pos.kingSq[1] = undo.kingSq1;
    pos.kingSq[-1] = undo.kingSqM1;

    pos.side = -pos.side;
    pos.ply--;
  }

  XQ.unmakeMove = unmakeMove;

  function applyMove(pos, m) {
    const next = clonePos(pos);
    makeMove(next, m);
    return next;
  }

  XQ.applyMove = applyMove;

  function legalMoves(pos) {
    const pm = pseudoMoves(pos);
    const result = [];
    const mover = pos.side;
    for (let i = 0; i < pm.length; i++) {
      const m = pm[i];
      const undo = makeMove(pos, m);
      if (!inCheck(pos, mover)) {
        result.push(m);
      }
      unmakeMove(pos, m, undo);
    }
    return result;
  }

  XQ.legalMoves = legalMoves;

  function movesFrom(pos, sq) {
    const p = pos.board[sq];
    if (p === 0) return { quiet: [], captures: [] };
    const side = p > 0 ? 1 : -1;
    // Save state if pos.side !== side
    const origSide = pos.side;
    pos.side = side;
    const lm = legalMoves(pos);
    pos.side = origSide;

    const quiet = [], captures = [];
    for (const m of lm) {
      const from = (m >> 7) & 0x7F;
      if (from === sq) {
        const to = m & 0x7F;
        if (pos.board[to] !== 0) captures.push(to);
        else quiet.push(to);
      }
    }
    return { quiet, captures };
  }

  XQ.movesFrom = movesFrom;

  // Has attacking material left? (R, H, C, P)
  function hasAttackingMaterial(pos) {
    let redAttack = 0, blackAttack = 0;
    for (let sq = 0; sq < 90; sq++) {
      const p = pos.board[sq];
      if (p !== 0) {
        const t = Math.abs(p);
        if (t === R || t === H || t === C || t === P) {
          if (p > 0) redAttack++;
          else blackAttack++;
        }
      }
    }
    return { red: redAttack, black: blackAttack };
  }

  function gameStatus(pos, history = [], rules = { perpetual: true, moveLimit: true }) {
    const lm = legalMoves(pos);

    // 1. No legal moves -> checkmate or stalemate (side to move loses)
    if (lm.length === 0) {
      const checked = inCheck(pos, pos.side);
      const winner = pos.side === 1 ? 'black' : 'red';
      const loser = pos.side === 1 ? 'red' : 'black';
      return {
        over: true,
        status: 'win',
        winner,
        loser,
        reason: checked ? 'checkmate' : 'stalemate'
      };
    }

    // 2. Threefold repetition
    const curLo = pos.hashLo, curHi = pos.hashHi, curSide = pos.side;
    let repCount = 1;
    const repIndices = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.hashLo === curLo && h.hashHi === curHi && h.side === curSide) {
        repCount++;
        repIndices.push(i);
        if (repCount >= 3) break;
      }
    }

    if (repCount >= 3) {
      if (rules && rules.perpetual) {
        // Check perpetual check between first matched occurrence and now
        const firstIdx = repIndices[repIndices.length - 1];
        let redAllCheck = true, blackAllCheck = true;
        let redMoves = 0, blackMoves = 0;
        for (let i = firstIdx; i < history.length; i++) {
          const h = history[i];
          if (h.side === 1) {
            redMoves++;
            if (!h.gaveCheck) redAllCheck = false;
          } else {
            blackMoves++;
            if (!h.gaveCheck) blackAllCheck = false;
          }
        }
        if (redMoves > 0 && redAllCheck && (!blackAllCheck || blackMoves === 0)) {
          return { over: true, status: 'win', winner: 'black', loser: 'red', reason: 'perpetual_check' };
        }
        if (blackMoves > 0 && blackAllCheck && (!redAllCheck || redMoves === 0)) {
          return { over: true, status: 'win', winner: 'red', loser: 'black', reason: 'perpetual_check' };
        }
      }
      return { over: true, status: 'draw', winner: null, loser: null, reason: 'repetition' };
    }

    // 3. 60 moves without capture (120 plies)
    if (rules && rules.moveLimit && pos.halfmove >= 120) {
      return { over: true, status: 'draw', winner: null, loser: null, reason: 'move_limit' };
    }

    // 4. Insufficient material
    const atk = hasAttackingMaterial(pos);
    if (atk.red === 0 && atk.black === 0) {
      return { over: true, status: 'draw', winner: null, loser: null, reason: 'no_material' };
    }

    return { over: false, status: null, winner: null, loser: null, reason: null };
  }

  XQ.gameStatus = gameStatus;
}

if (typeof window !== 'undefined') {
  window.XQ = window.XQ || {};
  defineRules(window.XQ);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defineRules;
}
