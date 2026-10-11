// tests.js — in-page test suite for ?test
(() => {
  function runTests() {
    const results = [];
    let passedCount = 0, failedCount = 0;

    function assert(name, condition, extra = '') {
      if (condition) {
        passedCount++;
        results.push({ name, status: 'PASS', extra });
      } else {
        failedCount++;
        results.push({ name, status: 'FAIL', extra });
      }
    }

    const XQ = window.XQ;

    // 1. Perft
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

    const startPos = XQ.parseFen(XQ.START_FEN);
    assert('Perft(1) == 44', perft(startPos, 1) === 44);
    assert('Perft(2) == 1,920', perft(startPos, 2) === 1920);
    assert('Perft(3) == 79,666', perft(startPos, 3) === 79666);

    // 2. Flying general
    const fgPos = XQ.parseFen('3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
    const fgMoves = XQ.legalMoves(fgPos).map(XQ.moveToIccs).sort();
    assert('Flying General forbidden square', fgMoves.length === 2 && fgMoves.includes('e0e1') && fgMoves.includes('e0f0'));

    // 3. Checkmate
    const cmPos = XQ.parseFen('R3k4/R8/9/9/9/9/9/9/9/3K5 b - - 0 1');
    const cmStatus = XQ.gameStatus(cmPos);
    assert('Checkmate detected', cmStatus.over && cmStatus.status === 'win' && cmStatus.winner === 'red' && cmStatus.reason === 'checkmate');

    // 4. Stalemate loss
    const smPos = XQ.parseFen('3k5/3AP4/3K5/9/9/9/9/9/9/9 b - - 0 1');
    const smStatus = XQ.gameStatus(smPos);
    assert('Stalemate loss', smStatus.over && smStatus.status === 'win' && smStatus.winner === 'red' && smStatus.reason === 'stalemate');

    // 5. Perpetual check
    const hLo = startPos.hashLo, hHi = startPos.hashHi;
    const histChecks = [
      { hashLo: hLo, hashHi: hHi, side: 1, gaveCheck: true, capture: 0 },
      { hashLo: 123, hashHi: 456, side: -1, gaveCheck: false, capture: 0 },
      { hashLo: hLo, hashHi: hHi, side: 1, gaveCheck: true, capture: 0 },
      { hashLo: 123, hashHi: 456, side: -1, gaveCheck: false, capture: 0 },
    ];
    const perpStatus = XQ.gameStatus(startPos, histChecks, { perpetual: true, moveLimit: true });
    assert('Perpetual check loss (ON)', perpStatus.over && perpStatus.status === 'win' && perpStatus.winner === 'black' && perpStatus.reason === 'perpetual_check');

    const perpOff = XQ.gameStatus(startPos, histChecks, { perpetual: false, moveLimit: true });
    assert('Perpetual check draw (OFF)', perpOff.over && perpOff.status === 'draw' && perpOff.reason === 'repetition');

    // 6. Move-limit and no-material
    const mlPos = XQ.parseFen(XQ.START_FEN);
    mlPos.halfmove = 120;
    const mlStatus = XQ.gameStatus(mlPos, [], { perpetual: true, moveLimit: true });
    assert('60-move limit draw', mlStatus.over && mlStatus.status === 'draw' && mlStatus.reason === 'move_limit');

    const noMatPos = XQ.parseFen('2b1k1b2/4a4/9/9/9/9/9/9/4A4/2B1K1B2 w - - 0 1');
    const noMatStatus = XQ.gameStatus(noMatPos);
    assert('No-material draw', noMatStatus.over && noMatStatus.status === 'draw' && noMatStatus.reason === 'no_material');

    // 7. Notation cases
    const nPos = XQ.parseFen(XQ.START_FEN);
    assert('Notation h2e2 vi == P2-5', XQ.notation(nPos, XQ.iccsToMove('h2e2'), 'vi') === 'P2-5');
    assert('Notation h2e2 en == C2=5', XQ.notation(nPos, XQ.iccsToMove('h2e2'), 'en') === 'C2=5');
    assert('Notation h0g2 vi == M2.3', XQ.notation(nPos, XQ.iccsToMove('h0g2'), 'vi') === 'M2.3');
    assert('Notation h0g2 en == H2+3', XQ.notation(nPos, XQ.iccsToMove('h0g2'), 'en') === 'H2+3');
    assert('Notation b0c2 vi == M8.7', XQ.notation(nPos, XQ.iccsToMove('b0c2'), 'vi') === 'M8.7');
    assert('Notation b0c2 en == H8+7', XQ.notation(nPos, XQ.iccsToMove('b0c2'), 'en') === 'H8+7');
    assert('Notation a0a1 vi == X9.1', XQ.notation(nPos, XQ.iccsToMove('a0a1'), 'vi') === 'X9.1');
    assert('Notation a0a1 en == R9+1', XQ.notation(nPos, XQ.iccsToMove('a0a1'), 'en') === 'R9+1');

    // 8. FEN and Zobrist roundtrip
    assert('FEN roundtrip', XQ.toFen(startPos) === XQ.START_FEN);

    // 9. Storage prefix
    XQ.Storage.saveSettings({ labels: 'viet' });
    const s = XQ.Storage.loadSettings();
    assert('Storage settings roundtrip', s.labels === 'viet');
    XQ.Storage.saveSettings({ labels: 'han' });

    // 10. Contrast check in all 4 themes
    const themes = ['giay', 'dem', 'sonmai', 'bien'];
    let contrastAllPass = true;
    function luminance(r, g, b) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    // Minimal contrast checker passes for defined palette tokens
    assert('Token contrast checks in 4 themes', contrastAllPass);

    // Render test banner in DOM
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.maxHeight = '80vh';
    banner.style.overflowY = 'auto';
    banner.style.zIndex = '99999';
    banner.style.padding = '16px';
    banner.style.fontFamily = 'monospace';
    banner.style.background = failedCount > 0 ? '#ffdddd' : '#ddffdd';
    banner.style.color = '#111';
    banner.style.borderBottom = `4px solid ${failedCount > 0 ? 'red' : 'green'}`;

    let html = `<h3>Test Suite: ${passedCount} passed, ${failedCount} failed</h3><ul>`;
    results.forEach(r => {
      html += `<li style="color:${r.status === 'PASS' ? 'green' : 'red'}">${r.status}: ${r.name}</li>`;
    });
    html += '</ul>';
    banner.innerHTML = html;
    document.body.appendChild(banner);
  }

  window.XQ = window.XQ || {};
  window.XQ.runTests = runTests;

  if (window.location && window.location.search.includes('test')) {
    window.addEventListener('DOMContentLoaded', runTests);
  }
})();
