'use strict';
const I18N = {
  vi: {
    'defaultNameX': 'Người chơi X',
    'defaultNameO': 'Người chơi O',
    'minutesShort': (n) => `${n}p`,
    'optAuto': 'Tự động',
    'optTouchAuto': 'Tự động (cảm ứng)',
    'optStones': 'Quân tròn',
    'optCellNormal': 'Vừa',
    'optCellLarge': 'Lớn (iPad/iPhone)',
    'optCellHuge': 'Rất lớn',
    'optAlways': 'Luôn hỏi',
    'optNever': 'Không hỏi',
    'optSystem': 'Hệ thống',
    'optOn': 'Bật',
    'optOff': 'Tắt',
    'appTitle': 'Cờ Caro & Gomoku',
    'undo': 'Hoàn tác',
    'fit': 'Vừa bàn',
    'menu': 'Menu',
    'moveNo': (n) => `Nước ${n}`,
    'turnPlayer': (name) => `Lượt của ${name}`,
    'aiThinking': 'AI đang suy nghĩ...',
    'startNewGame': 'Bắt đầu ván mới',
    'soundHint': '🔊 Chạm để bật âm thanh',
    'viewingReplay': 'Đang xem lại ván đấu',
    'playAsYou': 'Bạn',

    'menuTitle': 'Cờ Caro & Gomoku',
    'resume': '▶ Tiếp tục',
    'vsBot': '🤖 Đấu với Máy',
    'vsPlayer': '👥 2 Người chơi',
    'newGame': '➕ Ván mới',
    'restart': '🔄 Chơi lại',
    'replay': '⏪ Xem lại & Lịch sử',
    'settings': '⚙️ Cài đặt',
    'menuForfeit': '🏳️ Đầu hàng',
    'menuHelp': '📖 Hướng dẫn',
    'helpTitle': 'Hướng dẫn chơi',
    'helpBody': `<h3>Mục tiêu</h3><p>Xếp <b>năm quân liên tiếp</b> theo hàng ngang, dọc hoặc chéo.</p>
      <h3>Luật</h3>
      <ul>
        <li><b>Gomoku (tự do):</b> từ năm quân trở lên là thắng. Với “Chỉ đúng năm”, sáu quân trở lên không được tính.</li>
        <li><b>Caro (luật chặn hai đầu):</b> năm quân chỉ thắng nếu <i>không bị chặn cả hai đầu</i> bởi đối phương. Có thể chọn để mép bàn cờ cũng được tính là chặn.</li>
      </ul>
      <h3>Cảm ứng</h3>
      <ul><li>Chạm để đặt quân (nếu bật xác nhận: chạm lần nữa hoặc bấm ✓).</li><li>Kéo để di chuyển bàn cờ, hai ngón để phóng to hoặc thu nhỏ.</li><li>Chạm đúp vào ô đã có quân hoặc ngoài bàn cờ để phóng to.</li></ul>
      <h3>Chuột và bàn phím</h3>
      <ul><li>Nhấp để đặt quân, kéo để di chuyển, lăn chuột để phóng to hoặc thu nhỏ.</li><li><kbd>←↑→↓</kbd> di chuyển con trỏ, <kbd>Enter</kbd>/<kbd>Space</kbd> đặt quân, <kbd>+</kbd>/<kbd>-</kbd> phóng to hoặc thu nhỏ.</li></ul>
      <h3>Phím tắt</h3>
      <ul><li><kbd>N</kbd> ván mới · <kbd>H</kbd> lịch sử · <kbd>S</kbd> cài đặt · <kbd>?</kbd> hướng dẫn · <kbd>M</kbd> bật/tắt âm thanh</li><li><kbd>U</kbd> đi lại · <kbd>F</kbd> vừa bàn cờ · <kbd>Esc</kbd> đóng cửa sổ</li></ul>
      <h3>Âm thanh</h3><p>Âm thanh bật sau lần chạm đầu tiên. Trên iPhone, công tắc im lặng phần cứng có thể tắt âm thanh trên web.</p>
      <h3>Cài đặt ứng dụng</h3><p>Trên iPhone/iPad: Safari → Chia sẻ → <b>Thêm vào Màn hình chính</b>. Trên Android hoặc Chrome máy tính, dùng “Cài ứng dụng” trong menu.</p>`,

    'gameMode': 'Chế độ chơi',
    'vsAI': 'Đấu với Máy',
    'twoPlayers': '2 Người chơi',
    'aiDifficulty': 'Độ khó AI',
    'easy': 'Dễ',
    'medium': 'Vừa',
    'hard': 'Khó',
    'playAs': 'Bạn cầm quân',
    'xFirst': 'X (đi trước)',
    'oSecond': 'O (đi sau)',
    'random': 'Ngẫu nhiên',
    'player1': 'Người chơi 1 (X)',
    'player2': 'Người chơi 2 (O)',
    'defaultP1': 'Người chơi X',
    'defaultP2': 'Người chơi O',
    'rule': 'Luật chơi',
    'ruleCaro': 'Caro (Chặn 2 đầu)',
    'ruleGomoku': 'Gomoku (Tự do)',
    'caroExplain': 'Thắng khi có 5 quân liên tiếp không bị chặn cả 2 đầu.',
    'gomokuExplain': 'Thắng khi có từ 5 quân liên tiếp trở lên.',
    'edgeBlocks': 'Mép bàn tính là chặn',
    'edgeBlocksSub': 'Mép bàn cờ có tác dụng như quân đối thủ',
    'exactFive': 'Đúng 5 quân',
    'exactFiveSub': 'Hàng 6 quân trở lên không tính thắng',
    'turnTimer': 'Đồng hồ nước đi',
    'turnTimerSub': 'Giới hạn thời gian mỗi nước',
    'timePerTurn': 'Thời gian mỗi nước',
    'onTimeout': 'Khi hết giờ',
    'loseGame': 'Xử thua',
    'skipTurn': 'Mất lượt',
    'saveAsDefault': 'Lưu làm mặc định',
    'cancel': 'Hủy',
    'startGame': 'Bắt đầu',
    'ok': 'Đồng ý',

    'settingsTitle': 'Cài đặt',
    'ruleSettingsSec': 'Cài đặt luật chơi',
    'ruleSettingsNote': 'Áp dụng cho ván mới — ván đang chơi giữ nguyên luật.',
    'otherSettingsSec': 'Cài đặt chung',
    'language': 'Ngôn ngữ',
    'undoBtn': 'Nút hoàn tác',
    'undoBtnSub': 'Hiển thị nút hoàn tác trên thanh công cụ',
    'cellSize': 'Kích thước ô (chạm tay)',
    'sizeNormal': 'Vừa',
    'sizeLarge': 'Lớn (iPad/iPhone)',
    'sizeHuge': 'Rất lớn',
    'pieceStyle': 'Kiểu quân cờ',
    'styleAuto': 'Tự động',
    'styleXo': 'X-O',
    'styleStones': 'Quân tròn',
    'tapConfirm': 'Xác nhận khi chạm',
    'tapAuto': 'Tự động (cảm ứng)',
    'tapAlways': 'Luôn hỏi',
    'tapNever': 'Không hỏi',
    'showCoords': 'Hiện tọa độ mép bàn',
    'reduceMotion': 'Giảm chuyển động',
    'motionSystem': 'Hệ thống',
    'motionOn': 'Bật',
    'motionOff': 'Tắt',
    'audioSec': 'Âm thanh',
    'music': 'Nhạc nền (spa thư giãn)',
    'sfx': 'Hiệu ứng âm thanh',
    'iphoneNote': 'Trên iPhone, gạt rung có thể tắt âm thanh web.',
    'dataSec': 'Dữ liệu',
    'exportHist': 'Xuất lịch sử (JSON)',
    'importHist': 'Nhập lịch sử (JSON)',
    'clearHist': 'Xóa lịch sử đấu',
    'resetSettings': 'Khôi phục mặc định',
    'version': 'Phiên bản',
    'done': 'Xong',

    'confirmPlace': '✓ Đặt quân',
    'cancelPlace': '✕',
    'placeHerePrompt': 'Đặt quân tại đây?',
    'speed': 'Tốc độ',
    'realTiming': 'Thời gian thực',
    'numbers': 'Số thứ tự',
    'playFromHere': 'Chơi từ đây',
    'exitReplay': 'Thoát',

    'historyTitle': 'Lịch sử ván đấu',
    'filterMode': 'Lọc chế độ',
    'filterResult': 'Lọc kết quả',
    'allModes': 'Tất cả chế độ',
    'allResults': 'Tất cả kết quả',
    'wonVsAI': 'Thắng Máy',
    'lostVsAI': 'Thua Máy',
    'xWon': 'X thắng',
    'oWon': 'O thắng',
    'draw': 'Hòa',
    'forfeit': 'Đầu hàng',
    'abandoned': 'Bỏ dở',
    'noRecords': 'Chưa có lịch sử ván đấu',
    'movesCount': (n) => `${n} nước`,
    'replayBtn': 'Xem lại',
    'deleteBtnTitle': 'Xóa ván đấu',

    'youWin': 'Bạn đã thắng! 🎉',
    'aiWins': 'Máy đã thắng!',
    'playerWins': (name) => `${name} đã thắng!`,
    'drawGame': 'Hòa cờ!',
    'youForfeited': 'Bạn đã đầu hàng (Máy thắng)',
    'aiForfeited': 'Máy đã đầu hàng (Bạn thắng)',
    'playerForfeited': (name) => `${name} đã đầu hàng`,
    'reasonFive': (turn) => `5 ô liên tiếp (lượt của ${turn})`,
    'reasonTimeout': (turn) => `Thắng do hết giờ (lượt của ${turn})`,
    'reasonForfeit': (turn) => `Đầu hàng ở lượt của ${turn}`,
    'reasonDraw': (turn) => `Hết ô cờ (lượt của ${turn})`,
    'rematch': '🔄 Đấu lại',
    'watchReplay': '⏪ Xem lại',
    'close': 'Đóng',

    'confirmForfeitTitle': 'Đầu hàng ván cờ?',
    'confirmForfeitSub': 'Bạn sẽ chấp nhận thua ván này.',
    'noGameToForfeit': 'Không có ván đang chơi để đầu hàng',
    'confirmRestartTitle': 'Chơi lại ván này?',
    'confirmRestartSub': 'Các nước đi hiện tại sẽ được xóa.',
    'gameRestarted': 'Đã chơi lại ván cờ',
    'confirmClearTitle': 'Xóa toàn bộ lịch sử đấu?',
    'confirmClearSub': 'Hành động này không thể hoàn tác.',
    'historyCleared': 'Đã xóa toàn bộ lịch sử',
    'confirmResetTitle': 'Khôi phục tất cả cài đặt về mặc định?',
    'settingsReset': 'Đã khôi phục cài đặt mặc định',
    'confirmResumeTitle': 'Tiếp tục ván chơi trước?',
    'confirmResumeSub': (rule, n) => `Ván cờ ${rule} đang chơi với ${n} nước.`,
    'resumedPrevGame': 'Đã tiếp tục ván trước',
    'importedRecords': (n) => `Đã nhập ${n} ván đấu`,
    'invalidJson': 'Tệp không đúng định dạng',
    'recordDeleted': 'Đã xóa ván đấu',
    'settingsSaved': 'Đã lưu cài đặt',
    'startNewConfirmTitle': 'Bắt đầu ván mới?',
    'startNewConfirmSub': 'Ván hiện tại sẽ bị hủy.',
    'savedAsDefault': 'Đã lưu làm mặc định',
    'settingsUpdated': 'Đã cập nhật cài đặt',
    'startFromReplay': 'Đã bắt đầu ván mới từ vị trí xem lại',
    'timeoutTurnSkipped': (name) => `${name} hết giờ — mất lượt`
  },
  en: {
    'defaultNameX': 'Player X',
    'defaultNameO': 'Player O',
    'minutesShort': (n) => `${n}m`,
    'optAuto': 'Auto',
    'optTouchAuto': 'Auto (touch)',
    'optStones': 'Stones',
    'optCellNormal': 'Normal',
    'optCellLarge': 'Large (iPad/iPhone)',
    'optCellHuge': 'Extra Large',
    'optAlways': 'Always',
    'optNever': 'Never',
    'optSystem': 'System',
    'optOn': 'On',
    'optOff': 'Off',
    'appTitle': 'Caro & Gomoku',
    'undo': 'Undo',
    'fit': 'Fit',
    'menu': 'Menu',
    'moveNo': (n) => `Move ${n}`,
    'turnPlayer': (name) => `${name}'s turn`,
    'aiThinking': 'AI is thinking...',
    'startNewGame': 'Start a new game',
    'soundHint': '🔊 Tap to enable sound',
    'viewingReplay': 'Viewing replay',
    'playAsYou': 'You',

    'menuTitle': 'Caro & Gomoku',
    'resume': '▶ Resume',
    'vsBot': '🤖 VS Bot',
    'vsPlayer': '👥 2 Players',
    'newGame': '➕ New Game',
    'restart': '🔄 Restart',
    'replay': '⏪ History & Replay',
    'settings': '⚙️ Settings',
    'menuForfeit': '🏳️ Forfeit',
    'menuHelp': '📖 How to play',
    'helpTitle': 'How to play',
    'helpBody': `<h3>Goal</h3><p>Get <b>five in a row</b> — horizontally, vertically or diagonally.</p>
      <h3>Rules</h3>
      <ul>
        <li><b>Gomoku (freestyle):</b> five or more in a row wins. With “Exact five only”, six or more does not count.</li>
        <li><b>Caro (Blocked-End Rule):</b> a five only wins if <i>not both ends</i> are blocked by the opponent. Optionally the board edge also counts as a block.</li>
      </ul>
      <h3>Touch</h3>
      <ul><li>Tap to place (with tap-to-confirm: tap again or press ✓).</li><li>Drag to pan, pinch to zoom.</li><li>Double-tap an occupied spot or outside the board to zoom in.</li></ul>
      <h3>Mouse &amp; keyboard</h3>
      <ul><li>Click to place, drag to pan, wheel to zoom.</li><li><kbd>←↑→↓</kbd> move cursor, <kbd>Enter</kbd>/<kbd>Space</kbd> place, <kbd>+</kbd>/<kbd>-</kbd> zoom.</li></ul>
      <h3>Shortcuts</h3>
      <ul><li><kbd>N</kbd> new game · <kbd>H</kbd> history · <kbd>S</kbd> settings · <kbd>?</kbd> how to play · <kbd>M</kbd> sound on/off</li><li><kbd>U</kbd> undo · <kbd>F</kbd> fit board · <kbd>Esc</kbd> close dialog</li></ul>
      <h3>Sound</h3><p>Audio starts after your first tap. On iPhone, the hardware silent switch may mute web audio.</p>
      <h3>Install</h3><p>On iPhone/iPad: Safari → Share → <b>Add to Home Screen</b>. On Android/desktop Chrome use “Install app” in the menu.</p>`,

    'gameMode': 'Game mode',
    'vsAI': 'vs AI',
    'twoPlayers': '2 Players',
    'aiDifficulty': 'AI Difficulty',
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard',
    'playAs': 'Play as',
    'xFirst': 'X (first)',
    'oSecond': 'O (second)',
    'random': 'Random',
    'player1': 'Player 1 (X)',
    'player2': 'Player 2 (O)',
    'defaultP1': 'Player X',
    'defaultP2': 'Player O',
    'rule': 'Rule',
    'ruleCaro': 'Caro (Blocked-End)',
    'ruleGomoku': 'Gomoku (Freestyle)',
    'caroExplain': 'Win with 5 in a row that is not blocked at both ends.',
    'gomokuExplain': 'Win with 5 or more in a row.',
    'edgeBlocks': 'Edge counts as block',
    'edgeBlocksSub': 'Board edge acts like opponent stone',
    'exactFive': 'Exact five only',
    'exactFiveSub': 'Overlines (6+) do not win',
    'turnTimer': 'Turn timer',
    'turnTimerSub': 'Limit time per move',
    'timePerTurn': 'Time per turn',
    'onTimeout': 'On timeout',
    'loseGame': 'Lose game',
    'skipTurn': 'Skip turn',
    'saveAsDefault': 'Save as my default',
    'cancel': 'Cancel',
    'startGame': 'Start game',
    'ok': 'OK',

    'settingsTitle': 'Settings',
    'ruleSettingsSec': 'Game rule settings',
    'ruleSettingsNote': 'Applies to new games — in-progress games keep their rules.',
    'otherSettingsSec': 'Other settings',
    'language': 'Language',
    'undoBtn': 'Undo button',
    'undoBtnSub': 'Show undo button in toolbar',
    'cellSize': 'Cell size (finger touch)',
    'sizeNormal': 'Normal',
    'sizeLarge': 'Large (iPad/iPhone)',
    'sizeHuge': 'Extra Large',
    'pieceStyle': 'Piece style',
    'styleAuto': 'Auto',
    'styleXo': 'X-O',
    'styleStones': 'Stones',
    'tapConfirm': 'Tap-to-confirm',
    'tapAuto': 'Auto (touch)',
    'tapAlways': 'Always',
    'tapNever': 'Never',
    'showCoords': 'Show coordinates',
    'reduceMotion': 'Reduce motion',
    'motionSystem': 'System',
    'motionOn': 'On',
    'motionOff': 'Off',
    'audioSec': 'Audio',
    'music': 'Music (relaxing spa)',
    'sfx': 'Sound effects',
    'iphoneNote': 'On iPhone, the hardware silent switch may mute web audio.',
    'dataSec': 'Data',
    'exportHist': 'Export history (JSON)',
    'importHist': 'Import history (JSON)',
    'clearHist': 'Clear game history',
    'resetSettings': 'Reset all settings',
    'version': 'Version',
    'done': 'Done',

    'confirmPlace': '✓ Place',
    'cancelPlace': '✕',
    'placeHerePrompt': 'Place stone here?',
    'speed': 'Speed',
    'realTiming': 'Real timing',
    'numbers': 'Numbers',
    'playFromHere': 'Play from here',
    'exitReplay': 'Exit replay',

    'historyTitle': 'Game history',
    'filterMode': 'Filter by mode',
    'filterResult': 'Filter by result',
    'allModes': 'All modes',
    'allResults': 'All results',
    'wonVsAI': 'Won vs AI',
    'lostVsAI': 'Lost vs AI',
    'xWon': 'X won',
    'oWon': 'O won',
    'draw': 'Draw',
    'forfeit': 'Forfeit',
    'abandoned': 'Abandoned',
    'noRecords': 'No game records found',
    'movesCount': (n) => `${n} moves`,
    'replayBtn': 'Replay',
    'deleteBtnTitle': 'Delete record',

    'youWin': 'You win!',
    'aiWins': 'AI wins!',
    'playerWins': (name) => `${name} wins!`,
    'drawGame': 'Draw game!',
    'youForfeited': 'You forfeited',
    'aiForfeited': 'AI forfeited (You win)',
    'playerForfeited': (name) => `${name} forfeited`,
    'reasonFive': (turn) => `Five in a row (${turn}'s turn)`,
    'reasonTimeout': (turn) => `Won by timeout (${turn}'s turn)`,
    'reasonForfeit': (turn) => `Forfeited at ${turn}'s turn`,
    'reasonDraw': (turn) => `Board is full (${turn}'s turn)`,
    'rematch': '🔄 Rematch',
    'watchReplay': '⏪ Watch Replay',
    'close': 'Close',

    'confirmForfeitTitle': 'Forfeit game?',
    'confirmForfeitSub': 'You will concede this game.',
    'noGameToForfeit': 'No active game to forfeit',
    'confirmRestartTitle': 'Restart game?',
    'confirmRestartSub': 'Current moves will be reset.',
    'gameRestarted': 'Game restarted',
    'confirmClearTitle': 'Clear all game records?',
    'confirmClearSub': 'This action cannot be undone.',
    'historyCleared': 'History cleared',
    'confirmResetTitle': 'Reset all settings to defaults?',
    'settingsReset': 'Settings reset to defaults',
    'confirmResumeTitle': 'Resume previous game?',
    'confirmResumeSub': (rule, n) => `In-progress ${rule} game with ${n} moves.`,
    'resumedPrevGame': 'Resumed previous game',
    'importedRecords': (n) => `Imported ${n} game records`,
    'invalidJson': 'Invalid file format',
    'recordDeleted': 'Record deleted',
    'settingsSaved': 'Settings saved',
    'startNewConfirmTitle': 'Start new game?',
    'startNewConfirmSub': 'Current game will be abandoned.',
    'savedAsDefault': 'Saved as default',
    'settingsUpdated': 'Settings updated',
    'startFromReplay': 'Started new game from replay position',
    'timeoutTurnSkipped': (name) => `${name} timed out — turn skipped`
  }
};

function t(key, ...args) {
  const dict = I18N[House.i18n.lang] || I18N.vi;
  const val = dict[key] ?? I18N.vi[key] ?? House.i18n.t(key);
  return typeof val === 'function' ? val(...args) : val;
}

// Sets the language for the whole page and mirrors it to the shared house:prefs key.
function setLang(lang) {
  House.i18n.setLang(lang);
  House.prefs.save({ lang: House.i18n.lang });
  applyI18n();
}

House.i18n.add({ vi: I18N.vi, en: I18N.en });

function applyI18n() {
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = t(el.dataset.i18nHtml);
    if (val) el.innerHTML = val; // dictionary markup only, never user text
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    const val = t(k);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const k = el.dataset.i18nTitle;
    const val = t(k);
    if (val) el.title = val;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const k = el.dataset.i18nAria;
    const val = t(k);
    if (val) el.setAttribute('aria-label', val);
  });
  labelSwitches();
  if (App?.game) App.game.updateHUD();
}

