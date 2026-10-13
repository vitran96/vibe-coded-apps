// storage.js — localStorage manager namespaced with co-tuong:*
(() => {
  const PREFIX = 'co-tuong:';

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

  function getRaw(key, fallback = null) {
    try {
      const data = localStorage.getItem(PREFIX + key);
      if (!data) return fallback;
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }

  function setRaw(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val));
      return true;
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        // Prune oldest 20 records and retry once
        try {
          const recs = getRaw('records', { v: 1, items: [] });
          if (recs && recs.items && recs.items.length > 20) {
            recs.items = recs.items.slice(0, recs.items.length - 20);
            localStorage.setItem(PREFIX + 'records', JSON.stringify(recs));
            localStorage.setItem(PREFIX + key, JSON.stringify(val));
            return true;
          }
        } catch {}
      }
      if (typeof window !== 'undefined' && window.XQ && window.XQ.toast) {
        window.XQ.toast(window.House.i18n.t('storage.failed'));
      }
      return false;
    }
  }

  function removeRaw(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  }

  function clearOwn() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  const Storage = {
    loadSettings() {
      const s = getRaw('settings');
      if (!s) return { ...DEFAULT_SETTINGS };
      // Migration from v:0 or missing fields
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
      setRaw('settings', updated);
      return updated;
    },

    loadNewGame() {
      const ng = getRaw('newgame');
      return { ...DEFAULT_NEWGAME, ...(ng || {}), v: 1 };
    },

    saveNewGame(patch) {
      const current = this.loadNewGame();
      const updated = { ...current, ...patch, v: 1 };
      setRaw('newgame', updated);
      return updated;
    },

    loadCurrent() {
      const cur = getRaw('current');
      if (cur && cur.status === 'in_progress') return cur;
      return null;
    },

    saveCurrent(gameRecord) {
      if (!gameRecord) {
        removeRaw('current');
      } else {
        setRaw('current', gameRecord);
      }
    },

    clearCurrent() {
      removeRaw('current');
    },

    loadRecords() {
      const recs = getRaw('records', { v: 1, items: [] });
      if (!recs || !Array.isArray(recs.items)) return [];
      return recs.items;
    },

    saveRecord(record) {
      const recs = getRaw('records', { v: 1, items: [] });
      const items = Array.isArray(recs.items) ? recs.items : [];
      const existingIdx = items.findIndex(r => r.id === record.id);
      if (existingIdx >= 0) {
        items[existingIdx] = record;
      } else {
        // Prepend newest record
        items.unshift(record);
      }
      // Cap at 200 records
      if (items.length > 200) items.length = 200;
      setRaw('records', { v: 1, items });
    },

    clearRecords() {
      removeRaw('records');
    },

    resetDefaults() {
      removeRaw('settings');
      removeRaw('newgame');
    },

    clearOwn
  };

  window.XQ = window.XQ || {};
  window.XQ.Storage = Storage;
})();
