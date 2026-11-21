# Caro & Gomoku — app rules

Root `AGENTS.md` applies and wins on conflict. This file lists what is specific to `caro/`.

## Layout

- `src/` is the source: `index.html` (markup and dialogs), `style.css`, and one plain script per area (`constants.js`, `i18n.js`, `storage.js`, `rules.js`, `ai-engine.js`, `ai-client.js`, `audio.js`, `timer.js`, `renderer.js`, `input.js`, `game.js`, `replay.js`, `ui.js`, `pwa.js`, `main.js`), plus `three.js` (loads Three.js) and `sw.js` (optional service worker template; the build does not ship it).
- `index.html` (here) is BUILT. Never edit it. Run `node shared/scripts/build.mjs caro`.
- All scripts share one global scope in the build, so keep the load order in `src/index.html`.
- Shared kit: `shared/house/` (House kit, `House.store`, a11y helpers, `house-theme.css`). Vendored libraries and fonts: `shared/vendor/`. No CDN, no network at runtime.
- Tests: `node scripts/test-caro.mjs` (rules and AI unit tests, run in Node) and `node scripts/test-save.mjs` (old saves still load).
- Check: `node shared/scripts/check.mjs caro`.

## Rules

1. Languages: `vi` (default) and `en` only. Every UI string is in `I18N.vi` and `I18N.en` with quoted keys, and is reached through `t(key, ...args)` or `data-i18n`. Change the language with `setLang()`.
2. Look: house themes (`giay` default, `dem`, `sonmai`, `bien`). The default is always light; never read the OS dark-mode setting. Theme and language choices are saved in `house:prefs` through the kit.
3. Storage: keys are `STORAGE_PREFIX` (`caro_`) plus a suffix from `LS`, through `House.store(STORAGE_PREFIX, { legacy: ['caro.'] })`. Never `localStorage.clear()`. Settings and records objects carry `v: 1`.
4. Spa music is off by default. SFX on. Timer off.
5. Version: one repo-wide version. Bump it with `node shared/scripts/bump-version.mjs` (never edit `APP_VERSION` or `version.json` by hand).

## Invariants (see FIXED_ISSUES.md)

- The camera pans only when the placed stone is within 1.2 cells of the edge, by `2.0 * S`.
- Undo: against the computer (`session.mode === 'pve' && session.ai`) it reverts 2 moves; two players, 1 move.
- Storage keys use the `caro_` prefix; 1.0.0 `caro.` keys are still read.
