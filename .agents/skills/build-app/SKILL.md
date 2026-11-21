---
name: build-app
description: Build, test, check and package apps in this repo for each case - one app, all apps, CI-style strict check, downloadable zip, or the game-launcher (web build or desktop binary). Use whenever you need to build or rebuild anything here.
---

# Build

One entry point, run from the repo root: `node scripts/build.mjs`. Zero dependencies (Node 20+). It exits non-zero if any target fails and prints a summary.

## Pick the case

| Case | Command | Result |
|---|---|---|
| Rebuilt one app after editing `src/` | `node scripts/build.mjs chess` | `chess/index.html` regenerated from `chess/src/` |
| Several apps | `node scripts/build.mjs chess chinese-chess` | each rebuilt in order |
| Everything, before a commit | `node scripts/build.mjs --all --test` | every app rebuilt + its Node tests run |
| Strict offline / sub-route gate | `node scripts/build.mjs <app> --check` | fails on any CDN/network dependency or root-absolute path in the built `index.html` |
| Downloadable package / launcher `zip` type | `node scripts/build.mjs <app> --zip` | `out/<app>-<version>.zip` with `index.html` and runtime siblings only (`sw.js`, `assets/`, `icons/`, `manifest.webmanifest` if present) |
| Launcher web frontend | `node scripts/build.mjs launcher --test` | `npm ci` if needed, `npm test`, `npm run build` → `game-launcher/dist/` |
| Launcher desktop binary | `node scripts/build.mjs launcher --desktop` | `npm run tauri build` (needs Rust + system WebKit libs; CI does this on a `v*` tag) |

Flags combine: `node scripts/build.mjs --all --test --check --zip`.

## How each app is built

- App with `src/index.html` (chess, chinese-chess): runs that app's `scripts/build-single-html.mjs src/index.html index.html`, which inlines local CSS/JS into one file.
- App without `src/` (caro, until the rebuild plan's M4): nothing to build; `index.html` is the source. `--test` runs `node scripts/caro.js check`.
- Tests picked up automatically: `scripts/test-*.mjs`, `scripts/run-*tests.mjs`, `scripts/perft.mjs`. Self-play scripts are not run (slow); run them by hand when changing an AI.
- A new app is discovered automatically: any top-level folder with `index.html` or `src/index.html`.

## Notes

- `--check` currently fails for every game: they still load Three.js, Tone.js and fonts from a CDN (see `out/rebuild-plan.md`). Use it as the gate for apps that have been migrated; do not "fix" it by loosening the check.
- Commit the rebuilt `index.html` together with the `src/` change; GitHub Pages serves it as-is.
- `out/` is gitignored; zips there are local artifacts.
- The detector has a self-check: `node --test scripts/build.test.mjs`.
