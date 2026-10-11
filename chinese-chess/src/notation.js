// notation.js — pure notation converter for Cờ Tướng (Xiangqi)
function defineNotation(XQ) {
  const VI_PIECES = { 1: 'Tg', 2: 'S', 3: 'T', 4: 'M', 5: 'X', 6: 'P', 7: 'B' };
  const EN_PIECES = { 1: 'K', 2: 'A', 3: 'E', 4: 'H', 5: 'R', 6: 'C', 7: 'P' };

  function fileToNum(file, side) {
    // Red (1): file 0 (a) -> 9, file 8 (i) -> 1
    // Black (-1): file 0 (a) -> 1, file 8 (i) -> 9
    return side === 1 ? (9 - file) : (file + 1);
  }

  function notation(pos, m, lang = 'vi') {
    const from = (m >> 7) & 0x7F;
    const to = m & 0x7F;
    const piece = pos.board[from];
    if (piece === 0) return XQ.moveToIccs(m);

    const side = piece > 0 ? 1 : -1;
    const type = Math.abs(piece);

    const ff = from % 9, fr = Math.floor(from / 9);
    const tf = to % 9, tr = Math.floor(to / 9);

    const fromFileNum = fileToNum(ff, side);
    const toFileNum = fileToNum(tf, side);

    // Find all identical friendly pieces on the same file
    const sameFilePieces = [];
    for (let r = 0; r < 10; r++) {
      const sq = r * 9 + ff;
      if (pos.board[sq] === piece) {
        sameFilePieces.push({ sq, r });
      }
    }

    // Sort front to back (front = towards opponent)
    // Red: higher rank is front (descending order)
    // Black: lower rank is front (ascending order)
    sameFilePieces.sort((a, b) => side === 1 ? (b.r - a.r) : (a.r - b.r));

    let piecePrefix = '';
    const pVi = VI_PIECES[type] || '';
    const pEn = EN_PIECES[type] || '';

    if (sameFilePieces.length === 2) {
      const isFront = (sameFilePieces[0].sq === from);
      if (lang === 'vi') {
        piecePrefix = `${pVi}${isFront ? 't' : 's'}`;
      } else {
        piecePrefix = `${isFront ? '+' : '-'}${pEn}`;
      }
    } else if (sameFilePieces.length > 2) {
      const idx = sameFilePieces.findIndex(item => item.sq === from) + 1; // 1-based front to back
      if (lang === 'vi') {
        piecePrefix = `${pVi}${idx}`;
      } else {
        piecePrefix = `${idx}${pEn}`;
      }
    } else {
      if (lang === 'vi') {
        piecePrefix = `${pVi}${fromFileNum}`;
      } else {
        piecePrefix = `${pEn}${fromFileNum}`;
      }
    }

    // Action and target
    let action = '';
    let target = '';

    const isStraight = (type === 1 || type === 5 || type === 6 || type === 7); // K, R, C, P
    const rankDiff = side === 1 ? (tr - fr) : (fr - tr);

    if (rankDiff > 0) { // Forward / advance
      action = lang === 'vi' ? '.' : '+';
      target = isStraight ? Math.abs(tr - fr) : toFileNum;
    } else if (rankDiff < 0) { // Backward / retreat
      action = lang === 'vi' ? '/' : '-';
      target = isStraight ? Math.abs(tr - fr) : toFileNum;
    } else { // Horizontal / traverse
      action = lang === 'vi' ? '-' : '=';
      target = toFileNum;
    }

    return `${piecePrefix}${action}${target}`;
  }

  XQ.notation = notation;
}

if (typeof window !== 'undefined') {
  window.XQ = window.XQ || {};
  defineNotation(window.XQ);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defineNotation;
}
