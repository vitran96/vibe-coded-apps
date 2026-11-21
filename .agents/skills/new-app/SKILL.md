---
name: new-app
description: Create a new vibe-coded app or game folder in this repo (plain HTML/CSS/JS + Three.js, vi-first i18n, house style, single-HTML build, sub-route agnostic, registered in version.json for the launcher).
---

# New app

Read `AGENTS.md` (root) first. Every hard rule there applies; this skill is the procedure.

## 1. Decide

- `id`: kebab-case folder name (`connect-four`). It is also the `version.json` id and the launcher cache name.
- Storage prefix: short, Vietnamese-flavoured, ends in `_` (existing: `caro_`, `covua_`, `cotuong_`). Must not collide with an existing app.
- Vietnamese name (default) and English name.
- If the game rules (win condition, board size, turns) are unclear, ask once. Pick everything else yourself and record it in the app's `AGENTS.md` under "Decisions".

## 2. Scaffold

Copy the structure of the newest well-structured app (`chinese-chess/` today) rather than inventing a new one:

```
<id>/
  AGENTS.md            # app rules, decisions, invariants (short)
  FIXED_ISSUES.md      # empty log with the header only
  src/index.html       # references ./house-theme.css, ./style.css, ./house-kit.js, ./i18n.js, ..., ./main.js
  src/house-theme.css  # shared house tokens/components: copy verbatim, never edit per app
  src/house-kit.js     # shared House kit (themes, prefs, i18n core, SFX): copy verbatim
  src/i18n.js          # House.i18n.add({ vi: {...}, en: {...} }), app keys under `game.*`
  src/rules.js         # pure, DOM-free game rules (board games)
  src/main.js          # wiring; the only ES module entry (imports 'three')
  scripts/build-single-html.mjs
  scripts/test-*.mjs   # Node tests for rules/AI, zero deps
```

Rules while writing code:

- Local files must not `import` each other (the build inlines them into one HTML). Use plain scripts that attach to one namespace object, plus one module entry for Three.js.
- Three.js / Tone.js / fonts come from the vendored copies, never a CDN URL (see `AGENTS.md` rule 2). Until a shared `vendor/` exists, copy the same pinned version the other apps use (Three.js 0.170.0, Tone.js 15.0.4).
- Colors in Three.js come from `House.palette()`; re-color on the `housethemechange` event.
- Every user-visible string goes through `t()` / `data-i18n`, `vi` first.
- Keyboard: board cursor with arrow keys, Enter/Space to act, Esc to close dialogs, visible focus. Announce turns/results in an `aria-live` region.
- `const APP_VERSION = '1.0.0'` shown in Settings → Thông tin.
- Board games: AI Easy/Medium/Hard in a Web Worker built from an inline Blob, PvP same screen, records + replay, undo (PvE undoes 2 plies, PvP 1), timer (off by default), BGM off by default, SFX on by default.

## 3. Build and register

```sh
node scripts/build.mjs <id> --test   # from the repo root; see the build-app skill
```

Add the entry to root `version.json`:

```json
{ "id": "<id>", "name": "<English>", "names": { "vi": "<Tiếng Việt>" }, "version": "1.0.0", "type": "html", "url": "https://vitran96.github.io/vibe-coded-apps/<id>" }
```

Add a row for the app to the Commands table in root `AGENTS.md`.

## 4. Verify

Run the `verify-app` skill (`.agents/skills/verify-app/SKILL.md`) before committing.
