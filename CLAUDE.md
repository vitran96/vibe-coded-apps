# CLAUDE.md — vibe-coded-apps

The one instruction file for every coding agent. **Claude format is the source of truth**: skills in `.claude/skills/`, app rules in `.claude/rules/`, agents in `.claude/agents/`, hooks in `.claude/settings.json` (scripts in `.claude/hooks/`).
Other agents (Codex, Gemini CLI, Antigravity, Cursor, Copilot…) never get copies. If you are not Claude, create your own native equivalents of the instructions, skills, agents and hooks you need (your own metadata and format), each one only pointing to the Claude file (for example your `goldfish` agent definition says "follow `.claude/agents/goldfish.md`"). `AGENTS.md` and `GEMINI.md` are pointers, `.agents/skills` is a symlink to `.claude/skills`. Edit this file or the Claude-format files, then run the `ai-agnostic-sync` skill (user-level, `~/.claude/skills/ai-agnostic-sync/`) so every agent stays in sync.
App-specific rules live in `.claude/rules/<app>.md` (path-scoped to `<app>/**`); this file wins on conflict. Agents other than Claude do not auto-load them: read the one for the app you touch.

## What this repo is

A collection of small AI-built ("vibe-coded") browser games/apps, mostly written by agents.

- Each top-level folder is one app (`caro/`, `chess/`, `chinese-chess/`, …), except `game-launcher/` (desktop wrapper), `shared/` (common code, below) and dot-folders.
- The repo is served as-is by GitHub Pages: `https://<user>.github.io/vibe-coded-apps/<app>/`. Every app is a sub-route.
- `version.json` (root) is the catalog the launcher reads: `{ id, name, names.vi, version, type: "html" | "zip" | "files", url }` (`files`: `url` is the app folder and the launcher reads `<url>/files.txt`).
- `game-launcher/` is a Tauri 2 + Vite app that downloads apps from the catalog, caches them in app-data, and runs them offline in an iframe (`srcdoc` for `type: "html"`, `asset://` URL for `type: "zip"` and `type: "files"`). It shims `localStorage` per game (`__game_<id>__` prefix).
- Empty folders (`beach-head/`, `shoji/`) are future apps.
- **Audience: non-technical and older players.** Plain, friendly wording (no jargon), large readable text and touch targets, high contrast, obvious buttons with text labels, forgiving controls (undo, confirm before destructive actions). When in doubt, choose the simpler UI.

## Hard rules (every app)

1. **Plain web only**: HTML, CSS, JavaScript, Three.js for 3D (Tone.js / Web Audio for sound). No framework, no TypeScript, no server code.
2. **No CDN at runtime** (this overrides any personal/global skill that says to use a CDN, e.g. `web-game-plan`). Every dependency (Three.js, Tone.js, fonts, icons) is vendored into the repo with its pinned version and license, and ends up inside the build. A user who downloads the HTML (or the app folder) must be able to play with no network. `http(s)://` in a built file is a bug, except plain hyperlinks the user clicks.
3. **Build output = one `index.html` per app** (priority) with all CSS/JS/fonts inlined. Maintainability beats single-file: develop split under `src/` and let the build inline it. The build also writes `files.txt` (the app's file manifest: `<sha256>  <path>` lines, `index.html` first, then `LICENSE`, then every file under `assets/`) and `LICENSE` (this repo's MIT text plus the notices of the vendored libraries the app inlines; the same text is embedded as a comment in `index.html`); commit all three. The repo `LICENSE` is MIT; `shared/vendor/` libraries must keep their license file (`check.mjs` fails otherwise). For a `type: "html"` app, extra files next to `index.html` (e.g. `sw.js`, `assets/`) are allowed only when they are optional for playing, because the launcher's `html` mode loads `index.html` alone via `srcdoc`. An app that needs its extra files opts in to `type: "files"` in `version.json`: the launcher downloads every path in `files.txt` (spec `specs/game-launcher-files-type.md`).
4. **Sub-route agnostic.** Only `./`-relative URLs, never a leading `/`, never a hard-coded host or repo name. The app must work unchanged at `/`, `/vibe-coded-apps/caro/`, `/any/other/path/`, from `file://`, and inside the launcher `srcdoc` iframe. Renaming the folder or route must not need a rebuild.
5. **i18n by default: Vietnamese first, English second.** Language codes `vi` and `en`. `vi` is the default. No hard-coded UI strings outside the dictionaries; `data-i18n` for static text, `t(key, params)` in JS; update `<html lang>` on switch.
6. **Accessibility + keyboard.** Everything playable and every control reachable by keyboard alone (visible `:focus-visible`, logical tab order, Esc closes dialogs, arrow keys move a board cursor, Enter/Space acts). Semantic HTML (`button`, `dialog`, labels), `aria-live` for turn/result announcements, text alternative for the canvas (board state readable by screen readers), contrast ≥ 4.5:1 for text, honour `prefers-reduced-motion`, touch targets ≥ 44px.
7. **Same look and structure in every app** (house style "Mộc"): shared theme tokens + house kit (themes `giay`, `dem`, `sonmai`, `bien`; Be Vietnam Pro font; shared SFX names; shared vi/en common strings; same start screen and Settings order: Trò chơi → Âm thanh → Giao diện → Dữ liệu → Thông tin). Apps extend the kit, never fork it. The one copy lives in `shared/house/` (`house-kit.js`, `house-theme.css`, `house-store.js`, `house-a11y.js`, `house-audio.js`).
   **Default theme is always light (`giay`), forced: never follow the OS dark-mode setting** (no `prefers-color-scheme` detection, no `auto` default). Players may pick another theme in Settings and that choice persists.
