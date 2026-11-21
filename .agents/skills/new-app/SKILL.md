---
name: new-app
description: Create a new vibe-coded app or game folder in this repo from shared/template (plain HTML/CSS/JS + Three.js, vi-first i18n, house style, forced light theme, single-HTML build, sub-route agnostic, registered in version.json for the launcher).
---

# New app

Read the root `AGENTS.md` first. Every hard rule there applies; this skill is the procedure.

Spec first: write `specs/<app>.md` with `save-spec` (or confirm it exists) before scaffolding. `implement-spec` calls this skill for new apps.

## 1. Decide

- `id`: kebab-case folder name (`connect-four`). It is also the `version.json` id and the launcher cache name.
- Storage prefix: short, Vietnamese-flavoured, ends in `_` (existing: `caro_`, `covua_`, `cotuong_`). Must not collide with an existing app.
- Vietnamese name (default) and English name.
- If the game rules (win condition, board size, turns) are unclear, ask once. Pick everything else yourself and record it in the app's `AGENTS.md`.

## 2. Scaffold from the template

```sh
cp -r shared/template <id>
```

The template is a working app: start screen, game screen with an `aria-live` status line, Settings in the house order (Trò chơi → Âm thanh → Giao diện → Dữ liệu → Thông tin), theme and language from `house:prefs`, one namespaced store, and `scripts/test-smoke.mjs`. Then, in `<id>/`:

- `src/main.js`: set `APP_VERSION` to the current repo version (see `version.json` top-level `version`) and `STORAGE_PREFIX` (`'<prefix>_'`). `check.mjs` compares both with `version.json` and the prefix.
- `src/index.html`: `<title>` and the game's markup. Keep the Settings sections in order.
- `src/i18n.js`: replace the template keys with the game's `game.*` keys. Every key needs both `vi` and `en`.
- `AGENTS.md`: replace the stub with the app's rules and decisions.
- `FIXED_ISSUES.md`: keep the header only.
- Game logic: pure rules in `src/rules.js` and wiring in `src/main.js`. Plain scripts, no `import` between local files. For Three.js or Tone.js, copy the import map and script tags from `chess/src/index.html`; they point at `../../shared/vendor/`, never a CDN.
- Keep `scripts/test-smoke.mjs` or replace it with rule tests named `scripts/test-*.mjs`.

Rules while writing code:

- Colors in Three.js come from `House.palette()`; re-color on the `housethemechange` event.
- Every user-visible string goes through `House.i18n.t()` or `data-i18n`, `vi` first. No hard-coded UI text in markup or JS.
- Keyboard: board cursor with arrow keys, Enter/Space to act, Esc to close dialogs, visible focus. Announce turns and results in the `aria-live` region.
- Board games: AI Easy/Medium/Hard in a Web Worker built from an inline Blob, PvP on one screen, records + replay, undo (PvE undoes 2 plies, PvP 1), timer off by default, BGM off by default, SFX on by default.

## 3. Register

Add the entry to root `version.json`:

```json
{ "id": "<id>", "name": "<English>", "names": { "vi": "<Tiếng Việt>" }, "version": "1.0.0", "type": "html", "url": "https://vitran96.github.io/vibe-coded-apps/<id>" }
```

`version` must equal the repo version (run `bump-version` if it moved).

## 4. Build and check

Then the `playwright-test` skill step 6: copy `tools/e2e/specs/_template.spec.mjs` to `tools/e2e/specs/<id>.spec.mjs` and fill it in.

```sh
node shared/scripts/build.mjs <id>
node shared/scripts/check.mjs <id>     # must print PASS
```

Then run the `verify-app` skill (manual keyboard and sub-route pass) before committing.
