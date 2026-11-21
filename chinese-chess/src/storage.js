// storage.js — saved settings, new-game choices, the live game and match records (keys cotuong_*).
(() => {
  const PREFIX = 'cotuong_';
  const store = window.House.store('cotuong_', { legacy: ['co-tuong:'] });

  // One-time migration: the old forked kit kept its prefs under cotuong_prefs. Move them into house:prefs, then drop the key.
  const oldPrefs = store.get('prefs');
  if (oldPrefs) {
    window.House.prefs.save({ theme: window.House.resolve(oldPrefs.theme), lang: oldPrefs.lang === 'en' ? 'en' : 'vi' });
    store.remove('prefs');
  }

  const DEFAULT_SETTINGS = {
    v: 1,
    labels: 'han', // 'han' | 'viet'
    showMoves: true,
    lastMove: true,
    allowUndo: true,
    confirm: false,
    faceToFace: false,
    perpetual: true,
    moveLimit: true,
    timer: {
      mode: 'off', // 'off' | 'move' | 'game'
      moveSec: 60,
      base: 600,
      inc: 5
    },
    sfx: { on: true, vol: 0.7 },
    music: { on: false, vol: 0.5 },
    reduceMotion: false
  };

  const DEFAULT_NEWGAME = {
    v: 1,
    mode: 'pve', // 'pve' | 'pvp'
    level: 'medium', // 'easy' | 'medium' | 'hard'
    side: 'red', // 'red' | 'black' | 'random'
    allowUndo: true
  };

  // Save; if the browser refuses (full), drop the 20 oldest records and retry once.
  function save(key, val) {
    if (store.set(key, val)) return true;
    const recs = store.get('records', null);
    if (key !== 'records' && recs && Array.isArray(recs.items) && recs.items.length > 20) {
      store.set('records', { v: 1, items: recs.items.slice(0, recs.items.length - 20) });
      return store.set(key, val);
    }
    return false;
  }

  const Storage = {
    loadSettings() {
      const s = store.get('settings');
      if (!s) return { ...DEFAULT_SETTINGS };
      return {
        ...DEFAULT_SETTINGS,
        ...s,
        timer: { ...DEFAULT_SETTINGS.timer, ...(s.timer || {}) },
        sfx: { ...DEFAULT_SETTINGS.sfx, ...(s.sfx || {}) },
        music: { ...DEFAULT_SETTINGS.music, ...(s.music || {}) },
        v: 1
      };
    },

    saveSettings(patch) {
      const current = this.loadSettings();
      const updated = {
        ...current,
        ...patch,
        timer: { ...current.timer, ...(patch.timer || {}) },
        sfx: { ...current.sfx, ...(patch.sfx || {}) },
        music: { ...current.music, ...(patch.music || {}) }
      };
      save('settings', updated);
      return updated;
    },

    loadNewGame() {
      return { ...DEFAULT_NEWGAME, ...(store.get('newgame') || {}), v: 1 };
    },

    saveNewGame(patch) {
      const updated = { ...this.loadNewGame(), ...patch, v: 1 };
      save('newgame', updated);
      return updated;
    },

    loadCurrent() {
      const cur = store.get('current');
      if (cur && cur.status === 'in_progress') return cur;
      return null;
    },

    saveCurrent(gameRecord) {
      if (!gameRecord) store.remove('current');
      else save('current', gameRecord);
    },

    clearCurrent() {
      store.remove('current');
    },

    loadRecords() {
      const recs = store.get('records', { v: 1, items: [] });
      if (!recs || !Array.isArray(recs.items)) return [];
      return recs.items;
    },

    saveRecord(record) {
      const recs = store.get('records', { v: 1, items: [] });
      const items = Array.isArray(recs.items) ? recs.items : [];
      const existingIdx = items.findIndex(r => r.id === record.id);
      if (existingIdx >= 0) {
        items[existingIdx] = record;
      } else {
        items.unshift(record); // newest first
      }
      if (items.length > 200) items.length = 200;
      save('records', { v: 1, items });
    },

    clearRecords() {
      store.remove('records');
    },

    resetDefaults() {
      store.remove('settings');
      store.remove('newgame');
    },

    // Removes only this app's keys (cotuong_* and the old co-tuong:*), never other games or house:prefs.
    clearOwn() {
      store.clearOwn();
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.Storage = Storage;
})();
