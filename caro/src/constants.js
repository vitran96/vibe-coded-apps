'use strict';
// ============================================================
// 01 constants & defaults
// ============================================================
const APP_VERSION = '2.2.0';
const BOARD_SIZES = [30];
const TIME_PRESETS = [5, 10, 15, 30, 45, 60, 90, 120, 300];
const STORAGE_PREFIX = 'caro_'; // House.store adds it; legacy 'caro.' keys are still read
const LS = { settings: 'settings', current: 'current', records: 'records', iosHint: 'iosHint' };
const MAX_RECORDS = 200;
const DEFAULT_SETTINGS = {
  v: 1,
  game: {
    mode: 'pve', difficulty: 'medium', playAs: 'x', rule: 'caro', exactFive: false, edgeBlocks: false,
    boardSize: 30, timerEnabled: false, timerSeconds: 30, onTimeout: 'lose', name1: '', name2: '',
    allowUndo: true,
  },
  audio: { musicOn: false, musicVol: 45, sfxOn: true, sfxVol: 75, spaV1: true },
  display: { lang: 'vi', cellSize: 'normal', pieceStyle: 'xo', tapConfirm: 'auto', showCoords: true, reduceMotion: 'system' },
};
const ENUMS = {
  mode: ['pve', 'pvp'], difficulty: ['easy', 'medium', 'hard'], playAs: ['x', 'o', 'random'], rule: ['gomoku', 'caro'],
  boardSize: BOARD_SIZES, timerSeconds: TIME_PRESETS, onTimeout: ['lose', 'skip'],
  lang: ['vi', 'en'],
  cellSize: ['normal', 'large', 'huge'],
  pieceStyle: ['auto', 'xo', 'stones'], tapConfirm: ['auto', 'always', 'never'], reduceMotion: ['system', 'on', 'off'],
};
const AI_DELAY = { easy: 300, medium: 450, hard: 400 };
const IS_COARSE = matchMedia('(pointer: coarse)').matches;
const IS_TOUCH_DEVICE = (() => {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      IS_COARSE ||
      (navigator.maxTouchPoints > 0);
  } catch { return false; }
})();
const AI_BUDGET = IS_TOUCH_DEVICE ? 800 : 1200;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colName = i => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
const coordName = (x, y, N) => colName(x) + (N - y);
const pieceName = p => (p === 1 ? 'X' : 'O');

