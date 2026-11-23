---
name: bump-version
description: Set the one repo-wide version (every app's APP_VERSION, every version.json entry, the game-launcher package, lock, Tauri and Cargo files) with shared/scripts/bump-version.mjs, then rebuild. Use for any release, even when only one app changed.
---

# Bump the repo version

One version for the whole repo. The source of truth is the top-level `"version"` in root `version.json`. Every app and the launcher carry the same number, even if only one app changed.

## Steps

1. Pick the bump: `patch` = fix, `minor` = feature, `major` = breaking saved data (also run `archive-version` first, see that skill). Or pass an exact `x.y.z`.
2. From the repo root:
   ```sh
   node shared/scripts/bump-version.mjs minor      # or patch | major | 2.3.0
   node shared/scripts/check.mjs --all             # repo versions + every app
   cd game-launcher && npm test                     # if node_modules exist
   ```
   The bump starts from the highest current version (so drift is repaired too), writes all sites, rebuilds every app with `build.mjs --all`, and fails if any site still differs.
3. Run the `verify-app` manual pass for the apps you changed.
4. Commit with Conventional Commits, the scope being the app or `repo`.

## What it writes

- `<app>/src/*.js`: `APP_VERSION` (every app, found by its constant)
- `version.json`: top-level `version` and each game's `version`
- `game-launcher/package.json`, `package-lock.json` (root and `packages[""]`), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the `tauri-app` entry in `src-tauri/Cargo.lock`
- every app's `index.html` (rebuilt)

Do not edit these numbers by hand. `check.mjs` fails on any drift.

## Self-test

`node shared/scripts/bump-version.mjs --self-test` (also run in CI).
