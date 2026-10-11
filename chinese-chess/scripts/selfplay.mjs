#!/usr/bin/env node
// Self-play strength check between AI levels in Node.js
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesCode = readFileSync(resolve(__dirname, '../src/rules.js'), 'utf8');
const notationCode = readFileSync(resolve(__dirname, '../src/notation.js'), 'utf8');
const bookCode = readFileSync(resolve(__dirname, '../src/book.js'), 'utf8');
const engineCode = readFileSync(resolve(__dirname, '../src/engine.js'), 'utf8');

const sandbox = {
  console, Int8Array, Uint8Array, Uint32Array, Int16Array, Int32Array, Math, Date,
  setTimeout, clearTimeout
};
vm.createContext(sandbox);
vm.runInContext(rulesCode, sandbox);
vm.runInContext(notationCode, sandbox);
vm.runInContext(bookCode, sandbox);
vm.runInContext(engineCode, sandbox);

const XQ = {};
sandbox.defineRules(XQ);
sandbox.defineNotation(XQ);
sandbox.defineBook(XQ);
sandbox.defineEngine(XQ);

const args = process.argv.slice(2);
const level1 = args[0] || 'hard';
const level2 = args[1] || 'medium';
const totalGames = parseInt(args[2], 10) || 6; // quick run for sanity, e.g. 6 or 10

console.log(`\n=== Self-play: ${level1.toUpperCase()} vs ${level2.toUpperCase()} (${totalGames} games) ===`);

let score1 = 0, score2 = 0, draws = 0;
let totalMs1 = 0, totalMoves1 = 0;
let totalDepth1 = 0;

for (let g = 1; g <= totalGames; g++) {
  const p1IsRed = (g % 2 === 1);
  const redLevel = p1IsRed ? level1 : level2;
  const blackLevel = p1IsRed ? level2 : level1;

  let pos = XQ.parseFen(XQ.START_FEN);
  const history = [];
  const movesHistory = [];
  let gameOver = false;
  let winner = null;
  let reason = '';

  // Play game up to 160 plies
  for (let ply = 0; ply < 160; ply++) {
    const curLevel = pos.side === 1 ? redLevel : blackLevel;
    const isP1 = (pos.side === 1) ? p1IsRed : !p1IsRed;

    // First 2 plies: randomize slightly from top 4 moves for variety
    let moveObj;
    const t0 = Date.now();
    if (ply < 2) {
      const legal = XQ.legalMoves(pos);
      const candidates = legal.slice(0, Math.min(4, legal.length));
      const m = candidates[Math.floor(Math.random() * candidates.length)];
      moveObj = { move: XQ.moveToIccs(m), moveInt: m, depth: 1, score: 0 };
    } else {
      moveObj = XQ.searchRoot(pos, {
        level: curLevel,
        timeBudget: curLevel === 'hard' ? 300 : 100, // fast budget for node testing
        historyHashes: history,
        movesHistory,
        rules: { perpetual: true, moveLimit: true }
      });
    }
    const dt = Date.now() - t0;

    if (isP1 && ply >= 2) {
      totalMs1 += dt;
      totalMoves1++;
      totalDepth1 += (moveObj.depth || 1);
    }

    if (!moveObj || !moveObj.moveInt) {
      gameOver = true;
      winner = pos.side === 1 ? 'black' : 'red';
      reason = 'no_moves';
      break;
    }

    const undo = XQ.makeMove(pos, moveObj.moveInt);
    movesHistory.push(moveObj.move);
    history.push({
      hashLo: undo.hashLo,
      hashHi: undo.hashHi,
      side: -pos.side,
      gaveCheck: XQ.inCheck(pos, pos.side),
      capture: undo.captured
    });

    const status = XQ.gameStatus(pos, history, { perpetual: true, moveLimit: true });
    if (status.over) {
      gameOver = true;
      winner = status.winner;
      reason = status.reason;
      break;
    }
  }

  let resultStr = '';
  if (!winner) {
    draws++;
    score1 += 0.5;
    score2 += 0.5;
    resultStr = `Draw (${reason || 'max_plies'})`;
  } else {
    const p1Won = (winner === 'red' && p1IsRed) || (winner === 'black' && !p1IsRed);
    if (p1Won) {
      score1 += 1;
      resultStr = `${level1} won as ${p1IsRed ? 'Red' : 'Black'} (${reason})`;
    } else {
      score2 += 1;
      resultStr = `${level2} won as ${p1IsRed ? 'Black' : 'Red'} (${reason})`;
    }
  }

  console.log(`Game ${g}/${totalGames}: ${resultStr} [${movesHistory.length} plies]`);
}

const avgMs = totalMoves1 > 0 ? (totalMs1 / totalMoves1).toFixed(1) : 0;
const avgDepth = totalMoves1 > 0 ? (totalDepth1 / totalMoves1).toFixed(1) : 0;
const winRate1 = ((score1 / totalGames) * 100).toFixed(1);

console.log(`\nSummary:`);
console.log(`- ${level1}: ${score1} pts (${winRate1}%)`);
console.log(`- ${level2}: ${score2} pts`);
console.log(`- Draws: ${draws}`);
console.log(`- ${level1} avg ms/move: ${avgMs} ms`);
console.log(`- ${level1} avg depth: ${avgDepth}`);
