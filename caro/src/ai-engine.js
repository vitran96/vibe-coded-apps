'use strict';
// 05 AI engine (pure; runs inside an inline Web Worker)
// ============================================================
function createAI() {
  // pattern types: 0 none, 1 two, 2 open two, 3 three, 4 open three, 5 four, 6 open four, 7 five
  const BASE = [0, 10, 100, 150, 1000, 10000, 100000, 1000000];
  const DX = [1, 0, 1, 1], DY = [0, 1, 1, -1];
  const WIN = 1e9;
  const tables = new Map();
  const zobrist = new Map();

  function getTable(rules) {
    const caro = rules.mode === 'caro', exact = !caro && !!rules.exactFive, eb = caro && !!rules.edgeBlocks;
    const key = (caro ? 'c' : 'g') + (exact ? 'x' : '') + (eb ? 'e' : '');
    let t = tables.get(key);
    if (!t) { t = { tbl: new Int8Array(1 << 20).fill(-1), caro, exact, eb, keepEdge: caro && !eb }; tables.set(key, t); }
    return t;
  }

  // Classify an 11-cell line (centre = own stone). Cells: 0 empty, 1 own, 2 opponent/block, 3 board edge.
  // Rule-aware: a "four" only counts if completing it gives a five that is legal under the current rules.
  function classify(code, T) {
    const a = new Int8Array(11);
    for (let pos = 0; pos < 11; pos++) {
      if (pos === 5) { a[5] = 1; continue; }
      a[pos] = (code >> (2 * (pos < 5 ? pos : pos - 1))) & 3;
    }
    const blocked = v => v === 2 || (v === 3 && T.eb);
    const five = () => {
      let l = 5, r = 5;
      while (l > 0 && a[l - 1] === 1) l--;
      while (r < 10 && a[r + 1] === 1) r++;
      const len = r - l + 1;
      if (len < 5) return false;
      if (!T.caro) return T.exact ? len === 5 : true;
      return !(blocked(l > 0 ? a[l - 1] : 0) && blocked(r < 10 ? a[r + 1] : 0));
    };
    const wins = () => {
      let n = 0;
      for (let i = 1; i <= 9; i++) if (a[i] === 0) { a[i] = 1; if (five()) n++; a[i] = 0; }
      return n;
    };
    const threeLvl = () => {
      let best = 0;
      for (let i = 1; i <= 9; i++) if (a[i] === 0) {
        a[i] = 1; const w = wins(); a[i] = 0;
        if (w >= 2) return 4;
        if (w === 1) best = 3;
      }
      return best;
    };
    if (five()) return 7;
    const w = wins();
    if (w >= 2) return 6;
    if (w === 1) return 5;
    const t3 = threeLvl();
    if (t3) return t3;
    let best = 0;
    for (let i = 1; i <= 9; i++) if (a[i] === 0) {
      a[i] = 1; const t = threeLvl(); a[i] = 0;
      if (t === 4) return 2;
      if (t === 3) best = 1;
    }
    return best;
  }

  // ----- search state -----
  let N, B, T, tbl, keepEdge, pt, S, C4, O4, nb, Z, h1, h2, minX, maxX, minY, maxY;
  let nodes = 0, deadline = 0, aborted = false;
  let gFive = false, gWin2 = false, gFour = false;
  const tt = new Map();

  function lineCode(x, y, d, p) {
    const dx = DX[d], dy = DY[d];
    let c = 0;
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 1; k <= 5; k++) {
        const cx = x + s * k * dx, cy = y + s * k * dy;
        let v;
        if (cx < 0 || cy < 0 || cx >= N || cy >= N) v = keepEdge ? 3 : 2;
        else { const b = B[cy * N + cx]; v = b === 0 ? 0 : b === p ? 1 : 2; }
        let pos = 5 + s * k;
        c |= v << (2 * (pos < 5 ? pos : pos - 1));
        if (v >= 2) { // canonical form: everything beyond a block is the same block
          for (let k2 = k + 1; k2 <= 5; k2++) { pos = 5 + s * k2; c |= v << (2 * (pos < 5 ? pos : pos - 1)); }
          break;
        }
      }
    }
    return c;
  }
  function typeAt(x, y, d, p) {
    const c = lineCode(x, y, d, p);
    let t = tbl[c];
    if (t < 0) { t = classify(c, T); tbl[c] = t; }
    return t;
  }
  function addC(p, t, sgn) { S[p] += sgn * BASE[t]; if (t >= 5) C4[p] += sgn; if (t >= 6) O4[p] += sgn; }
  function refreshLines(x, y, skipCenter) {
    for (let d = 0; d < 4; d++) {
      for (let k = -5; k <= 5; k++) {
        if (k === 0 && skipCenter) continue;
        const cx = x + k * DX[d], cy = y + k * DY[d];
        if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
        const j = cy * N + cx, v = B[j];
        if (!v) continue;
        const old = pt[j * 4 + d], nt = typeAt(cx, cy, d, v);
        if (old !== nt) { addC(v, old, -1); addC(v, nt, 1); pt[j * 4 + d] = nt; }
      }
    }
  }
  function touch(i, p, delta) {
    h1 ^= Z[p * N * N + i]; h2 ^= Z[(p + 2) * N * N + i];
    const x = i % N, y = (i / N) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < N && cy < N) nb[cy * N + cx] += delta;
    }
    if (delta > 0) {
      minX = Math.min(minX, Math.max(0, x - 2)); maxX = Math.max(maxX, Math.min(N - 1, x + 2));
      minY = Math.min(minY, Math.max(0, y - 2)); maxY = Math.max(maxY, Math.min(N - 1, y + 2));
    }
  }
  function place(i, p) { B[i] = p; touch(i, p, 1); refreshLines(i % N, (i / N) | 0, false); }
  function unplace(i) {
    const p = B[i];
    for (let d = 0; d < 4; d++) { addC(p, pt[i * 4 + d], -1); pt[i * 4 + d] = 0; }
    B[i] = 0; touch(i, p, -1); refreshLines(i % N, (i / N) | 0, true);
  }

  function init(board, n, rules) {
    N = n; B = Int8Array.from(board); T = getTable(rules); tbl = T.tbl; keepEdge = T.keepEdge;
    pt = new Int8Array(N * N * 4); S = [0, 0, 0]; C4 = [0, 0, 0]; O4 = [0, 0, 0]; nb = new Int16Array(N * N);
    Z = zobrist.get(N);
    if (!Z) { Z = new Int32Array(5 * N * N); for (let i = 0; i < Z.length; i++) Z[i] = (Math.random() * 4294967296) | 0; zobrist.set(N, Z); }
    h1 = 0; h2 = 0; minX = N; minY = N; maxX = -1; maxY = -1;
    let stones = 0;
    for (let i = 0; i < N * N; i++) if (B[i]) { touch(i, B[i], 1); stones++; }
    for (let i = 0; i < N * N; i++) if (B[i]) {
      for (let d = 0; d < 4; d++) { const t = typeAt(i % N, (i / N) | 0, d, B[i]); pt[i * 4 + d] = t; addC(B[i], t, 1); }
    }
    tt.clear();
    return stones;
  }

  function cands() {
    const out = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = y * N + x;
      if (!B[i] && nb[i] > 0) out.push(i);
    }
    return out;
  }
  // Score of playing empty cell i for player p. Sets gFive / gWin2 (open four or double four) / gFour.
  function cellScore(i, p) {
    const x = i % N, y = (i / N) | 0;
    let s = 0, f = 0, o3 = 0, o4 = 0, five = false;
    for (let d = 0; d < 4; d++) {
      const t = typeAt(x, y, d, p);
      s += BASE[t];
      if (t === 7) five = true; else if (t === 6) o4++; else if (t === 5) f++; else if (t === 4) o3++;
    }
    if (f >= 2 || (f && o3)) s += 50000; else if (o3 >= 2) s += 8000;
    gFive = five; gWin2 = o4 > 0 || f >= 2; gFour = o4 > 0 || f > 0;
    return s;
  }
  function timeUp() {
    if ((++nodes & 127) === 0 && performance.now() > deadline) aborted = true;
    return aborted;
  }

  // ----- VCF: victory by continuous fours -----
  function winCellsThrough(i, p, firstOnly) {
    const x = i % N, y = (i / N) | 0, out = [];
    for (let d = 0; d < 4; d++) for (let k = -4; k <= 4; k++) {
      if (!k) continue;
      const cx = x + k * DX[d], cy = y + k * DY[d];
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
      const j = cy * N + cx;
      if (B[j] || out.includes(j)) continue;
      if (typeAt(cx, cy, d, p) === 7) { out.push(j); if (firstOnly) return out; }
    }
    return out;
  }
  function vcf(p, depth) {
    if (depth <= 0 || timeUp()) return -1;
    const q = 3 - p, fours = [];
    for (const i of cands()) {
      const s = cellScore(i, p);
      if (gFive) return i;
      if (gFour) fours.push([i, s]);
    }
    fours.sort((a, b) => b[1] - a[1]);
    for (const [i] of fours) {
      place(i, p);
      const w = winCellsThrough(i, p, false);
      let ok = false;
      if (w.length >= 2) ok = true;
      else if (w.length === 1) {
        const d = w[0];
        place(d, q);
        if (!winCellsThrough(d, q, true).length) ok = vcf(p, depth - 1) >= 0;
        unplace(d);
      }
      unplace(i);
      if (ok) return i;
      if (aborted) return -1;
    }
    return -1;
  }

  // ----- negamax alpha-beta with transposition table -----
  function negamax(p, depth, alpha, beta, ply) {
    if (timeUp()) return 0;
    const q = 3 - p;
    if (C4[p] > 0) return WIN - ply;             // side to move completes a five
    if (depth <= 0) {
      if (O4[q] > 0) return -(WIN - ply - 1);    // opponent's open four can't be stopped
      return S[p] - S[q];
    }
    const key = (h1 ^ (p === 1 ? 0 : 0x5bd1e995)) | 0;
    const e = tt.get(key);
    let ttMove = -1;
    if (e && e.h2 === h2) {
      ttMove = e.m;
      if (e.d >= depth && (e.f === 0 || (e.f === 1 && e.v >= beta) || (e.f === 2 && e.v <= alpha))) return e.v;
    }
    const list = cands(), scored = [], oppFives = [];
    let myWin2 = false;
    for (const i of list) {
      const a = cellScore(i, p);
      if (gFive) return WIN - ply;
      if (gWin2) myWin2 = true;
      const dd = cellScore(i, q);
      if (gFive) oppFives.push(i);
      scored.push([i, a + dd]);
    }
    let moves;
    if (oppFives.length) {
      if (oppFives.length >= 2 && new Set(oppFives).size >= 2) return -(WIN - ply - 1);
      moves = [oppFives[0]];
    } else if (myWin2) return WIN - ply - 2;
    else {
      scored.sort((a, b) => b[1] - a[1]);
      moves = scored.slice(0, 12).map(s => s[0]);
      if (ttMove >= 0 && !B[ttMove]) { const k = moves.indexOf(ttMove); if (k > 0) moves.splice(k, 1); if (k !== 0) moves.unshift(ttMove); }
    }
    if (!moves.length) return 0;
    const a0 = alpha;
    let best = -Infinity, bestM = moves[0];
    for (const i of moves) {
      place(i, p);
      const v = -negamax(q, depth - 1, -beta, -alpha, ply + 1);
      unplace(i);
      if (aborted) return 0;
      if (v > best) { best = v; bestM = i; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (tt.size > 500000) tt.clear();
    tt.set(key, { h2, d: depth, v: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestM });
    return best;
  }

  function searchRoot(p, rootMoves, maxDepth) {
    const q = 3 - p;
    let bestMove = rootMoves[0], bestDepth = 0, bestVal = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -Infinity, best = -Infinity, bm = -1;
      const order = [bestMove, ...rootMoves.filter(m => m !== bestMove)];
      for (const i of order) {
        place(i, p);
        const v = -negamax(q, depth - 1, -Infinity, -alpha, 1);
        unplace(i);
        if (aborted) break;
        if (v > best) { best = v; bm = i; }
        if (v > alpha) alpha = v;
      }
      if (aborted) break;
      bestMove = bm; bestDepth = depth; bestVal = best;
      if (Math.abs(best) >= WIN - 100) break;   // forced result found
    }
    return { move: bestMove, depth: bestDepth, value: bestVal };
  }

  function chooseMove(msg) {
    const t0 = performance.now();
    const { board, N: n, player: p, rules, difficulty } = msg;
    const budget = msg.budget || 1000;
    const stones = init(board, n, rules);
    const q = 3 - p;
    const ret = (i, extra) => ({ x: i % N, y: (i / N) | 0, ms: Math.round(performance.now() - t0), ...extra });
    if (stones === 0) {
      const c = (N - 1) >> 1, j = difficulty === 'hard' ? 0 : 1;
      const rx = c + Math.round((Math.random() * 2 - 1) * j), ry = c + Math.round((Math.random() * 2 - 1) * j);
      return ret(ry * N + rx);
    }
    const list = cands();
    if (!list.length) { const k = B.indexOf(0); return ret(k < 0 ? 0 : k); }
    const info = list.map(i => {
      const a = cellScore(i, p), af = gFive, aw = gWin2;
      const d = cellScore(i, q), df = gFive;
      return { i, a, d, af, aw, df };
    });
    const myFive = info.find(o => o.af);
    if (myFive) return ret(myFive.i, { why: 'win' });
    const oppFive = info.filter(o => o.df);

    if (difficulty === 'easy') {
      if (oppFive.length && Math.random() < 0.6) return ret(oppFive[0].i, { why: 'block' });
      const top = info.map(o => ({ i: o.i, s: o.a + 0.5 * o.d })).sort((a, b) => b.s - a.s).slice(0, 8);
      const w = top.map(o => Math.sqrt(o.s + 1) * (0.4 + Math.random()));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < top.length; k++) { r -= w[k]; if (r <= 0) return ret(top[k].i); }
      return ret(top[0].i);
    }
    if (oppFive.length) return ret(oppFive[0].i, { why: 'block' });
    const win2 = info.find(o => o.aw);
    if (win2) return ret(win2.i, { why: 'open-four' });

    if (difficulty === 'medium') {
      const sc = info.map(o => ({ i: o.i, s: o.a + 0.9 * o.d })).sort((a, b) => b.s - a.s);
      const near = sc.filter(o => o.s >= sc[0].s * 0.92);
      return ret(near[Math.floor(Math.random() * near.length)].i);
    }

    // ---- hard ----
    nodes = 0; aborted = false;
    deadline = t0 + budget * 0.2;
    const myVcf = vcf(p, 12);
    if (myVcf >= 0) return ret(myVcf, { why: 'vcf' });
    const order = info.slice().sort((a, b) => (b.a + b.d) - (a.a + a.d));
    let rootMoves = order.slice(0, 14).map(o => o.i);
    aborted = false; deadline = performance.now() + budget * 0.25;
    if (vcf(q, 10) >= 0 && !aborted) {
      const defs = [];
      for (const o of order.slice(0, 18)) {
        place(o.i, p);
        const r = vcf(q, 10);
        unplace(o.i);
        if (aborted) break;
        if (r < 0) defs.push(o.i);
      }
      if (defs.length) rootMoves = defs.slice(0, 14);
    }
    aborted = false; deadline = t0 + budget;
    const r = searchRoot(p, rootMoves, 6);
    return ret(r.move, { depth: r.depth, value: r.value, nodes });
  }

  // exposed for tests
  function patternAt(board, n, rules, x, y, d, p) { init(board, n, rules); return typeAt(x, y, d, p); }

  return { chooseMove, patternAt };
}
/*@@PURE-END@@*/

// Tests (?test) — rules engine + a few AI sanity checks. Results go to the console.
