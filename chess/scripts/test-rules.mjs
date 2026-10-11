#!/usr/bin/env node
import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const ChessRules = require('../src/rules.js');

console.log('Running Chess Rules Unit Tests...');

// 1. Castling conditions
// Condition 1: King moved
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const m = ChessRules.legalMoves(s).find(m => m.from === 4 && m.to === 6);
  assert(m, 'Initial castling should be legal');
  const s2 = ChessRules.make(s, { from: 4, to: 5, piece: 6, captured: 0, promo: 0, flags: 0 }); // Ke2 or Kf1
  const s3 = ChessRules.make(s2, { from: 60, to: 61, piece: -6, captured: 0, promo: 0, flags: 0 });
  const s4 = ChessRules.make(s3, { from: 5, to: 4, piece: 6, captured: 0, promo: 0, flags: 0 }); // King back to e1
  const m2 = ChessRules.legalMoves(s4).find(m => m.from === 4 && m.to === 6);
  assert(!m2, 'Castling illegal after king moved and returned');
}

// Condition 2: Rook moved
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const s2 = ChessRules.make(s, { from: 7, to: 15, piece: 4, captured: 0, promo: 0, flags: 0 }); // Rh2
  const s3 = ChessRules.make(s2, { from: 60, to: 61, piece: -6, captured: 0, promo: 0, flags: 0 });
  const s4 = ChessRules.make(s3, { from: 15, to: 7, piece: 4, captured: 0, promo: 0, flags: 0 }); // Rh1
  assert(!(s4.castling & 1), 'Castling right for h1 rook lost after rook moved');
  const m = ChessRules.legalMoves(s4).find(m => m.from === 4 && m.to === 6);
  assert(!m, 'Castling illegal after rook moved and returned');
}

// Condition 3: Pieces between king and rook
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/8/8/R1B1K2R w KQkq - 0 1'); // Bishop on c1
  const mO_O_O = ChessRules.legalMoves(s).find(m => m.from === 4 && m.to === 2);
  assert(!mO_O_O, 'Queenside castling blocked by c1 piece');
}

// Condition 4: King in check
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1'); // Black rook on e3 checks e1 king
  assert(ChessRules.inCheck(s, 1), 'King should be in check');
  const m = ChessRules.legalMoves(s).find(m => (m.flags & ChessRules.FLAGS.CASTLE_K) || (m.flags & ChessRules.FLAGS.CASTLE_Q));
  assert(!m, 'Castling illegal while in check');
}

// Condition 5: King passes through or lands on attacked square
{
  // f1 attacked by black bishop on c4
  const s = ChessRules.fromFEN('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1');
  const mK = ChessRules.legalMoves(s).find(m => m.from === 4 && m.to === 6);
  assert(!mK, 'Castling illegal when king passes through attacked f1 square');

  // g1 attacked by black bishop on b6
  const s2 = ChessRules.fromFEN('r3k2r/8/1b6/8/8/8/8/R3K2R w KQkq - 0 1');
  const mK2 = ChessRules.legalMoves(s2).find(m => m.from === 4 && m.to === 6);
  assert(!mK2, 'Castling illegal when king lands on attacked g1 square');
}

// Rook passes through attacked b1 square: allowed!
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/1r6/8/R3K2R w KQkq - 0 1'); // Black rook attacks b1
  const mQ = ChessRules.legalMoves(s).find(m => m.from === 4 && m.to === 2);
  assert(mQ, 'Queenside castling allowed even when b1 is attacked by enemy rook');
}

// Castling right lost after rook captured on home square
{
  const s = ChessRules.fromFEN('r3k2r/8/8/8/8/8/7q/R3K2R b KQkq - 0 1'); // Black queen takes h1 rook
  const s2 = ChessRules.make(s, { from: 15, to: 7, piece: -5, captured: 4, promo: 0, flags: ChessRules.FLAGS.CAPTURE });
  assert(!(s2.castling & 1), 'White O-O right lost after h1 rook captured');
}

