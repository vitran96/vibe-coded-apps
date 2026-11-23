---
id: house-kit
app: repo
status: implemented
version-introduced: 2.2.0
---

# House kit (shared rules for every app)

## Goal

Every app looks, sounds, stores data and behaves the same way, so an older player who knows one game can play the next. Source of the rules: root `CLAUDE.md` hard rules 1-11.

## Requirements

- R1 Plain web only: HTML, CSS, JavaScript, Three.js, Tone.js/Web Audio. No framework, no TypeScript, no server code.
- R2 No network at runtime: every dependency is vendored in `shared/vendor/` with its version and license; the built `index.html` has no `http(s)://` except plain links.
- R3 Each app builds to one `index.html` with CSS/JS/fonts inlined, plus a `files.txt` manifest (`<sha256>  <path>` lines: `index.html`, `LICENSE`, then `assets/**`; see `game-launcher-files-type`); both built files are committed. (R3 wording extended for `files.txt`; that part is draft until `game-launcher-files-type` is implemented.)
- R4 Sub-route agnostic: only `./`-relative URLs; works at `/`, a renamed folder, `file://` and the launcher `srcdoc` iframe.
- R5 Languages `vi` (default) and `en`; no hard-coded UI strings outside dictionaries; `<html lang>` follows the switch.
- R6 Keyboard alone reaches every control; visible focus; Esc closes dialogs; text alternative for canvas boards; `aria-live` for results; contrast >= 4.5:1; reduced motion honoured; touch targets >= 44px.
- R7 Shared look: themes `giay` (default), `dem`, `sonmai`, `bien`; Be Vietnam Pro font; Settings order Trò chơi, Âm thanh, Giao diện, Dữ liệu, Thông tin. Code lives once in `shared/house/`.
- R8 Light theme is forced by default; OS dark mode is never read; a theme choice persists.
- R9 Storage keys are namespaced (`caro_`, `covua_`, `cotuong_`); the only shared key is `house:prefs` (`{ v, theme, lang }`); never `localStorage.clear()`; "reset data" removes only own keys; storage access is wrapped in try/catch.
- R10 One repo-wide version in `version.json`, mirrored into each `APP_VERSION` and the launcher by `bump-version.mjs`; shown in Settings → Thông tin.
- R11 Tooling is Node with zero npm dependencies for apps; Playwright lives in `tools/e2e` only.
- R12 Phone: Pointer Events, `touch-action: none` on canvas, `100dvh`, safe-area insets, portrait and landscape.

## Out of scope

- Framework or bundler for apps (the build is `shared/scripts/build.mjs`).
- Server-side saves or accounts.

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1, R3 | `node shared/scripts/build.mjs --all` then `check.mjs --all` (build current) | unit |
| R2 | `check.mjs` no-network scan; `tools/e2e` A1 zero external requests | unit, e2e |
| R4 | `tools/e2e` boot tests on served and renamed paths; manual `file://` | e2e, manual |
| R5 | `check.mjs` i18n parity; e2e B2 English switch | unit, e2e |
| R6 | e2e B7, B8, B9, B10, B13 (axe); `check-contrast.mjs` (chess) | e2e |
| R7, R8 | e2e B3 (forced light), B4 (themes persist) | e2e |
| R9 | e2e B5 (reset), B6 (failing storage); `check.mjs` prefix check | e2e, unit |
| R10 | `check.mjs` repo versions; `bump-version.mjs` | unit |
| R11 | TBD (no automated check that apps have no `package.json`); manual `ls <app>/` | manual |
| R12 | e2e B10 (portrait and landscape) | e2e |

## Notes

- Shared self-test: `node shared/house/self-test.mjs`.
- Chess and Chinese chess have no `.claude/rules/<app>.md`; this spec and root `CLAUDE.md` are their rules.
