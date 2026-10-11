// selfplay.js — in-page selfplay harness for ?selfplay=level1,level2,games
(() => {
  async function runInPageSelfPlay() {
    const params = new URLSearchParams(window.location.search);
    const selfplayParam = params.get('selfplay');
    if (!selfplayParam) return;

    const parts = selfplayParam.split(',');
    const level1 = parts[0] || 'hard';
    const level2 = parts[1] || 'medium';
    const games = parseInt(parts[2], 10) || 10;

    console.log(`[SelfPlay] Starting in-page run: ${level1} vs ${level2} (${games} games)`);
    // Minimal non-blocking harness
    let score1 = 0, score2 = 0, draws = 0;

    for (let g = 1; g <= games; g++) {
      const p1IsRed = (g % 2 === 1);
      const redLevel = p1IsRed ? level1 : level2;
      const blackLevel = p1IsRed ? level2 : level1;

      let pos = window.XQ.parseFen(window.XQ.START_FEN);
      const history = [];
      const movesHistory = [];
      let winner = null, reason = '';

      for (let ply = 0; ply < 160; ply++) {
        const curLevel = pos.side === 1 ? redLevel : blackLevel;
        let moveObj;

        if (ply < 2) {
          const legal = window.XQ.legalMoves(pos);
          const candidates = legal.slice(0, Math.min(4, legal.length));
          const m = candidates[Math.floor(Math.random() * candidates.length)];
          moveObj = { move: window.XQ.moveToIccs(m), moveInt: m, depth: 1, score: 0 };
        } else {
          moveObj = window.XQ.searchRoot(pos, {
            level: curLevel,
            timeBudget: curLevel === 'hard' ? 300 : 100,
            historyHashes: history,
            movesHistory,
            rules: { perpetual: true, moveLimit: true }
          });
        }

        if (!moveObj || !moveObj.moveInt) {
          winner = pos.side === 1 ? 'black' : 'red';
          reason = 'no_moves';
          break;
        }

        const undo = window.XQ.makeMove(pos, moveObj.moveInt);
        movesHistory.push(moveObj.move);
        history.push({
          hashLo: undo.hashLo,
          hashHi: undo.hashHi,
          side: -pos.side,
          gaveCheck: window.XQ.inCheck(pos, pos.side),
          capture: undo.captured
        });

        const status = window.XQ.gameStatus(pos, history, { perpetual: true, moveLimit: true });
        if (status.over) {
          winner = status.winner;
          reason = status.reason;
          break;
        }

        // Give breathing room to browser UI thread
        if (ply % 5 === 0) await new Promise(r => setTimeout(r, 0));
      }

      if (!winner) {
        draws++; score1 += 0.5; score2 += 0.5;
        console.log(`[SelfPlay] Game ${g}/${games}: Draw (${reason || 'max_plies'})`);
      } else {
        const p1Won = (winner === 'red' && p1IsRed) || (winner === 'black' && !p1IsRed);
        if (p1Won) {
          score1 += 1;
          console.log(`[SelfPlay] Game ${g}/${games}: ${level1} won (${reason})`);
        } else {
          score2 += 1;
          console.log(`[SelfPlay] Game ${g}/${games}: ${level2} won (${reason})`);
        }
      }
    }

    console.log(`[SelfPlay] Finished: ${level1} ${score1} - ${score2} ${level2} (${draws} draws)`);
  }

  if (window.location && window.location.search.includes('selfplay')) {
    window.addEventListener('DOMContentLoaded', runInPageSelfPlay);
  }
})();
