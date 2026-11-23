---
name: build-app
description: Build and check apps in this repo - one app, all apps, the static check gate, helper self-tests, and the game-launcher (web build or desktop binary). Use whenever you need to build, rebuild or check anything here.
---

# Build and check

Run from the repo root. Zero dependencies for apps (Node 22 in CI). Scripts exit non-zero on failure.

| Case | Command | Result |
|---|---|---|
| Rebuild one app after editing `src/` | `node shared/scripts/build.mjs chess` | `chess/index.html` and `chess/files.txt` regenerated |
| Several apps | `node shared/scripts/build.mjs chess caro` | each rebuilt; exit 1 if any fails |
| Every app | `node shared/scripts/build.mjs --all` | apps without `src/index.html` are skipped |
| Static gate before a commit | `node shared/scripts/check.mjs <app>` or `--all` | built file current, no network, i18n, storage, version, a11y, app tests |
| Helper self-tests | `node shared/scripts/build.mjs --self-test` and `node shared/house/self-test.mjs` | build rules and house helpers |
| Launcher web frontend | `cd game-launcher && npm ci && npm test && npm run build` | `game-launcher/dist/` |
| Launcher desktop binary | `cd game-launcher && npm run tauri build` | needs Rust + system WebKit libs; CI does this on a `v*` tag |

## Notes

- The build inlines CSS, JS, fonts and the import-map libraries into one `index.html`. It fails on any network URL, root-absolute path or un-inlined local file, and warns above 2 MB.
- The build also writes `<app>/files.txt`: lines are `<sha256>  <path>` (sha256sum format), `index.html` on line 1, then `LICENSE` and every file under `<app>/assets/` (sorted, dot-files skipped). Nothing from `src/`, `scripts/`, `tmp/` or the `*.md` files is listed. It also writes `<app>/LICENSE` (repo MIT + notices of the vendored libraries the app inlines, also embedded in `index.html`) and the `sha256`/`size` of what the launcher downloads into this app's `version.json` entry. The launcher's `type: "files"` downloads exactly these paths (`specs/game-launcher-files-type.md`).
- Commit the rebuilt `index.html`, `files.txt`, `LICENSE` and `version.json` together with the `src/` change. `check.mjs` fails when either is stale or `files.txt` lists a missing file.
- Test scripts not named `test*.mjs` (chess `perft.mjs`, chinese-chess `run-rules-tests.mjs`) are not run by `check.mjs`; run them by hand (root `CLAUDE.md` lists them).
- A new app is found automatically: any top-level folder with `src/index.html` or `index.html`.
