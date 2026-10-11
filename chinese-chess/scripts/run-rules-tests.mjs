#!/usr/bin/env node
// Test runner for Cờ Tướng rules & notation in Node.js
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesCode = readFileSync(resolve(__dirname, '../src/rules.js'), 'utf8');
const notationCode = readFileSync(resolve(__dirname, '../src/notation.js'), 'utf8');

const sandbox = { console, Int8Array, Uint8Array, Uint32Array, Math };
vm.createContext(sandbox);
vm.runInContext(rulesCode, sandbox);
vm.runInContext(notationCode, sandbox);

const XQ = {};
sandbox.defineRules(XQ);
sandbox.defineNotation(XQ);

console.log('--- Testing Cờ Tướng Rules & Notation ---');
let passed = 0, failed = 0;

function assert(condition, desc) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = XQ.legalMoves(pos);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (let i = 0; i < moves.length; i++) {
    const undo = XQ.makeMove(pos, moves[i]);
    nodes += perft(pos, depth - 1);
    XQ.unmakeMove(pos, moves[i], undo);
  }
  return nodes;
}

// 1. Perft tests
console.log('\n1. Perft from START_FEN:');
const startPos = XQ.parseFen(XQ.START_FEN);
const p1 = perft(startPos, 1);
assert(p1 === 44, `Perft(1) = 44 (got ${p1})`);

const p2 = perft(startPos, 2);
assert(p2 === 1920, `Perft(2) = 1,920 (got ${p2})`);

const p3 = perft(startPos, 3);
assert(p3 === 79666, `Perft(3) = 79,666 (got ${p3})`);

console.log('Running Perft(4)...');
const t0 = Date.now();
const p4 = perft(startPos, 4);
const dt = Date.now() - t0;
assert(p4 === 3290240, `Perft(4) = 3,290,240 (got ${p4} in ${dt}ms)`);

