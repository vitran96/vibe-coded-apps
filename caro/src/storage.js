'use strict';
// 02 storage (settings + records)
// ============================================================
const store = House.store(STORAGE_PREFIX, { legacy: ['caro.'] });
addEventListener('housestoragefail', () => toast(t('storage.failed')));

// Merge only known keys with matching types/enums, so corrupt storage can't break the app.
function mergeKnown(def, src) {
  const out = {};
  for (const k of Object.keys(def)) {
    const d = def[k], s = src ? src[k] : undefined;
    if (d && typeof d === 'object') out[k] = mergeKnown(d, s && typeof s === 'object' ? s : {});
    else if (typeof s === typeof d && (!ENUMS[k] || ENUMS[k].includes(s))) out[k] = typeof s === 'string' ? s.slice(0, 40) : s;
    else out[k] = d;
  }
  return out;
}
function loadSettings() {
  const raw = store.get(LS.settings);
  const def = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (IS_TOUCH_DEVICE) def.display.cellSize = 'large';
  if (raw?.display) raw.display.lang = { vn: 'vi', eng: 'en' }[raw.display.lang] ?? raw.display.lang; // 1.1.0 codes
  const s = mergeKnown(def, raw && raw.v === 1 ? raw : {});
  // Migrate: ensure spa music is off by default
  if (!raw || !raw.audio || !raw.audio.spaV1) {
    s.audio.musicOn = false;
    s.audio.spaV1 = true;
  }
  s.audio.musicVol = clamp(s.audio.musicVol, 0, 100); s.audio.sfxVol = clamp(s.audio.sfxVol, 0, 100);
  return s;
}
const saveSettings = () => store.set(LS.settings, App.settings);

function validMoves(moves, N) {
  return Array.isArray(moves) && moves.every(m => m && (m.p === 1 || m.p === 2) &&
    (m.pass === true || (Number.isInteger(m.x) && Number.isInteger(m.y) && m.x >= 0 && m.y >= 0 && m.x < N && m.y < N)));
}
function validSession(s) {
  return s && BOARD_SIZES.includes(s.boardSize) && ['pve', 'pvp'].includes(s.mode) && s.rules && s.timer && s.players &&
    (s.firstPlayer === 1 || s.firstPlayer === 2) && (s.mode === 'pvp' || (s.ai && (s.ai.side === 1 || s.ai.side === 2)));
}
function validRecord(r) {
  return r && typeof r.id === 'string' && validSession(r.session) && validMoves(r.moves, r.session.boardSize) &&
    r.result && [0, 1, 2].includes(r.result.winner);
}
function loadRecords() {
  const raw = store.get(LS.records);
  if (!raw || raw.v !== 1 || !Array.isArray(raw.items)) return [];
  return raw.items.filter(validRecord).slice(0, MAX_RECORDS);
}
function saveRecords() {
  App.records = App.records.slice(0, MAX_RECORDS);
  if (!store.set(LS.records, { v: 1, items: App.records })) {
    // quota: drop the oldest half and retry once
    App.records = App.records.slice(0, Math.ceil(App.records.length / 2));
    store.set(LS.records, { v: 1, items: App.records });
  }
}

/*@@PURE-START@@*/
// ============================================================
