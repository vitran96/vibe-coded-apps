export function generateStorageShim(gameId) {
  const safeId = String(gameId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `
    <script id="__storage_shim__">
      (function() {
        const prefix = "__game_${safeId}__";
        const rawStorage = window.localStorage;

        const proxyStorage = {
          getItem: function(key) {
            return rawStorage.getItem(prefix + key);
          },
          setItem: function(key, val) {
            rawStorage.setItem(prefix + key, String(val));
          },
          removeItem: function(key) {
            rawStorage.removeItem(prefix + key);
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