8. **Storage is namespaced per app.** Many apps share one origin. Every `localStorage` key starts with the app's prefix (current: `caro_`, `covua_`, `cotuong_`); never `localStorage.clear()`; "reset data" removes only own keys; wrap storage in try/catch and keep the game playable when it fails; store objects carry a schema `v`. The only shared key is `house:prefs` (`{ v, theme, lang }`).
9. **Version.** One version for the whole repo: `version.json` top-level `version` is the source of truth. Every app's `const APP_VERSION = 'x.y.z'` (shown in Settings → Thông tin), every `version.json` entry and the launcher's version files are set together with `node shared/scripts/bump-version.mjs <x.y.z | patch | minor | major>`, even when only one app changed. Never edit them by hand; `check.mjs` fails on drift.
10. **Tooling is Node only, zero npm dependencies** for apps (`node scripts/*.mjs`). No Python. (`game-launcher/` is the exception: it uses npm, Vite, Tauri, Rust.) `tools/e2e/` (Playwright, dev/CI only) is the second exception; apps must build, check and test without it.
11. **Phone first-class**: Pointer Events, `touch-action: none` on the canvas, `100dvh`, safe-area insets, portrait + landscape.

## Layout

```
.claude/         # AI config, Claude format: skills/, rules/<app>.md, agents/, hooks/, settings.json
.agents/skills  # symlink to ../.claude/skills (Codex, Gemini CLI, Antigravity)
shared/
  house/       # the one house kit: theme CSS, House kit, store, a11y, audio
  vendor/      # pinned Three.js, Tone.js and fonts, with their licenses
  scripts/     # build.mjs (builds any app into one index.html), check.mjs (static checks)
  template/    # scaffold for a new app (copy it; see the new-app skill)
<app>/
  index.html          # BUILT output, committed, what Pages and the launcher serve
  files.txt           # BUILT manifest, committed: index.html, LICENSE, assets/** with sha256 (launcher `files` type)
  LICENSE             # BUILT, committed: repo MIT + third-party notices of what the app inlines
  FIXED_ISSUES.md     # regression log: symptom, root cause, invariant, location
  src/                # source of truth: index.html + *.css + *.js (plain scripts or one module entry)
  assets/             # optional static files (vendored per-app assets)
  scripts/            # zero-dependency Node .mjs: tests, self-play
```

Built files are generated. Edit `src/`, then rebuild; never hand-edit a built `index.html`.

## Commands

From the repo root:

```sh
node shared/scripts/build.mjs <app...> | --all | --self-test   # src/index.html -> index.html + files.txt + LICENSE; also writes sha256/size into version.json
node shared/scripts/check.mjs <app...> | --all                  # build, files.txt, LICENSE and version.json hashes current, vendor licenses present, launcher min/max range sane, no network, i18n, storage, version, a11y, app tests
```

