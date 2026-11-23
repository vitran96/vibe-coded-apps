---
id: game-launcher
app: game-launcher
status: implemented
version-introduced: 2.2.0
---

# Game launcher (desktop wrapper)

## Goal

One desktop app (Tauri 2 + Vite) that lists the games from the online catalog, installs and updates them into app data, and runs them offline in a frame.

## Requirements

- R1 Reads the catalog from `version.json` from `CATALOG_URL` (default: this repo’s GitHub Pages; may point to any host with the same structure, `game-launcher-hardening` R19); each entry has `id`, `name`, `names.vi`, `version`, `type`, `url`.
- R2 `type: "html"` games are loaded with `srcdoc`; `type: "zip"` and `type: "files"` games are loaded from an `asset://` URL (`game-launcher-files-type`).
- R3 Install and update download the game with a progress display; a game can be removed; "remove all" needs confirmation.
- R4 Games run offline once installed.
- R5 Update prompt when the catalog version differs from the installed version (update modal).
- R6 Each game's `localStorage` is shimmed with the prefix `__game_<id>__`; `house:prefs` is shared and not prefixed; clearing a game's data removes only its prefixed keys.
- R7 Storage shim tolerates storage failure (try/catch) and keeps the launcher usable.
- R8 Interface in `vi` (default) and `en`.
- R9 Launcher version matches `version.json` (set by `bump-version.mjs`).
- R10 Unit tests run with `npm test` (`node --test`).

## Out of scope

- Editing or publishing games from the launcher.
- Auto-update of the launcher binary: see `specs/game-launcher-ota.md`.
- Mobile builds: TBD.

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | `test/gameManager.test.js` (`fetchRemoteCatalog`) | unit |
| R2 | `test/main.test.js`, `test/zipExtractor.test.js` | unit |
| R3 | `test/gameManager.test.js` (install, remove, remove all) | unit |
| R4 | manual: install, disconnect network, launch | manual |
| R5 | `test/updateModal.test.js` | unit |
| R6 | `test/storageShim.test.js` | unit |
| R7 | `test/storageShim.test.js` (failing storage) | unit |
| R8 | `test/i18n.test.js` | unit |
| R9 | `check.mjs` repo versions; `bump-version.mjs` | unit |
| R10 | `cd game-launcher && npm ci && npm test && npm run build` | unit |

## Notes

- Code: `game-launcher/src/js/` (`main.js`, `gameManager.js`, `storageShim.js`, `updateModal.js`, `zipExtractor.js`, `i18n.js`). Tauri side: `game-launcher/src-tauri/`.
- Not built by `shared/scripts/build.mjs`; `check.mjs --all` does not cover it.
- Launcher uses npm, Vite, Tauri and Rust (CLAUDE.md rule 10 exception). Downloads come from GitHub raw; the apps themselves never fetch at runtime.
