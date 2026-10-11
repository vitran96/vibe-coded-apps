// House kit "Mộc" — shared by every game. Plain script (no imports) so it inlines into a single HTML.
// Exposes window.House. Games add their own strings/sounds on top; they do not change these.
(() => {
  const THEMES = ['auto', 'giay', 'dem', 'sonmai', 'bien'];
  const PREFS_KEY = 'house:prefs'; // the ONE intentionally shared key: theme + language follow the player across games

  const prefs = {
    load() {
      try { const p = JSON.parse(localStorage.getItem(PREFS_KEY)); if (p && p.v === 1) return p; } catch {}
      return { v: 1, theme: 'auto', lang: 'vi' };
    },
    save(patch) {
      const next = { ...prefs.load(), ...patch, v: 1 };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    },
  };

  const dark = matchMedia('(prefers-color-scheme: dark)');
  const resolve = (name) => (name === 'auto' || !THEMES.includes(name)) ? (dark.matches ? 'dem' : 'giay') : name;

  function applyTheme(name) {
    const id = resolve(name);
    document.documentElement.dataset.theme = id;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = bg;
    dispatchEvent(new CustomEvent('housethemechange', { detail: { name, id } }));
    return id;
  }
  dark.addEventListener('change', () => { if (prefs.load().theme === 'auto') applyTheme('auto'); });

  // Colors for Three.js: read the CSS tokens so the 3D scene always matches the UI.
  const TOKENS = ['bg', 'surface', 'surface-2', 'line', 'ink', 'muted', 'accent', 'accent-2', 'p1', 'p2', 'board', 'board-line', 'ok', 'warn', 'danger'];
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(TOKENS.map((k) => [k, cs.getPropertyValue('--' + k).trim()]));
  }

  // Shared UI strings. Games merge their own keys: House.i18n.add({ vi: {...}, en: {...} }).
  const dict = {
    vi: {
      'app.by': 'Một trò chơi nhỏ của {maker}',
      'common.play': 'Chơi', 'common.newGame': 'Ván mới', 'common.resume': 'Chơi tiếp', 'common.rematch': 'Đấu lại',
      'common.undo': 'Đi lại', 'common.settings': 'Cài đặt', 'common.history': 'Lịch sử', 'common.replay': 'Xem lại',
      'common.close': 'Đóng', 'common.cancel': 'Huỷ', 'common.confirm': 'Đồng ý', 'common.back': 'Quay lại', 'common.install': 'Cài ứng dụng',
      'mode.pve': 'Chơi với máy', 'mode.pvp': 'Hai người', 'ai.easy': 'Dễ', 'ai.medium': 'Vừa', 'ai.hard': 'Khó',
      'result.win': '{name} thắng!', 'result.youWin': 'Bạn thắng rồi!', 'result.youLose': 'Thua mất rồi…', 'result.draw': 'Hoà!',
      'result.forfeit': '{name} bỏ cuộc', 'result.timeout': '{name} hết giờ', 'turn.of': 'Lượt của {name}', 'ai.thinking': 'Máy đang nghĩ…',
      'settings.game': 'Trò chơi', 'settings.audio': 'Âm thanh', 'settings.look': 'Giao diện', 'settings.data': 'Dữ liệu', 'settings.about': 'Thông tin',
      'settings.music': 'Nhạc nền', 'settings.sfx': 'Hiệu ứng âm thanh', 'settings.volume': 'Âm lượng',
      'settings.theme': 'Chủ đề', 'settings.language': 'Ngôn ngữ', 'settings.reduceMotion': 'Giảm chuyển động',
      'settings.clearHistory': 'Xoá lịch sử', 'settings.reset': 'Khôi phục mặc định', 'settings.version': 'Phiên bản {v}',
      'theme.auto': 'Tự động', 'theme.giay': 'Giấy', 'theme.dem': 'Đêm', 'theme.sonmai': 'Sơn mài', 'theme.bien': 'Biển',
      'audio.tapToEnable': 'Chạm để bật âm thanh', 'storage.failed': 'Không lưu được dữ liệu trên trình duyệt này',
    },
    en: {
      'app.by': 'A small game by {maker}',
      'common.play': 'Play', 'common.newGame': 'New game', 'common.resume': 'Resume', 'common.rematch': 'Rematch',
      'common.undo': 'Undo', 'common.settings': 'Settings', 'common.history': 'History', 'common.replay': 'Replay',
      'common.close': 'Close', 'common.cancel': 'Cancel', 'common.confirm': 'OK', 'common.back': 'Back', 'common.install': 'Install app',
      'mode.pve': 'Vs computer', 'mode.pvp': 'Two players', 'ai.easy': 'Easy', 'ai.medium': 'Medium', 'ai.hard': 'Hard',
      'result.win': '{name} wins!', 'result.youWin': 'You win!', 'result.youLose': 'You lost…', 'result.draw': 'Draw!',
      'result.forfeit': '{name} forfeited', 'result.timeout': '{name} ran out of time', 'turn.of': "{name}'s turn", 'ai.thinking': 'Thinking…',
      'settings.game': 'Game', 'settings.audio': 'Sound', 'settings.look': 'Appearance', 'settings.data': 'Data', 'settings.about': 'About',
      'settings.music': 'Music', 'settings.sfx': 'Sound effects', 'settings.volume': 'Volume',
      'settings.theme': 'Theme', 'settings.language': 'Language', 'settings.reduceMotion': 'Reduce motion',
      'settings.clearHistory': 'Clear history', 'settings.reset': 'Reset to defaults', 'settings.version': 'Version {v}',
      'theme.auto': 'Auto', 'theme.giay': 'Paper', 'theme.dem': 'Night', 'theme.sonmai': 'Lacquer', 'theme.bien': 'Sea',
      'audio.tapToEnable': 'Tap to enable sound', 'storage.failed': "Saving isn't available in this browser",
    },
  };
  let lang = 'vi';
  const i18n = {
    add(more) { for (const l in more) Object.assign(dict[l] ??= {}, more[l]); },
    t(key, params = {}) {
      const s = dict[lang]?.[key] ?? dict.vi[key] ?? key;
      return s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    },
    setLang(l) {
      lang = dict[l] ? l : 'vi';
      document.documentElement.lang = lang;
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = i18n.t(el.dataset.i18n); });
      dispatchEvent(new CustomEvent('houselangchange', { detail: { lang } }));
    },
    get lang() { return lang; },
  };

  // Shared sound character: soft wooden marimba, C-major pentatonic. Same names in every game.
  const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, A4: 440, E4: 329.63, C4: 261.63 };
  function pluck(ctx, out, freq, at, dur = 0.25, gain = 0.5) {
    const g = ctx.createGain(); g.connect(out);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    for (const [mult, level] of [[1, 1], [4, 0.12]]) { // fundamental + quiet 4th harmonic = wooden bar
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * mult; og.gain.value = level;
      o.connect(og).connect(g); o.start(at); o.stop(at + dur + 0.05);
    }
  }
  const SFX = {
    tap:     (c, o, t) => pluck(c, o, NOTE.G5, t, 0.08, 0.25),
    place:   (c, o, t, p = 1) => pluck(c, o, p === 1 ? NOTE.C5 : NOTE.E5, t, 0.18, 0.6),
    invalid: (c, o, t) => { pluck(c, o, NOTE.E4, t, 0.12, 0.4); pluck(c, o, NOTE.C4, t + 0.08, 0.16, 0.4); },
    tick:    (c, o, t) => pluck(c, o, NOTE.A5, t, 0.05, 0.2),
    open:    (c, o, t) => { pluck(c, o, NOTE.C5, t, 0.1, 0.25); pluck(c, o, NOTE.G5, t + 0.05, 0.12, 0.25); },
    close:   (c, o, t) => { pluck(c, o, NOTE.G5, t, 0.1, 0.25); pluck(c, o, NOTE.C5, t + 0.05, 0.12, 0.25); },
    win:     (c, o, t) => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => pluck(c, o, NOTE[n], t + i * 0.09, 0.5, 0.5)),
    lose:    (c, o, t) => { pluck(c, o, NOTE.A4, t, 0.4, 0.4); pluck(c, o, NOTE.E4, t + 0.18, 0.6, 0.4); },
    draw:    (c, o, t) => ['C5', 'E5', 'G5'].forEach((n) => pluck(c, o, NOTE[n], t, 0.6, 0.25)),
  };
  function play(ctx, out, name, ...args) { SFX[name]?.(ctx, out, ctx.currentTime + 0.01, ...args); }

  window.House = { THEMES, prefs, resolve, applyTheme, palette, i18n, SFX, play };
})();