// En passant only allowed immediately
{
  const s0 = ChessRules.fromFEN('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
  const s1 = ChessRules.fromFEN('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
  const epMove = ChessRules.legalMoves(s1).find(m => m.flags & ChessRules.FLAGS.EP);
  assert(epMove, 'En passant move must exist immediately after double push');
  // Play another move instead of capturing en passant
  const s2 = ChessRules.make(s1, { from: 9, to: 17, piece: 1, captured: 0, promo: 0, flags: 0 }); // b3
  const s3 = ChessRules.make(s2, { from: 57, to: 42, piece: -2, captured: 0, promo: 0, flags: 0 }); // Nc6
  assert(s3.ep === -1, 'EP square must be reset after next move');
  const epExpired = ChessRules.legalMoves(s3).find(m => m.flags & ChessRules.FLAGS.EP);
  assert(!epExpired, 'En passant no longer legal after delay');
}

// En passant horizontal pin rejected
{
  // 8/8/8/K2pP2r/8/8/8/8 w - d6 0 1: White King at a5, Black Rook at h5, White pawn at e5, Black pawn at d5
  // If e5xd6 e.p., rank 5 is open from h5 to a5, exposing King to check!
  const s = ChessRules.fromFEN('8/8/8/K2pP2r/8/8/8/8 w - d6 0 1');
  const epMove = ChessRules.legalMoves(s).find(m => m.flags & ChessRules.FLAGS.EP);
  assert(!epMove, 'En passant must be rejected when horizontal pin on rank exposes king');
}

// Promotion to each piece + capture promotion
{
  const s = ChessRules.fromFEN('k7/4P3/8/8/8/8/8/4K3 w - - 0 1');
  const legals = ChessRules.legalMoves(s);
  const promos = legals.filter(m => m.from === 52 && (m.flags & ChessRules.FLAGS.PROMO));
  assert.strictEqual(promos.length, 4, 'Must have 4 promotions (Q, R, B, N)');

  // Capture promotion
  const sCap = ChessRules.fromFEN('3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1');
  const capPromos = ChessRules.legalMoves(sCap).filter(m => m.to === 59 && (m.flags & ChessRules.FLAGS.PROMO));
  assert.strictEqual(capPromos.length, 4, 'Must have 4 capture promotions');
}

// Scholar's mate = checkmate
{
  // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
  const s = ChessRules.fromFEN('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  const st = ChessRules.status(s);
  assert.strictEqual(st.over, true);
  assert.strictEqual(st.reason, 'checkmate');
  assert.strictEqual(st.result, '1-0');
}

// Known stalemate
{
  const s = ChessRules.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const st = ChessRules.status(s);
  assert.strictEqual(st.over, true);
  assert.strictEqual(st.reason, 'stalemate');
  assert.strictEqual(st.result, '1/2-1/2');
}

// 50-move rule at halfmove 100
{
  const s = ChessRules.fromFEN('4k3/8/8/8/8/8/4Q3/4K3 w - - 100 50');
  const st = ChessRules.status(s);
  assert.strictEqual(st.over, true);
  assert.strictEqual(st.reason, 'fifty');
}

// Insufficient material cases
{
  assert(ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1')), 'K vs K');
  assert(ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/8/8/8/8/8/4B3/4K3 w - - 0 1')), 'K+B vs K');
  assert(ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/8/8/8/8/8/4N3/4K3 w - - 0 1')), 'K+N vs K');
  // K+B vs K+B same color
  assert(ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/3b4/8/8/8/8/4B3/4K3 w - - 0 1')), 'K+B vs K+B same color squares');
  // K+B vs K+B opposite color: NOT insufficient
  assert(!ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/4b3/8/8/8/8/4B3/4K3 w - - 0 1')), 'K+B vs K+B diff color squares');
  // K+B+B same side: NOT auto-draw
  assert(!ChessRules.insufficientMaterial(ChessRules.fromFEN('4k3/8/8/8/8/8/3BB3/4K3 w - - 0 1')), 'K+B+B vs K');
}

// Threefold repetition via knight shuffle
{
  let s = ChessRules.initial();
  const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
  for (const u of moves) {
    const m = ChessRules.fromUCI(s, u);
    s = ChessRules.make(s, m);
  }
  const st = ChessRules.status(s);
  assert.strictEqual(st.over, true, 'Threefold repetition should trigger draw');
  assert.strictEqual(st.reason, 'threefold');
}

// SAN disambiguation
{
  // Nbd7
  const s = ChessRules.fromFEN('r2qkb1r/pp1npppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 0 5');
  // R1a3
  const sR = ChessRules.fromFEN('7k/8/8/8/8/R7/8/R6K w - - 0 1');
  const mR = ChessRules.fromUCI(sR, 'a1a2');
  assert(ChessRules.toSAN(sR, mR).startsWith('R1a2'), 'Rank disambiguation for rooks');

  // Disambiguation file
  const sR2 = ChessRules.fromFEN('7k/8/8/8/8/2K5/8/R6R w - - 0 1');
  const mR2 = ChessRules.fromUCI(sR2, 'a1e1');
  assert(ChessRules.toSAN(sR2, mR2).startsWith('Rae1'), 'File disambiguation for rooks');
}

// FEN round trip
{
  const testFens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  ];
  for (const fen of testFens) {
    const s = ChessRules.fromFEN(fen);
    const outFen = ChessRules.toFEN(s);
    assert.strictEqual(outFen, fen, `FEN round trip: ${fen}`);
  }
}

console.log('All 15 named rule unit tests passed successfully!\n');
