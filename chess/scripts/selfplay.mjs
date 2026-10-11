#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ChessRules = require('../src/rules.js');
const ChessAI = require('../src/ai.js');

const [,, p1Level = 'hard', p2Level = 'medium', gamesCount = '6'] = process.argv;
const N = parseInt(gamesCount, 10) || 6;

console.log(`Starting Self-Play: ${p1Level.toUpperCase()} vs ${p2Level.toUpperCase()} (${N} games)...`);

let p1Score = 0;
let p2Score = 0;
let draws = 0;

for (let g = 0; g < N; g++) {
  const p1IsWhite = (g % 2 === 0);
  const whiteLevel = p1IsWhite ? p1Level : p2Level;
  const blackLevel = p1IsWhite ? p2Level : p1Level;

  let state = ChessRules.initial();
  let ply = 0;
  let overReason = null;
  let winner = null;

  while (ply < 150) {
    const st = ChessRules.status(state);
    if (st.over) {
      overReason = st.reason;
      if (st.result === '1-0') winner = 'w';
      else if (st.result === '0-1') winner = 'b';
      else winner = 'draw';
      break;
    }

    const curLevel = state.turn === 1 ? whiteLevel : blackLevel;
    const res = ChessAI.search(ChessRules.toFEN(state), curLevel, 300, state.history);
    if (!res || !res.uci) {
      winner = state.turn === 1 ? 'b' : 'w';
      overReason = 'no move';
      break;
    }

    const m = ChessRules.fromUCI(state, res.uci);
    if (!m) {
      winner = state.turn === 1 ? 'b' : 'w';
      overReason = 'illegal';
      break;
    }

    state = ChessRules.make(state, m);
    ply++;
  }

  if (!overReason) {
    overReason = '150-ply cap';
    winner = 'draw';
  }

  let outcome = '';
  if (winner === 'draw') {
    draws++;
    p1Score += 0.5;
    p2Score += 0.5;
    outcome = '½-½';
  } else if ((winner === 'w' && p1IsWhite) || (winner === 'b' && !p1IsWhite)) {
    p1Score += 1;
    outcome = `1-0 (${p1Level} wins)`;
  } else {
    p2Score += 1;
    outcome = `0-1 (${p2Level} wins)`;
  }

  console.log(`Game ${g + 1}/${N} [${p1IsWhite ? 'White: ' + p1Level : 'White: ' + p2Level}]: ${outcome} (${ply} plies, ${overReason})`);
}

const p1Pct = ((p1Score / N) * 100).toFixed(1);
console.log(`\nResults: ${p1Level}: ${p1Score} | ${p2Level}: ${p2Score} | Draws: ${draws} (${p1Pct}%)`);
