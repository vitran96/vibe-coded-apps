// House.store(prefix, { legacy }): namespaced localStorage. Never throws.
// Reads fall back to legacy prefixes; a failed write returns false and fires 'housestoragefail' once per page.
(() => {
  const H = (globalThis.House ??= {});
  const ls = () => globalThis.localStorage;

  H.store = (prefix, { legacy = [] } = {}) => {
    const prefixes = [prefix, ...legacy];
    if (prefixes.some((p) => !p)) throw new Error('House.store: empty prefix would match every key');
    let warned = false;
    const failed = () => {
      if (warned) return;
      warned = true;
      globalThis.dispatchEvent?.(new CustomEvent('housestoragefail'));
    };
    return {
      get(k, fallback = null) {
        try {
          for (const p of prefixes) {
            const raw = ls().getItem(p + k);
            if (raw !== null) return JSON.parse(raw);
          }
        } catch {} // blocked storage or corrupt JSON: play on with the fallback
        return fallback;
      },
      set(k, v) {
        try {
          ls().setItem(prefix + k, JSON.stringify(v));
          return true;
        } catch {
          failed();
          return false;
        }
      },
      remove(k) {
        try { for (const p of prefixes) ls().removeItem(p + k); } catch {}
      },
      // Removes only this app's keys (its prefix and legacy prefixes), never other apps or house:prefs.
      clearOwn() {
        try {
          const s = ls();
          const own = [];
          for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (prefixes.some((p) => key.startsWith(p))) own.push(key);
          }
          own.forEach((key) => s.removeItem(key));
        } catch {}
      },
    };
  };
})();
