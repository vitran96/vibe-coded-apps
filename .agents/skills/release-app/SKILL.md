---
name: release-app
description: Bump an app's version and publish it (APP_VERSION + version.json catalog for the launcher), or release a new game-launcher desktop build via a v* tag.
---

# Release

## An app (published by GitHub Pages on push to `main`)

1. Bump the one repo-wide version with the `bump-version` skill (`node shared/scripts/bump-version.mjs minor|patch|major`). It sets every app's `APP_VERSION`, every `version.json` entry and the launcher files, and rebuilds the apps. The launcher shows "update available" whenever the installed version differs from the catalog value.
2. If the change is breaking for saved data, run the `archive-version` skill first.
3. Run the `verify-app` skill (manual pass).
4. Commit with the scope, e.g. `feat(chess): add timer and bump to v2.3.0`. Commit the rebuilt `<app>/index.html` files with the change.

## The launcher (`game-launcher/`)

1. Bump with `bump-version` (it already sets `tauri.conf.json`, `package.json`, the lock files and `Cargo.toml`).
2. `cd game-launcher && npm test`.
3. Commit, then ask the user before pushing a tag: `git tag v<version> && git push origin v<version>`.
   The `Build Desktop App` workflow (`.github/workflows/build.yml`) builds Linux + Windows and publishes the GitHub Release.
