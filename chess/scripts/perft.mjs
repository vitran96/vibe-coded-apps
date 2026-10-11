#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ChessRules = require('../src/rules.js');

const SUITE = [
  {
    name: 'Start',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expected: [
      { depth: 1, nodes: 20 },
      { depth: 2, nodes: 400 },
      { depth: 3, nodes: 8902 },
      { depth: 4, nodes: 197281 },
    ],
  },
  {
    name: 'Kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: [
      { depth: 1, nodes: 48 },
      { depth: 2, nodes: 2039 },
      { depth: 3, nodes: 97862 },
    ],
  },
  {
    name: 'Pos 3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: [
      { depth: 1, nodes: 14 },
      { depth: 2, nodes: 191 },
      { depth: 3, nodes: 2812 },
      { depth: 4, nodes: 43238 },
    ],
  },
  {
    name: 'Pos 4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: [
      { depth: 1, nodes: 6 },
      { depth: 2, nodes: 264 },
      { depth: 3, nodes: 9467 },
    ],
  },
  {
    name: 'Pos 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: [
      { depth: 1, nodes: 44 },
      { depth: 2, nodes: 1486 },
      { depth: 3, nodes: 62379 },
    ],
  },
];

let totalPassed = 0;
let totalFailed = 0;

console.log('Running Perft Test Suite...');
const t0 = performance.now();

for (const tc of SUITE) {
  for (const { depth, nodes: expectedNodes } of tc.expected) {
    const state = ChessRules.fromFEN(tc.fen);
    const start = performance.now();
    const actualNodes = ChessRules.perft(state, depth);
    const dur = (performance.now() - start).toFixed(1);
    if (actualNodes === expectedNodes) {
      console.log(`✓ ${tc.name} depth ${depth}: ${actualNodes} nodes (${dur} ms)`);
      totalPassed++;
    } else {
      console.error(`✗ ${tc.name} depth ${depth}: got ${actualNodes}, expected ${expectedNodes}`);
      totalFailed++;
    }
  }
}

const totalDur = ((performance.now() - t0) / 1000).toFixed(2);
console.log(`\nPerft complete: ${totalPassed} passed, ${totalFailed} failed in ${totalDur} s`);
if (totalFailed > 0) process.exit(1);
