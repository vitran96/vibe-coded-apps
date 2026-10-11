// Chess Rules Documentation content model & try-it tasks (15 sections)
// Inlines into single-file bundle, registers via window.RULES_SECTIONS

(() => {
  const RULES_SECTIONS = [
    {
      id: 'goal',
      title: { vi: '1. Mục tiêu', en: '1. The Goal' },
      summary: {
        vi: 'Mục tiêu tối thượng là chiếu hết (checkmate) Vua đối phương: Vua bị tấn công và không còn bất kỳ đường thoát nào.',
        en: 'The ultimate objective is to checkmate the opponent’s King: the King is under attack with no legal way to escape.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Trong Cờ vua, Vua không bao giờ bị "ăn" và nhấc khỏi bàn như các quân khác. Khi Vua không thể thoát khỏi đòn tấn công, ván cờ kết thúc ngay lập tức. Ngoài ra, ván đấu cũng có thể kết thúc với kết quả hoà.',
            en: 'In chess, the King is never actually captured or removed from the board. When the King cannot escape attack, the game ends immediately. A game can also end in a draw.',
          },
        },
        {
          type: 'board',
          fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
          highlights: ['f7', 'e8'],
          arrows: [['f7', 'e8']],
          caption: {
            vi: 'Ví dụ: Hậu Trắng tại f7 đang chiếu hết Vua Đen tại e8 (Scholar’s mate).',
            en: 'Example: White Queen on f7 checkmates the Black King on e8 (Scholar’s mate).',
          },
        },
      ],
    },
    {
      id: 'board',
      title: { vi: '2. Bàn cờ & Cách xếp quân', en: '2. Board & Setup' },
      summary: {
        vi: 'Bàn cờ có 64 ô (8 hàng × 8 cột). Quy tắc vàng: Ô góc dưới bên phải của mỗi người luôn là ô trắng.',
        en: 'The chessboard has 64 squares (8 ranks × 8 files). Golden rule: "White on right" for bottom-corner square.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Cột được đặt tên bằng chữ cái a đến h (từ trái qua phải của bên Trắng). Hàng được đánh số 1 đến 8 (hàng 1 và 2 là sân nhà của Trắng). Hàng 1 xếp: Xe, Mã, Tượng, Hậu, Vua, Tượng, Mã, Xe. Ghi nhớ: "Hậu trắng ô trắng, Hậu đen ô đen". Toàn bộ hàng 2 là hàng Tốt.',
            en: 'Files are lettered a to h (left to right from White). Ranks are numbered 1 to 8. Rank 1 setup: Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook. Remember: "Queen on her color". Rank 2 is filled with Pawns.',
          },
        },
        {
          type: 'board',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          caption: {
            vi: 'Thế cờ khởi đầu tiêu chuẩn. Trắng luôn luôn là bên đi trước.',
            en: 'Standard initial starting position. White always moves first.',
          },
        },
      ],
    },
    {
      id: 'pieces',
      title: { vi: '3. Cách đi của từng quân', en: '3. How Pieces Move' },
      summary: {
        vi: 'Mỗi loại quân có cách di chuyển và sức mạnh riêng biệt.',
        en: 'Each piece type possesses unique movement capabilities and values.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '• Vua (King - ♔): Đi 1 ô theo mọi hướng. Vua vô giá, mất vua là thua.\n• Hậu (Queen - ♕, 9 điểm): Đi ngang, dọc hoặc chéo bao nhiêu ô tuỳ ý (không nhảy qua quân).\n• Xe (Rook - ♖, 5 điểm): Đi ngang hoặc dọc không giới hạn khoảng cách.\n• Tượng (Bishop - ♗, 3 điểm): Đi chéo bao nhiêu ô tuỳ ý. Tượng luôn đi trên các ô cùng một màu suốt ván.\n• Mã (Knight - ♘, 3 điểm): Đi theo hình chữ "L" (2 ô rồi rẽ 1 ô). Mã là quân duy nhất nhảy qua đầu các quân khác!\n• Tốt (Pawn - ♙, 1 điểm): Tiến thẳng 1 ô (nước đầu được tiến 2 ô), ăn chéo 1 ô về phía trước.',
            en: '• King (♔): 1 square any direction. Priceless.\n• Queen (♕, 9 pts): Any squares orthogonally or diagonally.\n• Rook (♖, 5 pts): Any squares orthogonally.\n• Bishop (♗, 3 pts): Any squares diagonally; stays on same square color.\n• Knight (♘, 3 pts): "L" shape (2+1); only piece that can jump over others!\n• Pawn (♙, 1 pt): 1 step forward (optionally 2 steps on initial move), captures 1 square diagonally forward.',
          },
        },
        {
          type: 'tryit',
          fen: '8/8/8/4N3/8/8/8/4K2k w - - 0 1',
          solution: ['e5f7', 'e5d7', 'e5c6', 'e5c4', 'e5d3', 'e5f3', 'e5g4', 'e5g6'],
          targetMove: 'e5f7',
          caption: {
            vi: 'Thử ngay: Di chuyển Mã tại e5 sang một ô hợp lệ (ví dụ: f7).',
            en: 'Try it: Move the Knight on e5 to any legal square (e.g. f7).',
          },
          whyWrong: {
            vi: 'Mã chỉ đi theo hình chữ L (2 ô thẳng + 1 ô rẽ).',
            en: 'Knights move strictly in an L-shape.',
          },
        },
      ],
    },
    {
      id: 'capturing',
      title: { vi: '4. Ăn quân (Capturing)', en: '4. Capturing Pieces' },
      summary: {
        vi: 'Đi quân vào ô đang có quân đối phương để ăn và loại quân đó khỏi bàn cờ.',
        en: 'Move onto a square occupied by an enemy piece to capture and remove it.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Không được ăn quân cùng màu của mình. Mọi quân (Vua, Hậu, Xe, Tượng, Mã) ăn quân theo đúng hướng đi của nó. Riêng Tốt: đi thẳng nhưng ăn chéo 1 ô về phía trước.',
            en: 'You cannot capture your own pieces. Pieces capture along their normal path of movement, except Pawns (which advance straight but capture diagonally forward).',
          },
        },
        {
          type: 'tryit',
          fen: '4k3/8/8/3p4/4B3/8/8/4K3 w - - 0 1',
          solution: ['e4d5'],
          caption: {
            vi: 'Thử ngay: Tượng Trắng e4 ăn Tốt Đen tại d5!',
            en: 'Try it: White Bishop on e4 captures Black Pawn on d5!',
          },
          whyWrong: {
            vi: 'Hãy dùng Tượng ăn quân Tốt Đen trên đường chéo.',
            en: 'Capture the black pawn diagonally with your bishop.',
          },
        },
      ],
    },
    {
      id: 'check',
      title: { vi: '5. Chiếu & Cách thoát chiếu', en: '5. Check & Escaping' },
      summary: {
        vi: 'Khi Vua bị quân đối phương đe dọa ăn ở nước tiếp theo, Vua bị "Chiếu".',
        en: 'When a King is under direct attack by an enemy piece, it is in "Check".',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Bắt buộc phải thoát chiếu ngay lập tức bằng 1 trong 3 cách (CPR):\n1. Chạy Vua (Run): Di chuyển Vua đến ô an toàn không bị tấn công.\n2. Chặn đòn (Block): Đưa một quân vào giữa Vua và quân đang chiếu.\n3. Ăn quân (Capture): Dùng một quân của mình ăn quân đang chiếu vua.\nLưu ý: Không được đi bất kỳ nước nào để lộ Vua vào thế bị chiếu (kể cả di chuyển quân đang bị ghim). Nếu bị "chiếu đôi" (2 quân cùng chiếu một lúc), bắt buộc phải chạy Vua!',
            en: 'You must escape check immediately via CPR:\n1. Capture the attacking piece.\n2. Protect / Block the check with another piece.\n3. Run away with the King to a safe square.\nYou may never make a move that leaves your King in check. In double check, the King must move!',
          },
        },
        {
          type: 'tryit',
          fen: '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1',
          solution: ['e1f1', 'e1d1', 'e1e2'],
          targetMove: 'e1e2',
          caption: {
            vi: 'Thử ngay: Xe Đen e2 đang chiếu Vua Trắng e1. Vua Trắng ăn luôn Xe!',
            en: 'Try it: Black Rook on e2 checks White King on e1. Capture the Rook!',
          },
          whyWrong: {
            vi: 'Vua có thể ăn luôn Xe e2 hoặc di chuyển sang d1/f1 để thoát chiếu.',
            en: 'King can capture the rook or step to d1/f1.',
          },
        },
      ],
    },
    {
      id: 'checkmate',
      title: { vi: '6. Chiếu hết (Checkmate)', en: '6. Checkmate' },
      summary: {
        vi: 'Vua bị chiếu mà KHÔNG CÓ CÁCH NÀO để thoát → Ván cờ kết thúc, bên chiếu hết thắng cuộc!',
        en: 'The King is in check and has NO legal way to escape → Checkmate! Game over.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Chiếu hết là chiến thắng tối hậu trong cờ vua. Ngay khi chiếu hết xảy ra, ván cờ kết thúc ngay mà không cần đợi đối phương di chuyển.',
            en: 'Checkmate is the ultimate triumph in chess. The game concludes immediately the instant checkmate is delivered.',
          },
        },
        {
          type: 'tryit',
          fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
          solution: ['d1d8'],
          caption: {
            vi: 'Thử ngay: Chiếu hết hàng cuối (Back-rank mate) bằng Xe d1 lên d8#.',
            en: 'Try it: Deliver Back-Rank Checkmate with Rook d1 to d8#.',
          },
          whyWrong: {
            vi: 'Hãy đưa Xe lên hàng 8 để giáng đòn chiếu hết!',
            en: 'Bring the Rook up to rank 8 to deliver mate.',
          },
        },
      ],
    },
    {
      id: 'stalemate',
      title: { vi: '7. Hết nước đi (Pat / Stalemate)', en: '7. Stalemate (Draw)' },
      summary: {
        vi: 'Đến lượt đi, Vua KHÔNG bị chiếu, nhưng bên đó KHÔNG CÒN bất kỳ nước đi hợp lệ nào → HOÀ CỜ!',
        en: 'Player to move is NOT in check, but has NO legal moves available → Draw!',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '⚠️ Chú ý: Dù bạn đang hơn đối phương rất nhiều quân (kể cả hơn cả Hậu và Xe), nếu dồn ép sai khiến đối phương rơi vào thế Pat thì ván cờ lập tức bị xử hoà! Luôn để cho Vua đối phương có ô di chuyển nếu chưa chiếu.',
            en: '⚠️ Caution: Even with overwhelming material advantage, delivering stalemate results in a draw! Always ensure the opponent retains a legal move unless giving check.',
          },
        },
        {
          type: 'board',
          fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
          highlights: ['h8'],
          crosses: ['g8', 'h7'],
          caption: {
            vi: 'Thế Pat kinh điển: Vua Đen không bị chiếu, nhưng cả g8 lẫn h7 đều bị kiểm soát. Ván cờ HOÀ.',
            en: 'Classic stalemate: Black King is not in check, but cannot move anywhere. Game is a DRAW.',
          },
        },
      ],
    },
    {
      id: 'castling',
      title: { vi: '8. Nhập thành (Castling) ★', en: '8. Castling ★' },
      special: true,
      summary: {
        vi: 'Nước đi đặc biệt duy nhất cho phép di chuyển cả Vua và Xe trong cùng một lượt!',
        en: 'The unique special move allowing King and Rook to move simultaneously in one turn!',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Mục đích: Đưa Vua vào vị trí an toàn ở góc và đưa Xe ra trung tâm tấn công.\n• Nhập thành cánh Vua (O-O): Vua đi 2 ô sang phải (e1→g1), Xe h1 nhảy qua sang f1.\n• Nhập thành cánh Hậu (O-O-O): Vua đi 2 ô sang trái (e1→c1), Xe a1 nhảy qua sang d1.\n\n5 ĐIỀU KIỆN BẮT BUỘC:\n1. Cả Vua và Xe tham gia chưa từng di chuyển lần nào.\n2. Toàn bộ các ô nằm giữa Vua và Xe phải hoàn toàn trống.\n3. Vua KHÔNG đang bị chiếu (không được nhập thành để thoát chiếu).\n4. Vua KHÔNG đi qua ô đang bị quân đối phương kiểm soát/tấn công.\n5. Ô đích mà Vua hạ cánh KHÔNG bị đối phương tấn công.\n\n💡 Lưu ý: Xe đi qua ô bị tấn công (như ô b1) vẫn được phép nhập thành!',
            en: 'Purpose: Tucks King safely into corner and activates Rook.\n• Kingside (O-O): King moves 2 squares right (e1→g1), Rook jumps to f1.\n• Queenside (O-O-O): King moves 2 squares left (e1→c1), Rook jumps to d1.\n\n5 MANDATORY CONDITIONS:\n1. King and chosen Rook have never moved.\n2. All squares between them are vacant.\n3. King is NOT currently in check.\n4. King does not pass through any attacked square.\n5. King does not land on an attacked square.\n\n💡 Note: The Rook CAN pass through an attacked square (e.g. b1)!',
          },
        },
        {
          type: 'tryit',
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
          solution: ['e1g1'],
          caption: {
            vi: 'Thử ngay: Nhập thành cánh vua cho Trắng bằng cách đi Vua e1 sang g1!',
            en: 'Try it: Castle kingside for White by moving King e1 to g1!',
          },
          whyWrong: {
            vi: 'Di chuyển Vua e1 đến g1 (2 ô về phía Xe cánh vua).',
            en: 'Move King e1 to g1 (two squares towards the Rook).',
          },
        },
      ],
    },
    {
      id: 'en-passant',
      title: { vi: '9. Bắt tốt qua đường (En Passant) ★', en: '9. En Passant ★' },
      special: true,
      summary: {
        vi: 'Nước bắt Tốt đặc biệt khi Tốt đối phương tiến 2 ô vượt qua ô bị Tốt bạn kiểm soát.',
        en: 'A special pawn capture when enemy pawn advances 2 squares past your pawn’s strike zone.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Khi nào xảy ra: Khi Tốt của đối phương từ hàng xuất phát tiến 2 ô và dừng ngay bên cạnh Tốt của bạn (Tốt bạn ở hàng 5 với Trắng, hàng 4 với Đen).\nCách bắt: Tốt của bạn ăn chéo vào ô mà Tốt đối phương VỪA ĐI QUA (như thể nó chỉ tiến 1 ô), và loại Tốt đối phương khỏi bàn cờ.\n⚠️ CHỈ ĐƯỢC BẮT NGAY LẬP TỨC: Nước bắt này chỉ có hiệu lực ngay trong lượt đi kế tiếp! Nếu bạn đi nước khác, quyền bắt tốt qua đường của thế đó sẽ vĩnh viễn biến mất.',
            en: 'When it occurs: When an enemy pawn advances 2 squares from its home rank and lands directly adjacent to your pawn (your pawn on 5th rank for White, 4th rank for Black).\nHow to capture: Your pawn captures diagonally onto the skipped square behind the enemy pawn, removing it from the board.\n⚠️ IMMEDIATELY ONLY: Must be played on the very next turn! If delayed, the right is forfeit.',
          },
        },
        {
          type: 'tryit',
          fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
          solution: ['e5d6'],
          caption: {
            vi: 'Thử ngay: Đen vừa đi d7-d5. Dùng Tốt Trắng e5 ăn tốt qua đường sang d6!',
            en: 'Try it: Black just played d7-d5. Capture en passant with White pawn e5 to d6!',
          },
          whyWrong: {
            vi: 'Đi Tốt từ e5 sang d6 để thực hiện bắt tốt qua đường.',
            en: 'Move pawn e5 to d6 to execute en passant.',
          },
        },
      ],
    },
    {
      id: 'promotion',
      title: { vi: '10. Phong cấp (Pawn Promotion) ★', en: '10. Promotion ★' },
      special: true,
      summary: {
        vi: 'Khi Tốt tiến đến hàng cuối cùng (hàng 8 với Trắng, hàng 1 với Đen), nó được phong cấp!',
        en: 'When a Pawn reaches the furthest rank (rank 8 for White, rank 1 for Black), it promotes!',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: 'Bắt buộc phong cấp: Tốt phải đổi thành Hậu, Xe, Tượng hoặc Mã cùng màu ngay trong nước đi đó (không thành Vua, không giữ nguyên là Tốt).\nKhông giới hạn số lượng: Bạn có thể sở hữu 2, 3 hoặc nhiều Hậu trên bàn cờ cùng lúc!\n"Phong cấp thấp" (Underpromotion): Đa số trường hợp chọn Hậu (quân mạnh nhất), nhưng đôi khi phong thành Mã để chiếu ngay, hoặc thành Xe/Tượng để tránh rơi vào thế Pat.',
            en: 'Mandatory transformation: Pawn must become a Queen, Rook, Bishop, or Knight of same color immediately (cannot remain a Pawn, cannot become a King).\nNo limit: You can have multiple Queens on the board simultaneously!\nUnderpromotion: While Queen is most common, promoting to Knight can deliver immediate forks/checks, or to Rook/Bishop to avoid stalemate.',
          },
        },
        {
          type: 'tryit',
          fen: 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1',
          solution: ['e7e8q', 'e7e8r', 'e7e8b', 'e7e8n'],
          targetMove: 'e7e8q',
          caption: {
            vi: 'Thử ngay: Tiến Tốt e7 lên e8 và phong cấp thành Hậu!',
            en: 'Try it: Advance Pawn e7 to e8 and promote to Queen!',
          },
          whyWrong: {
            vi: 'Hãy đẩy Tốt lên ô e8 để phong cấp.',
            en: 'Push the pawn to e8 to promote.',
          },
        },
      ],
    },
    {
      id: 'draws',
      title: { vi: '11. Các trường hợp Hoà cờ', en: '11. Draw Conditions' },
      summary: {
        vi: 'Các quy định chi tiết dẫn đến kết quả hoà trong thi đấu cờ vua.',
        en: 'Detailed official regulations leading to a draw in chess.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '1. Hết nước đi (Pat): Bên đến lượt không bị chiếu nhưng không có nước đi hợp lệ.\n2. Lặp lại thế cờ 3 lần (Threefold repetition): Cùng một thế cờ (cùng quyền đi, nhập thành, bắt tốt) lặp lại 3 lần trong ván.\n3. Luật 50 nước: 50 nước liên tiếp của cả hai bên không có nước đi Tốt nào và không có quân nào bị ăn.\n4. Không đủ quân chiếu hết: Các trường hợp như Vua đối Vua; Vua+Tượng đối Vua; Vua+Mã đối Vua; Vua+Tượng đối Vua+Tượng cùng màu ô.\n5. Thoả thuận hoà: Một bên gửi lời đề nghị hoà và đối phương đồng ý.',
            en: '1. Stalemate: No legal moves and not in check.\n2. Threefold Repetition: The identical board position occurs 3 times.\n3. 50-Move Rule: 50 consecutive turns without a pawn move or capture.\n4. Insufficient Material: K vs K; K+B vs K; K+N vs K; K+B vs K+B (same-color bishops).\n5. Mutual Agreement: Both players agree to a draw.',
          },
        },
        {
          type: 'board',
          fen: '4k3/4b3/8/8/8/8/4B3/4K3 w - - 0 1',
          caption: {
            vi: 'Vua + Tượng đối Vua + Tượng (Tượng khác màu ô có thể chiếu hết trên lý thuyết, nhưng cùng màu ô là hoà tự động).',
            en: 'Insufficient material example when bishops cannot ever cooperate to force checkmate.',
          },
        },
      ],
    },
    {
      id: 'endings',
      title: { vi: '12. Thắng thua khác & Đồng hồ', en: '12. Resign & Clocks' },
      summary: {
        vi: 'Quy định về đầu hàng (bỏ cuộc) và luật thời gian trong trò chơi.',
        en: 'Rules regarding resignation and chess clocks.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '• Đầu hàng: Người chơi có thể chủ động bấm nút "Đầu hàng" bất cứ lúc nào nếu nhận thấy thế trận không thể cứu vãn.\n• HẾT GIỜ = XỬ THUA: Nếu bạn bật chế độ Đồng hồ trong Cài đặt và để thời gian đếm về 0 trước khi đi quân, bạn sẽ bị xử THUA ngay lập tức (bất kể bạn còn bao nhiêu quân trên bàn cờ).\n• 2 kiểu đồng hồ:\n  - Mỗi nước (Per move): Mỗi lượt có số giây nhất định (ví dụ 30 giây), đi xong sẽ hồi lại đầy đủ cho lượt kế tiếp.\n  - Cả ván (Game clock): Quỹ thời gian chung (ví dụ 10 phút + 5 giây cộng dồn mỗi nước).\n• Cảnh báo 5 giây cuối: Khi còn dưới 5 giây, màn hình sẽ hiện số đếm ngược to và âm thanh nhịp gỗ dồn dập cảnh báo!',
            en: '• Resignation: You can resign at any time if the position is lost.\n• TIMEOUT = LOSS: If clock is enabled and your time expires before moving, you LOSE immediately regardless of material remaining.\n• 2 Clock types:\n  - Per move: Resets each turn (e.g. 30 s).\n  - Game clock: Shared bank with Fischer increment (e.g. 10m + 5s).\n• Last 5 seconds: Prominent visual countdown & rising audio alert!',
          },
        },
      ],
    },
    {
      id: 'notation',
      title: { vi: '13. Ký hiệu nước đi (SAN)', en: '13. Move Notation' },
      summary: {
        vi: 'Cách đọc và ghi chép biên bản các nước đi trong cờ vua.',
        en: 'How to read standard algebraic notation in chess records.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '• Chữ cái đại diện: V (King - K), H (Queen - Q), X (Rook - R), T (Bishop - B), M (Knight - N). Tốt không có chữ cái.\n• Tên ô: chữ cột + số hàng (ví dụ: e4, c5).\n• x: ăn quân (ví dụ: exd5, Nxf6).\n• +: chiếu vua (ví dụ: Qh5+).\n• #: chiếu hết (ví dụ: Qxf7#).\n• O-O: nhập thành cánh vua; O-O-O: nhập thành cánh hậu.\n• =H (=Q): phong cấp thành Hậu.',
            en: '• Piece letters: K (King), Q (Queen), R (Rook), B (Bishop), N (Knight). Pawns have no letter.\n• Square name: file + rank (e.g., e4, c5).\n• x: capture (e.g. exd5, Nxf6).\n• +: check (e.g. Qh5+).\n• #: checkmate (e.g. Qxf7#).\n• O-O: kingside castling; O-O-O: queenside castling.\n• =Q: promotion to Queen.',
          },
        },
      ],
    },
    {
      id: 'tips',
      title: { vi: '14. Mẹo cho người mới bắt đầu', en: '14. Beginner Tips' },
      summary: {
        vi: 'Những nguyên lý chiến thuật cơ bản giúp bạn chơi tốt hơn ngay từ ván đầu.',
        en: 'Fundamental opening principles to elevate your game immediately.',
      },
      blocks: [
        {
          type: 'p',
          text: {
            vi: '1. Kiểm soát trung tâm: Các ô e4, d4, e5, d5 là ngã tư trung tâm quan trọng nhất.\n2. Phát triển Mã và Tượng sớm: Đưa các quân nhẹ ra trận trước khi xuất kích Hậu.\n3. Đừng đưa Hậu ra quá sớm: Hậu dễ bị các quân nhỏ của đối phương tấn công đuổi bắt.\n4. Nhập thành sớm: Bảo vệ an toàn cho Vua và kết nối hai Xe.\n5. Đặt câu hỏi trước mỗi nước: "Đối phương vừa đi nước đó nhằm đe dọa điều gì?"',
            en: '1. Control the center: Squares e4, d4, e5, d5 dominate the board.\n2. Develop Knights & Bishops early.\n3. Avoid bringing the Queen out prematurely.\n4. Castle early for King safety.\n5. Always ask: "What does my opponent’s last move threaten?"',
          },
        },
      ],
    },
    {
      id: 'glossary',
      title: { vi: '15. Bảng thuật ngữ Cờ vua', en: '15. Chess Glossary' },
      summary: {
        vi: 'Bảng đối chiếu thuật ngữ Cờ vua Việt - Anh.',
        en: 'Bilingual Vietnamese - English chess terminology table.',
      },
      blocks: [
        {
          type: 'glossary',
          terms: [
            { vi: 'Chiếu', en: 'Check', desc: 'Đe dọa bắt Vua' },
            { vi: 'Chiếu hết', en: 'Checkmate', desc: 'Vua bị chiếu không thể thoát' },
            { vi: 'Pat', en: 'Stalemate', desc: 'Hết nước đi hợp lệ và không bị chiếu' },
            { vi: 'Nhập thành', en: 'Castling', desc: 'Vua và Xe cùng di chuyển' },
            { vi: 'Bắt tốt qua đường', en: 'En passant', desc: 'Ăn Tốt vừa nhảy 2 ô' },
            { vi: 'Phong cấp', en: 'Promotion', desc: 'Tốt đến hàng cuối biến thành quân khác' },
            { vi: 'Ghim', en: 'Pin', desc: 'Quân không thể rời đi vì để lộ Vua/quân lớn' },
            { vi: 'Chiếu đôi', en: 'Double check', desc: 'Hai quân cùng chiếu Vua' },
            { vi: 'Đòn đôi', en: 'Fork', desc: 'Một quân tấn công cùng lúc hai mục tiêu' },
            { vi: 'Khai cuộc', en: 'Opening', desc: 'Giai đoạn phát triển quân ban đầu' },
            { vi: 'Tàn cuộc', en: 'Endgame', desc: 'Giai đoạn ít quân tranh tài' },
          ],
        },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RULES_SECTIONS;
  } else if (typeof window !== 'undefined') {
    window.RULES_SECTIONS = RULES_SECTIONS;
  }
})();
