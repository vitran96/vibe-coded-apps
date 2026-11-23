export function generateStorageShim(gameId) {
  const safeId = String(gameId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `
    <script id="__storage_shim__">
      (function() {
        const prefix = "__game_${safeId}__";
        const rawStorage = window.localStorage;
        // house:prefs (theme + language) is shared by every game, so it is not prefixed.
        const full = function(key) { return key === "house:prefs" ? key : prefix + key; };

        const proxyStorage = {
          getItem: function(key) {
            return rawStorage.getItem(full(key));
          },
          setItem: function(key, val) {
            rawStorage.setItem(full(key), String(val));
          },
          removeItem: function(key) {
            rawStorage.removeItem(full(key));
          },
          clear: function() {
            Object.keys(rawStorage).forEach(function(k) {
              if (k.startsWith(prefix)) rawStorage.removeItem(k);
            });
          },
          key: function(index) {
            const keys = Object.keys(rawStorage).filter(function(k) { return k.startsWith(prefix); });
            return keys[index] ? keys[index].replace(prefix, "") : null;
          },
          get length() {
            return Object.keys(rawStorage).filter(function(k) { return k.startsWith(prefix); }).length;
          }
        };

        try {
          Object.defineProperty(window, 'localStorage', {
            value: proxyStorage,
            configurable: true,
            enumerable: true,
            writable: true
          });
        } catch (e) {
          console.warn("Storage shim fallback", e);
        }
      })();
    </script>
  `;
}

// The one place the shim goes into a game's HTML (zip and files types): after <head>, else in front.
export function injectStorageShim(html, gameId) {
  const shim = generateStorageShim(gameId);
  return html.includes('<head>') ? html.replace('<head>', () => `<head>${shim}`) : shim + html;
}
