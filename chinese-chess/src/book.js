// book.js — built-in opening book for Cờ Tướng (Xiangqi)
function defineBook(XQ) {
  // Map from normalized position (moves sequence prefix) to next moves with weights
  const BOOK_LINES = [
    // 1. Pháo đầu (Central Cannon) -> Thuận pháo (Same Direction Cannons)
    ['h2e2', 'h9e7', 'h0g2', 'b9c7', 'i0h0', 'a9b9', 'b0c2', 'h7f7'],
    ['h2e2', 'h9e7', 'h0g2', 'b9c7', 'b0c2', 'h7i7', 'i0h0', 'a9b9'],
    ['h2e2', 'h9e7', 'b0c2', 'b9c7', 'h0g2', 'h7f7', 'i0h0', 'a9b9'],

    // 2. Pháo đầu -> Nghịch pháo (Opposite Direction Cannons)
    ['h2e2', 'b7e7', 'h0g2', 'h9g7', 'i0h0', 'b9c7', 'b0c2', 'a9b9'],
    ['h2e2', 'b7e7', 'b0c2', 'b9c7', 'h0g2', 'h9g7', 'i0h0', 'i9h9'],

    // 3. Pháo đầu -> Bình phong mã (Screen Horses Defense)
    ['h2e2', 'b9c7', 'h0g2', 'h9g7', 'i0h0', 'i9h9', 'b0c2', 'c6c5'],
    ['h2e2', 'b9c7', 'h0g2', 'h9g7', 'b0c2', 'c6c5', 'i0h0', 'a9b9'],
    ['h2e2', 'b9c7', 'h0g2', 'h9g7', 'c3c4', 'a9b9', 'i0h0', 'c6c5'],
    ['h2e2', 'b9c7', 'h0g2', 'a9b9', 'i0h0', 'h9g7', 'b0c2', 'c6c5'],

    // 4. Pháo đầu -> Đơn đề mã (Single Horse Defense)
    ['h2e2', 'b9c7', 'h0g2', 'h7i7', 'b0c2', 'h9g7', 'i0h0', 'a9b9'],
    ['h2e2', 'h9g7', 'h0g2', 'b7c7', 'b0c2', 'b9c7', 'i0h0', 'a9b9'],

    // 5. Phi tượng cuộc (Elephant Opening)
    ['g0e2', 'h9g7', 'h0g2', 'h7e7', 'b0c2', 'b9c7', 'i0h0', 'a9b9'],
    ['g0e2', 'b7e7', 'h2e2', 'b9c7', 'h0g2', 'h9g7', 'b0c2', 'c6c5'],
    ['c0e2', 'h7e7', 'h2e2', 'h9g7', 'b0c2', 'b9c7', 'h0g2', 'a9b9'],
    ['c0e2', 'b9c7', 'b0c2', 'h7e7', 'h2e2', 'h9g7', 'h0g2', 'a9b9'],

    // 6. Tiên nhân chỉ lộ (Soldier Opening)
    ['c3c4', 'h7e7', 'h2e2', 'b9c7', 'b0c2', 'h9g7', 'h0g2', 'a9b9'],
    ['c3c4', 'g6g5', 'h2e2', 'b9c7', 'h0g2', 'h9g7', 'b0c2', 'c6c5'],
    ['g3g4', 'b7e7', 'h2e2', 'h9g7', 'h0g2', 'b9c7', 'b0c2', 'a9b9'],

    // 7. Khởi mã cuộc (Horse Opening)
    ['b0c2', 'h9g7', 'h0g2', 'b7e7', 'h2e2', 'b9c7', 'i0h0', 'a9b9'],
    ['h0g2', 'b9c7', 'b0c2', 'h9g7', 'c3c4', 'c6c5', 'h2e2', 'a9b9'],

    // 8. Quá cung pháo (Palace Cannon)
    ['h2b2', 'b9c7', 'h0g2', 'h9g7', 'b0c2', 'c6c5', 'i0h0', 'a9b9'],
    ['b2d2', 'h9g7', 'h0g2', 'b9c7', 'b0c2', 'c6c5', 'i0h0', 'a9b9'],
  ];

  // Build prefix lookup table: prefix key "m1 m2 ..." -> array of next moves
  const BOOK = {};
  for (const line of BOOK_LINES) {
    for (let i = 0; i < line.length; i++) {
      const prefix = line.slice(0, i).join(' ');
      const nextMove = line[i];
      if (!BOOK[prefix]) BOOK[prefix] = {};
      BOOK[prefix][nextMove] = (BOOK[prefix][nextMove] || 0) + 1;
    }
  }

  function getBookMove(movesHistory) {
    // movesHistory is array of ICCS move strings
    if (!movesHistory || movesHistory.length > 8) return null;
    const prefix = movesHistory.join(' ');
    const candidates = BOOK[prefix];
    if (!candidates) return null;

    const list = [];
    for (const m in candidates) {
      for (let k = 0; k < candidates[m]; k++) {
        list.push(m);
      }
    }
    if (list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  XQ.BOOK = BOOK;
  XQ.getBookMove = getBookMove;
}

if (typeof window !== 'undefined') {
  window.XQ = window.XQ || {};
  defineBook(window.XQ);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defineBook;
}