`check.mjs` runs every `scripts/test*.mjs` in the app folder. Two test scripts do not match that name and must be run by hand: `chess/scripts/perft.mjs` and `chinese-chess/scripts/run-rules-tests.mjs`.

| App | Test extras (run by hand) |
|---|---|
| `chess` | `cd chess && node scripts/perft.mjs` |
| `chinese-chess` | `node chinese-chess/scripts/run-rules-tests.mjs` |
| `tools/e2e` (browser E2E, optional locally, required in CI; run `cd tools/e2e && npm ci` once) | `npx playwright test --project=chromium` (add `--grep @<app>` to narrow) |
| `game-launcher` (not built by `shared/scripts`) | `cd game-launcher && npm ci && npm test && npm run build` (`npm run tauri build` for the binary) |

Manual check (not automated): serve the repo root (`npx serve .`), open `/<app>/` and a renamed copy of the folder, and play with the keyboard only. The `verify-app` skill lists the steps.

## Workflow for agents

- Read the app's `.claude/rules/<app>.md` (if any) and `FIXED_ISSUES.md` before touching it; keep every listed invariant.
- Use the skills below; they hold the step-by-step procedures.
- After a change: `node shared/scripts/build.mjs <app>`, then `node shared/scripts/check.mjs <app>`, then the `verify-app` manual pass; run `bump-version` if user-visible.
- `node shared/scripts/archive-version.mjs vX.Y.Z` copies the current builds to `archived/vX.Y.Z/<app>/` (still playable at `./archived/vX.Y.Z/<app>/`). Use it ONLY right before a breaking change (save-format break, house-rules change), not on every release. Archives are never edited or rebuilt, and the `archived/` folder is skipped by all discovery.
- When you fix a bug that could come back, run the `log-fixed-issue` skill: add an entry to the app's `FIXED_ISSUES.md` (create it from `shared/template/` if the app has none). A bug fix is not done until it is logged.
- Commit messages: Conventional Commits with the app as scope, e.g. `fix(caro): …`, `feat(chess): …`, `ci(game-launcher): …`.
- Do not commit `tmp/`, `out/`, `node_modules/`, `dist/`, `target/` (gitignored). Plans and scratch notes go in `out/`.

## Spec-driven workflow

- `specs/` (see `specs/README.md`) is the source of truth for requirements. Each app has `specs/<app>.md`; shared rules are in `specs/house-kit.md`.
- A new requirement goes to a spec first (`save-spec`), then code (`implement-spec`). Do not build from chat alone.
- Each spec numbers its requirements `R1..`, maps each one to a test or manual check, and has a `status` (`draft`, `accepted`, `implemented`).
- If code and spec disagree, the spec is right until the user changes it.

## Skills

Agent-agnostic skills live in `.claude/skills/<name>/SKILL.md` (plain Markdown, `name` + `description` frontmatter only, plain shell commands). If your agent does not auto-load skills, read the file when its description matches the task.

| Skill | Use when |
|---|---|
| `.claude/skills/build-app/SKILL.md` | Building, testing, checking or packaging any app or the launcher |
| `.claude/skills/new-app/SKILL.md` | Creating a new app/game folder in this repo |
| `.claude/skills/verify-app/SKILL.md` | Before committing any change to an app (build, tests, offline, sub-route, i18n, a11y, launcher) |
| `.claude/skills/playwright-test/SKILL.md` | Running, debugging or adding browser E2E tests in `tools/e2e` (UI, storage, keyboard changes) |
| `.claude/skills/release-app/SKILL.md` | Publishing a release (apps on Pages, or a launcher desktop build via a `v*` tag) |
| `.claude/skills/bump-version/SKILL.md` | Setting the one repo-wide version (apps, `version.json`, launcher files) |
| `.claude/skills/archive-version/SKILL.md` | Keeping playable copies of the builds before a breaking change |
| `.claude/skills/save-spec/SKILL.md` | A user states a requirement for an app (new or existing): write or update `specs/<app>.md` |
| `.claude/skills/implement-spec/SKILL.md` | Building or fixing what an accepted spec says; marks it `implemented` |
| `.claude/skills/log-fixed-issue/SKILL.md` | You fixed a bug that could come back: log it in the app's `FIXED_ISSUES.md` |
