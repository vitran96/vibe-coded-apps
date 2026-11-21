'use strict';
// 13 Main & Self-play simulation
// ============================================================
async function runSelfPlay(lvl1, lvl2, rounds = 20, rule = 'caro') {
  console.log(`🤖 Starting self-play tournament: ${lvl1} vs ${lvl2} (${rounds} games, rule=${rule})`);
  const ai1 = createAI();
  const ai2 = createAI();
  const N = 15;
  const rules = { mode: rule, exactFive: false, edgeBlocks: false };
  let w1 = 0, w2 = 0, draws = 0;

  for (let g = 1; g <= rounds; g++) {
    const p1IsFirst = g % 2 === 1;
    const p1 = p1IsFirst ? 1 : 2;
    const p2 = 3 - p1;
    const board = new Int8Array(N * N);
    let cur = 1;
    let moves = 0;
    let winner = 0;

    while (moves < N * N) {
      const isP1 = cur === p1;
      const agent = isP1 ? ai1 : ai2;
      const diff = isP1 ? lvl1 : lvl2;
      const mv = agent.chooseMove({ board, N, player: cur, rules, difficulty: diff, budget: 500 });
      board[mv.y * N + mv.x] = cur;
      moves++;

      const win = checkWin(board, N, mv.x, mv.y, cur, rules);
      if (win) {
        winner = cur;
        break;
      }
      if (isDraw(board, N)) break;
      cur = 3 - cur;
    }

    if (winner === p1) w1++;
    else if (winner === p2) w2++;
    else draws++;

    console.log(`Game ${g}/${rounds}: ${winner === p1 ? lvl1 : winner === p2 ? lvl2 : 'Draw'} in ${moves} moves (Score: ${lvl1}=${w1}, ${lvl2}=${w2}, draws=${draws})`);
  }

  const p1Pct = Math.round((w1 / rounds) * 100);
  console.log(`🏆 Tournament finished! ${lvl1}: ${w1} (${p1Pct}%), ${lvl2}: ${w2}, Draws: ${draws}`);
}

const App = {
  settings: loadSettings(),
  records: loadRecords(),
  ai: new AIClient(),
  audio: new AudioEngine(),
  renderer: null,
  input: null,
  game: null,
  replay: null,
  ui: null,
  deferredInstallPrompt: null
};

window.App = App;

async function main() {
  await threeReady;
  const params = new URLSearchParams(window.location.search);

  // Self-play tournament mode (?selfplay=hard,medium,20)
  if (params.has('selfplay')) {
    const parts = params.get('selfplay').split(',');
    const l1 = parts[0] || 'hard';
    const l2 = parts[1] || 'medium';
    const num = parseInt(parts[2] || '20', 10);
    const rule = params.get('rule') || 'caro';
    setTimeout(() => runSelfPlay(l1, l2, num, rule), 300);
  }

  setLang(App.settings.display.lang);
  House.applyTheme(House.prefs.load().theme);

  // Initialize renderer & controllers
  const host = $('#canvas-host');
  App.renderer = new BoardRenderer(host);
  House.debug.cellToClient = (x, y) => App.renderer.cellToClient(x, y);
  House.debug.camera = () => ({ x: App.renderer.camera.position.x, y: App.renderer.camera.position.y, z: App.renderer.camera.position.z });
  App.game = new GameController();
  App.input = new InputController(App.renderer, (x, y) => App.game.placeStone(x, y));
  App.replay = new ReplayController();
  App.ui = new UIBindings();
  addEventListener('housethemechange', () => App.renderer.recolor());

  // Apply theme & motion & i18n
  applyI18n();
  App.ui.applyDisplaySettings();
  initPWA();

  // Check saved game in progress
  const saved = store.get(LS.current);
  if (saved && validSession(saved.session) && Array.isArray(saved.moves) && saved.moves.length > 0) {
    const resume = await confirmDialog(t('confirmResumeTitle'), t('confirmResumeSub', saved.session.rules.mode, saved.moves.length));
    if (resume) {
      App.game.restoreGame(saved);
      toast(t('resumedPrevGame'));
      return;
    }
  }

  // Prepare board and show Menu screen as 1st screen
  App.game.startNewGame();
  $('#dlg-menu')?.showModal();
}

window.addEventListener('DOMContentLoaded', main);
