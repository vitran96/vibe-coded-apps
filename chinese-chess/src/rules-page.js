// rules-page.js — Full-screen bilingual rules page with interactive mini-boards
(() => {
  let prevScreen = 'screen-start';
  const miniBoards = []; // array of { canvas, fen, activeSq, pos, initialPos, blockedPts }

  // Draw a 2D mini-board canvas
  function renderMiniBoard(item) {
    const canvas = item.canvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const pal = window.House ? window.House.palette() : {};
    const cs = getComputedStyle(document.documentElement);
    const redCol = cs.getPropertyValue('--xq-red').trim() || '#B8432E';
    const blackCol = cs.getPropertyValue('--xq-black').trim() || '#2B2622';
    const boardBg = pal.board || '#E9DCC4';
    const lineCol = pal['board-line'] || '#8C7A62';
    const surfaceCol = pal.surface || '#FBF8F2';
    const accentCol = pal.accent || '#B8432E';
    const dangerCol = pal.danger || '#B8432E';

    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, w, h);

    const padX = 24, padY = 24;
    const bw = w - padX * 2;
    const bh = h - padY * 2;
    const cw = bw / 8;
    const ch = bh / 9;

    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 1.5;

    // Grid lines
    for (let r = 0; r < 10; r++) {
      ctx.beginPath();
      ctx.moveTo(padX, padY + r * ch);
      ctx.lineTo(padX + bw, padY + r * ch);
      ctx.stroke();
    }
    for (let f = 0; f < 9; f++) {
      // Top half
      ctx.beginPath();
      ctx.moveTo(padX + f * cw, padY);
      ctx.lineTo(padX + f * cw, padY + 4 * ch);
      ctx.stroke();
      // Bottom half
      ctx.beginPath();
      ctx.moveTo(padX + f * cw, padY + 5 * ch);
      ctx.lineTo(padX + f * cw, padY + 9 * ch);
      ctx.stroke();
    }

    // River gap
    ctx.fillStyle = lineCol;
    ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚河 · 漢界', padX + bw / 2, padY + 4.5 * ch);

    // Palaces
    ctx.beginPath();
    ctx.moveTo(padX + 3 * cw, padY); ctx.lineTo(padX + 5 * cw, padY + 2 * ch);
    ctx.moveTo(padX + 5 * cw, padY); ctx.lineTo(padX + 3 * cw, padY + 2 * ch);
    ctx.moveTo(padX + 3 * cw, padY + 7 * ch); ctx.lineTo(padX + 5 * cw, padY + 9 * ch);
    ctx.moveTo(padX + 5 * cw, padY + 7 * ch); ctx.lineTo(padX + 3 * cw, padY + 9 * ch);
    ctx.stroke();

    const GLYPHS = {
      1: { red: '帥', black: '將' },
      2: { red: '仕', black: '士' },
      3: { red: '相', black: '象' },
      4: { red: '傌', black: '馬' },
      5: { red: '俥', black: '車' },
      6: { red: '炮', black: '砲' },
      7: { red: '兵', black: '卒' }
    };

    // Draw pieces
    const pos = item.pos;
    for (let sq = 0; sq < 90; sq++) {
      const p = pos.board[sq];
      if (p === 0) continue;
      const f = sq % 9;
      const r = Math.floor(sq / 9);
      // Canvas: rank 0 is at bottom (padY + 9 * ch), rank 9 at top (padY)
      const cx = padX + f * cw;
      const cy = padY + (9 - r) * ch;
      const isRed = p > 0;
      const col = isRed ? redCol : blackCol;

      // Disc
      ctx.fillStyle = surfaceCol;
      ctx.beginPath();
      ctx.arc(cx, cy, cw * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glyph
      ctx.fillStyle = col;
      ctx.font = 'bold 14px "Noto Serif TC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = isRed ? GLYPHS[Math.abs(p)].red : GLYPHS[Math.abs(p)].black;
      ctx.fillText(glyph, cx, cy);
    }

    // Highlighting targets
    if (item.activeSq >= 0) {
      const moves = window.XQ.movesFrom(pos, item.activeSq);
      // Highlight selected piece
      const sf = item.activeSq % 9, sr = Math.floor(item.activeSq / 9);
      const scx = padX + sf * cw, scy = padY + (9 - sr) * ch;
      ctx.strokeStyle = accentCol;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(scx, scy, cw * 0.46, 0, Math.PI * 2);
      ctx.stroke();

      // Quiet targets
      ctx.fillStyle = accentCol;
      for (const tSq of moves.quiet) {
        const tf = tSq % 9, tr = Math.floor(tSq / 9);
        const tcx = padX + tf * cw, tcy = padY + (9 - tr) * ch;
        ctx.beginPath();
        ctx.arc(tcx, tcy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Captures
      ctx.strokeStyle = dangerCol;
      ctx.lineWidth = 2.5;
      for (const tSq of moves.captures) {
        const tf = tSq % 9, tr = Math.floor(tSq / 9);
        const tcx = padX + tf * cw, tcy = padY + (9 - tr) * ch;
        ctx.beginPath();
        ctx.arc(tcx, tcy, cw * 0.46, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Blocked points marks
    if (item.blockedPts) {
      ctx.strokeStyle = dangerCol;
      ctx.lineWidth = 2.5;
      for (const bSq of item.blockedPts) {
        const bf = bSq % 9, br = Math.floor(bSq / 9);
        const bcx = padX + bf * cw, bcy = padY + (9 - br) * ch;
        ctx.beginPath();
        ctx.moveTo(bcx - 6, bcy - 6); ctx.lineTo(bcx + 6, bcy + 6);
        ctx.moveTo(bcx + 6, bcy - 6); ctx.lineTo(bcx - 6, bcy + 6);
        ctx.stroke();
      }
    }
  }

  function initInteractiveMiniBoards() {
    const list = [
      {
        id: 'mb-general',
        fen: '4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1',
        activeSq: 4, // e0 King
        blockedPts: [3], // d0 forbidden due to flying general facing d9
      },
      {
        id: 'mb-advisor',
        fen: '4k4/9/9/9/9/9/9/9/4A4/4K4 w - - 0 1',
        activeSq: 13, // e1 Advisor in center
      },
      {
        id: 'mb-elephant',
        fen: '4k4/9/9/9/9/9/9/2p6/9/2B1K4 w - - 0 1',
        activeSq: 2, // c0 Elephant with eye at d1 blocked by black pawn at c2
        blockedPts: [20], // eye blocked
      },
      {
        id: 'mb-horse',
        fen: '4k4/9/9/9/9/9/9/9/1p7/1N2K4 w - - 0 1',
        activeSq: 1, // b0 Horse with leg at b1 occupied by pawn
        blockedPts: [18, 20], // lost targets due to leg block
      },
      {
        id: 'mb-chariot',
        fen: '4k4/9/9/9/9/9/9/9/R3K3/9 w - - 0 1',
        activeSq: 9, // a1 Chariot
      },
      {
        id: 'mb-cannon',
        fen: '4k4/9/9/9/9/9/9/9/4K4/C3r4 w - - 0 1',
        activeSq: 0, // a0 Cannon with screen at e0 King capturing e0?
      },
      {
        id: 'mb-soldier',
        fen: '4k4/9/9/9/4P4/9/9/9/4K4/9 w - - 0 1',
        activeSq: 49, // e5 Soldier crossed river
      },
      {
        id: 'mb-checkmate',
        fen: 'R3k4/R8/9/9/9/9/9/9/9/3K5 b - - 0 1',
        activeSq: 85, // e9 King in double chariot checkmate
      }
    ];

    list.forEach(cfg => {
      const canvas = document.getElementById(cfg.id);
      if (!canvas) return;
      canvas.width = 300;
      canvas.height = 340;
      const initialPos = window.XQ.parseFen(cfg.fen);
      const item = {
        canvas,
        fen: cfg.fen,
        activeSq: cfg.activeSq,
        pos: window.XQ.clonePos(initialPos),
        initialPos,
        blockedPts: cfg.blockedPts || []
      };
      miniBoards.push(item);
      renderMiniBoard(item);

      // Tap to make move or select
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const padX = 24, padY = 24;
        const bw = canvas.width - padX * 2;
        const bh = canvas.height - padY * 2;
        const cw = bw / 8;
        const ch = bh / 9;

        const f = Math.round((x - padX) / cw);
        const r = 9 - Math.round((y - padY) / ch);
        if (f < 0 || f > 8 || r < 0 || r > 9) return;
        const clickedSq = r * 9 + f;

        const moves = window.XQ.movesFrom(item.pos, item.activeSq);
        const allTargets = [...moves.quiet, ...moves.captures];
        if (allTargets.includes(clickedSq)) {
          // Animate move on mini-board
          const m = (item.activeSq << 7) | clickedSq;
          item.pos = window.XQ.applyMove(item.pos, m);
          item.activeSq = clickedSq;
          renderMiniBoard(item);
        } else {
          // Reset to initial
          item.pos = window.XQ.clonePos(item.initialPos);
          item.activeSq = cfg.activeSq;
          renderMiniBoard(item);
        }
      });
    });
  }

  const RulesPage = {
    init() {
      initInteractiveMiniBoards();
      // Back button
      const backBtn = document.getElementById('btn-rules-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          this.close();
        });
      }

      // Try now button
      const tryBtn = document.getElementById('btn-rules-try');
      if (tryBtn) {
        tryBtn.addEventListener('click', () => {
          this.close();
          window.XQ.controller && window.XQ.controller.startNewGame({
            mode: 'pve',
            level: 'easy',
            side: 'red'
          });
        });
      }
    },

    open(fromScreen = 'screen-start') {
      prevScreen = fromScreen;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const rulesEl = document.getElementById('screen-rules');
      if (rulesEl) rulesEl.classList.add('active');
      window.XQ.Audio.play('open');

      // Redraw mini boards
      miniBoards.forEach(renderMiniBoard);
    },

    close() {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const prev = document.getElementById(prevScreen) || document.getElementById('screen-start');
      if (prev) prev.classList.add('active');
      window.XQ.Audio.play('close');
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.RulesPage = RulesPage;
})();
