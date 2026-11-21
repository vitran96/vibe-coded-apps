---
name: release-app
description: Bump an app's version and publish it (APP_VERSION + version.json catalog for the launcher), or release a new game-launcher desktop build via a v* tag.
---

# Release

## An app (published by GitHub Pages on push to `main`)

1. Pick the semver bump: patch = fix, minor = feature, major = breaking saved data (needs a storage migration).
2. Update `APP_VERSION` in the app's `src/` (find it with `grep -n APP_VERSION <app>/src/*.js`).
3. Rebuild and check from the repo root:
   ```sh
   node shared/scripts/build.mjs <app>
   node shared/scripts/check.mjs <app>     # fails if version.json differs from APP_VERSION
   ```
4. Set the same version on the app's entry in root `version.json`. The launcher shows "update available" whenever the installed version differs from this value.
5. Run the `verify-app` skill (manual pass).
6. Commit with the app scope, e.g. `feat(chess): add timer and bump to v1.1.0`. Commit the rebuilt `<app>/index.html` with the change.

## The launcher (`game-launcher/`)

1. Bump `version` in `game-launcher/src-tauri/tauri.conf.json` (and `package.json`, `Cargo.toml` to match).
2. `cd game-launcher && npm test`.
3. Commit, then ask the user before pushing a tag: `git tag v<version> && git push origin v<version>`.
   The `Build Desktop App` workflow (`.github/workflows/build.yml`) builds Linux + Windows and publishes the GitHub Release.