// 2. Flying General test
console.log('\n2. Flying General:');
// FEN: 3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1
// Black king at d9 (index 84). Red king at e0 (index 4).
// Red king can move to e1 (index 13) or f0 (index 5).
// Moving to d0 (index 3) is illegal because both kings would be on file d with no pieces between!
const fgPos = XQ.parseFen('3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
const fgMoves = XQ.legalMoves(fgPos).map(XQ.moveToIccs).sort();
assert(
  fgMoves.length === 2 && fgMoves.includes('e0e1') && fgMoves.includes('e0f0'),
  `Flying general: legal moves exactly e0e1, e0f0 (got ${fgMoves.join(', ')})`
);

// 3. Checkmate test
console.log('\n3. Checkmate:');
const cmPos = XQ.parseFen('R3k4/R8/9/9/9/9/9/9/9/3K5 b - - 0 1');
const cmStatus = XQ.gameStatus(cmPos);
assert(
  cmStatus.over && cmStatus.status === 'win' && cmStatus.winner === 'red' && cmStatus.reason === 'checkmate',
  `Checkmate detected: ${JSON.stringify(cmStatus)}`
);

// 4. Stalemate loss test
console.log('\n4. Stalemate:');
// Position where black king has no moves and not in check:
// Red king at e8 (index 76). Black king trapped at d9 (index 84), but not attacked directly.
// Let's create a clear stalemate:
// Black King at d9. Red King at d7. Advisor at e9 blocks d9->e9? No, kings can't face.
// If Black king at e9 (index 85). Red King at e7. Red Soldier at d9, f9. Red Chariot pinning?
// Or simply Black King at d9, Red King at f9 (wait, palace is d-f).
// Black King at d9. Red King at d7 (wait, flying general: if d8 has a red pawn: then not flying general).
// Let's set up: Black King at d9. Red King at e7. Red Soldier at d8, e9, e8.
// Board: 3k5/3P1P3/4K4/...
const smPos = XQ.parseFen('3k5/3P5/4K4/9/9/9/9/9/9/9 b - - 0 1');
// At d9: king can go to e9 (vacant? but e7 king attacks e7-e9? no, King moves 1 orthogonal).
// Let's test with Black king at e9, Red King at e7, Red Soldier at e8.
// King at e9 can go to d9, f9, e8 (occupied by Red Soldier).
// If Red Rook at a9, d9 and f9 are attacked! So Black King at e9 is NOT in check (soldier at e8 moves up, attacks e9!).
// Wait, soldier at e8 (rank 8) moving up attacks e9! So king is in check.
// To make stalemate without check:
// Black King at e9. Red Rook at a9 (attacks d9 and f9, but blocked by King at e9? Rook from a9 attacks b9, c9, d9. Cannot pass e9).
// What if Black King is at d9. Red Rook at a9. That's check!
// Let's construct standard Xiangqi stalemate:
// Black King at d9. Red King at d7. Red Advisor at d8 (breaks flying general).
// Black King cannot move to d8 (friendly/enemy piece).
// Can Black King move to e9? Put Red Soldier at e8 (Red soldier at e8 attacks e9!).
// But Red Soldier at e8 does NOT attack d9.
// And Black King at d9 is NOT in check! (King at d7 blocked by d8, e8 soldier attacks e9, not d9).
// So Black has 0 legal moves and is NOT in check!
const smTestPos = XQ.parseFen('3k5/3AP4/3K5/9/9/9/9/9/9/9 b - - 0 1');
const smStatus = XQ.gameStatus(smTestPos);
assert(
  smStatus.over && smStatus.status === 'win' && smStatus.winner === 'red' && smStatus.reason === 'stalemate',
  `Stalemate loss: ${JSON.stringify(smStatus)}`
);

// 5. Perpetual check test
console.log('\n5. Perpetual check:');
// History where Red checks every move and repeats 3 times
const repPos = XQ.parseFen(XQ.START_FEN);
const hLo = repPos.hashLo, hHi = repPos.hashHi;
const histChecks = [
  { hashLo: hLo, hashHi: hHi, side: 1, gaveCheck: true, capture: 0 },
  { hashLo: 123, hashHi: 456, side: -1, gaveCheck: false, capture: 0 },
  { hashLo: hLo, hashHi: hHi, side: 1, gaveCheck: true, capture: 0 },
  { hashLo: 123, hashHi: 456, side: -1, gaveCheck: false, capture: 0 },
];
const perpStatus = XQ.gameStatus(repPos, histChecks, { perpetual: true, moveLimit: true });
assert(
  perpStatus.over && perpStatus.status === 'win' && perpStatus.winner === 'black' && perpStatus.reason === 'perpetual_check',
  `Perpetual check loses for checking side: ${JSON.stringify(perpStatus)}`
);

const perpOff = XQ.gameStatus(repPos, histChecks, { perpetual: false, moveLimit: true });
assert(
  perpOff.over && perpOff.status === 'draw' && perpOff.reason === 'repetition',
  `Perpetual check off results in draw: ${JSON.stringify(perpOff)}`
);

// 6. Move-limit draw (60 moves = 120 plies)
console.log('\n6. 60-move limit:');
const mlPos = XQ.parseFen(XQ.START_FEN);
mlPos.halfmove = 120;
const mlStatus = XQ.gameStatus(mlPos, [], { perpetual: true, moveLimit: true });
assert(
  mlStatus.over && mlStatus.status === 'draw' && mlStatus.reason === 'move_limit',
  `Move limit draw at 120 plies: ${JSON.stringify(mlStatus)}`
);

// 7. Insufficient material
console.log('\n7. Insufficient material:');
// Kings + Advisors + Elephants only
const noMatPos = XQ.parseFen('2b1k1b2/4a4/9/9/9/9/9/9/4A4/2B1K1B2 w - - 0 1');
const noMatStatus = XQ.gameStatus(noMatPos);
assert(
  noMatStatus.over && noMatStatus.status === 'draw' && noMatStatus.reason === 'no_material',
  `No material draw: ${JSON.stringify(noMatStatus)}`
);

// 8. Notation test cases from §4.4
console.log('\n8. Notation:');
const nPos = XQ.parseFen(XQ.START_FEN);
// Red h2e2 -> P2-5 / C2=5
const m1 = XQ.iccsToMove('h2e2');
assert(XQ.notation(nPos, m1, 'vi') === 'P2-5', `h2e2 vi is P2-5 (got ${XQ.notation(nPos, m1, 'vi')})`);
assert(XQ.notation(nPos, m1, 'en') === 'C2=5', `h2e2 en is C2=5 (got ${XQ.notation(nPos, m1, 'en')})`);

// Red h0g2 -> M2.3 / H2+3
const m2 = XQ.iccsToMove('h0g2');
assert(XQ.notation(nPos, m2, 'vi') === 'M2.3', `h0g2 vi is M2.3 (got ${XQ.notation(nPos, m2, 'vi')})`);
assert(XQ.notation(nPos, m2, 'en') === 'H2+3', `h0g2 en is H2+3 (got ${XQ.notation(nPos, m2, 'en')})`);

// Red b0c2 -> M8.7 / H8+7
const m3 = XQ.iccsToMove('b0c2');
assert(XQ.notation(nPos, m3, 'vi') === 'M8.7', `b0c2 vi is M8.7 (got ${XQ.notation(nPos, m3, 'vi')})`);
assert(XQ.notation(nPos, m3, 'en') === 'H8+7', `b0c2 en is H8+7 (got ${XQ.notation(nPos, m3, 'en')})`);

// Black h9g7 -> M8.7 / H8+7
const nPosBlack = XQ.clonePos(nPos);
nPosBlack.side = -1;
const m4 = XQ.iccsToMove('h9g7');
assert(XQ.notation(nPosBlack, m4, 'vi') === 'M8.7', `h9g7 (Black) vi is M8.7 (got ${XQ.notation(nPosBlack, m4, 'vi')})`);
assert(XQ.notation(nPosBlack, m4, 'en') === 'H8+7', `h9g7 (Black) en is H8+7 (got ${XQ.notation(nPosBlack, m4, 'en')})`);

// Red a0a1 -> X9.1 / R9+1
const m5 = XQ.iccsToMove('a0a1');
assert(XQ.notation(nPos, m5, 'vi') === 'X9.1', `a0a1 vi is X9.1 (got ${XQ.notation(nPos, m5, 'vi')})`);
assert(XQ.notation(nPos, m5, 'en') === 'R9+1', `a0a1 en is R9+1 (got ${XQ.notation(nPos, m5, 'en')})`);

// Doubled pieces on file: two chariots on file a (a0, a3)
const doublePos = XQ.parseFen('r8/9/9/9/9/9/R8/9/9/R3K3 w - - 0 1');
// Chariots at a0 (rank 0) and a3 (rank 3).
// Move a3a4 (front chariot advances 1):
const mDoubleFront = XQ.iccsToMove('a3a4');
assert(XQ.notation(doublePos, mDoubleFront, 'vi') === 'Xt.1', `Doubled front chariot vi is Xt.1 (got ${XQ.notation(doublePos, mDoubleFront, 'vi')})`);
assert(XQ.notation(doublePos, mDoubleFront, 'en') === '+R+1', `Doubled front chariot en is +R+1 (got ${XQ.notation(doublePos, mDoubleFront, 'en')})`);

// 9. FEN round-trip & Zobrist incremental consistency
console.log('\n9. FEN round-trip & Zobrist:');
const fenOriginal = XQ.START_FEN;
const fenPos = XQ.parseFen(fenOriginal);
const fenExport = XQ.toFen(fenPos);
assert(fenOriginal === fenExport, `FEN round-trip matches: ${fenExport}`);

// Random playout to verify incremental zobrist == recomputed
let playoutPos = XQ.parseFen(XQ.START_FEN);
let zobristOk = true;
for (let step = 0; step < 100; step++) {
  const moves = XQ.legalMoves(playoutPos);
  if (moves.length === 0) break;
  const m = moves[Math.floor(Math.random() * moves.length)];
  XQ.makeMove(playoutPos, m);
  const incLo = playoutPos.hashLo, incHi = playoutPos.hashHi;
  XQ.recomputeHash(playoutPos);
  if (incLo !== playoutPos.hashLo || incHi !== playoutPos.hashHi) {
    zobristOk = false;
    break;
  }
}
assert(zobristOk, 'Incremental Zobrist matches recomputed hash over 100 random moves');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
