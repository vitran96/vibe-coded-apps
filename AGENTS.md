# AGENTS.md — vibe-coded-apps

The one instruction file for every coding agent (Claude Code, Codex, Gemini, Cursor, Copilot, Antigravity…).
Agent-specific files (`CLAUDE.md`, `GEMINI.md`, …) only point here. Do not copy rules into them; edit this file.
An app folder may have its own `AGENTS.md` with app-specific rules; this file wins on conflict.

## What this repo is

A collection of small AI-built ("vibe-coded") browser games/apps, mostly written by agents.

- Each top-level folder is one app (`caro/`, `chess/`, `chinese-chess/`, …), except `game-launcher/` (desktop wrapper) and dot-folders.
- The repo is served as-is by GitHub Pages: `https://<user>.github.io/vibe-coded-apps/<app>/`. Every app is a sub-route.
- `version.json` (root) is the catalog the launcher reads: `{ id, name, names.vi, version, type: "html" | "zip", url }`.
- `game-launcher/` is a Tauri 2 + Vite app that downloads apps from the catalog, caches them in app-data, and runs them offline in an iframe (`srcdoc` for `type: "html"`, `asset://` URL for `type: "zip"`). It shims `localStorage` per game (`__game_<id>__` prefix).
- Empty folders (`beach-head/`, `shoji/`) are future apps.
- **Audience: non-technical and older players.** Plain, friendly wording (no jargon), large readable text and touch targets, high contrast, obvious buttons with text labels, forgiving controls (undo, confirm before destructive actions). When in doubt, choose the simpler UI.

## Hard rules (every app)

1. **Plain web only**: HTML, CSS, JavaScript, Three.js for 3D (Tone.js / Web Audio for sound). No framework, no TypeScript, no server code.
2. **No CDN at runtime** (this overrides any personal/global skill that says to use a CDN, e.g. `web-game-plan`). Every dependency (Three.js, Tone.js, fonts, icons) is vendored into the repo with its pinned version and license, and ends up inside the build. A user who downloads the HTML (or the app folder) must be able to play with no network. `http(s)://` in a built file is a bug, except plain hyperlinks the user clicks.
3. **Build output = one `index.html` per app** (priority) with all CSS/JS/fonts inlined. Maintainability beats single-file: develop split under `src/` and let the build inline it. Extra files next to `index.html` (e.g. `sw.js`, `assets/`) are allowed only when they are optional for playing, because the launcher's `html` mode loads `index.html` alone via `srcdoc`.
4. **Sub-route agnostic.** Only `./`-relative URLs, never a leading `/`, never a hard-coded host or repo name. The app must work unchanged at `/`, `/vibe-coded-apps/caro/`, `/any/other/path/`, from `file://`, and inside the launcher `srcdoc` iframe. Renaming the folder or route must not need a rebuild.
5. **i18n by default: Vietnamese first, English second.** Language codes `vi` and `en`. `vi` is the default. No hard-coded UI strings outside the dictionaries; `data-i18n` for static text, `t(key, params)` in JS; update `<html lang>` on switch.
6. **Accessibility + keyboard.** Everything playable and every control reachable by keyboard alone (visible `:focus-visible`, logical tab order, Esc closes dialogs, arrow keys move a board cursor, Enter/Space acts). Semantic HTML (`button`, `dialog`, labels), `aria-live` for turn/result announcements, text alternative for the canvas (board state readable by screen readers), contrast ≥ 4.5:1 for text, honour `prefers-reduced-motion`, touch targets ≥ 44px.
7. **Same look and structure in every app** (house style "Mộc"): shared theme tokens + house kit (themes `giay`, `dem`, `sonmai`, `bien`; Be Vietnam Pro font; shared SFX names; shared vi/en common strings; same start screen and Settings order: Trò chơi → Âm thanh → Giao diện → Dữ liệu → Thông tin). Apps extend the kit, never fork it. Current copies: `chess/src/house-kit.js`, `chess/src/house-theme.css`.
   **Default theme is always light (`giay`), forced: never follow the OS dark-mode setting** (no `prefers-color-scheme` detection, no `auto` default). Players may pick another theme in Settings and that choice persists.
8. **Storage is namespaced per app.** Many apps share one origin. Every `localStorage` key starts with the app's prefix (current: `caro_`, `covua_`, `cotuong_`); never `localStorage.clear()`; "reset data" removes only own keys; wrap storage in try/catch and keep the game playable when it fails; store objects carry a schema `v`. The only shared key is `house:prefs` (`{ v, theme, lang }`).
9. **Version.** `const APP_VERSION = 'x.y.z'` shown in Settings → Thông tin. Bump it on every user-visible change and keep `version.json` in sync (the launcher compares them to offer updates).
10. **Tooling is Node only, zero npm dependencies** for apps (`node scripts/*.mjs`). No Python. (`game-launcher/` is the exception: it uses npm, Vite, Tauri, Rust.)
11. **Phone first-class**: Pointer Events, `touch-action: none` on the canvas, `100dvh`, safe-area insets, portrait + landscape.

## App folder layout

```
<app>/
  index.html          # BUILT output, committed, what Pages and the launcher serve
  AGENTS.md           # optional app-specific rules / invariants
  FIXED_ISSUES.md     # regression log: symptom, root cause, invariant, location
  src/                # source of truth: index.html + *.css + *.js (plain scripts or one module entry)
  assets/             # optional static files (vendored per-app assets)
  scripts/            # zero-dependency Node .mjs: build, tests, self-play, checks
```

Built files are generated. Edit `src/`, then rebuild; never hand-edit a built `index.html` of an app that has `src/`.
Exception today: `caro/` has no `src/` yet — its `index.html` is the source (use `node caro/scripts/caro.js`, see `caro/AGENTS.md`).

## Commands

Preferred, from the repo root (all cases, see the `build-app` skill):

```sh
node scripts/build.mjs <app...> | --all  [--test] [--check] [--zip]
node scripts/build.mjs launcher [--test] [--desktop]
```

Underlying per-app commands, run from the app folder:

| App | Build | Test |
|---|---|---|
| `chess` | `node scripts/build-single-html.mjs src/index.html index.html` | `node scripts/test-rules.mjs && node scripts/test-undo.mjs && node scripts/perft.mjs` |
| `chinese-chess` | `node scripts/build-single-html.mjs src/index.html index.html` | `node scripts/run-rules-tests.mjs` |
| `caro` | (no build; source is `index.html`) | `node scripts/caro.js check` |
| `game-launcher` | `npm ci && npm run build` (`npm run tauri build` for the binary) | `npm test` |

Manual check: serve the repo root (`npx serve .`) and open `/<app>/` and also a renamed copy of the folder to prove sub-route agnosticism.

## Workflow for agents

- Read the app's `AGENTS.md` / `FIXED_ISSUES.md` before touching it; keep every listed invariant.
- Use the skills below; they hold the step-by-step procedures.
- After a change: build, run the app's tests, run the `verify-app` checklist, bump `APP_VERSION` + `version.json` if user-visible.
- When you fix a bug that could come back, add an entry to the app's `FIXED_ISSUES.md`.
- Commit messages: Conventional Commits with the app as scope, e.g. `fix(caro): …`, `feat(chess): …`, `ci(game-launcher): …`.
- Do not commit `tmp/`, `out/`, `node_modules/`, `dist/`, `target/` (gitignored). Plans and scratch notes go in `out/`.

## Skills

Agent-agnostic skills live in `.agents/skills/<name>/SKILL.md` (plain Markdown, `name` + `description` frontmatter only, plain shell commands). If your agent does not auto-load skills, read the file when its description matches the task.

| Skill | Use when |
|---|---|
| `.agents/skills/build-app/SKILL.md` | Building, testing, checking or packaging any app or the launcher |
| `.agents/skills/new-app/SKILL.md` | Creating a new app/game folder in this repo |
| `.agents/skills/verify-app/SKILL.md` | Before committing any change to an app (build, tests, offline, sub-route, i18n, a11y, launcher) |
| `.agents/skills/release-app/SKILL.md` | Bumping an app version, updating `version.json`, releasing the launcher |
| `caro/.agents/skills/caro-dev/SKILL.md` | Editing the single-file `caro/index.html` |
