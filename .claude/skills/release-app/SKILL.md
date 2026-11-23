---
name: release-app
description: Bump an app's version and publish it (APP_VERSION + version.json catalog for the launcher), or release a new game-launcher desktop build via a v* tag.
---

# Release

## An app (published by GitHub Pages on push to `main`)

1. Bump the one repo-wide version with the `bump-version` skill (`node shared/scripts/bump-version.mjs minor|patch|major`). It sets every app's `APP_VERSION`, every `version.json` entry and the launcher files, and rebuilds the apps. The launcher shows "update available" whenever the installed version differs from the catalog value.
2. If the change is breaking for saved data, run the `archive-version` skill first.
3. Run the `verify-app` skill (manual pass).
4. Commit with the scope, e.g. `feat(chess): add timer and bump to v2.3.0`. Commit the rebuilt `<app>/index.html`, `<app>/files.txt`, `<app>/LICENSE` and `version.json` (the launcher shows a warning when a download does not match the hashes in it) with the change (a `type: "files"` app is broken in the launcher if `files.txt` or a listed `assets/` file is not pushed).

## The launcher (`game-launcher/`)

1. Bump with `bump-version` (it already sets `tauri.conf.json`, `package.json`, the lock files and `Cargo.toml`).
2. `cd game-launcher && npm test`. After a dependency change run `node scripts/gen-license.mjs` and commit `game-launcher/LICENSE` (the test fails when it is stale).
3. Commit, then ask the user before pushing a tag: `git tag v<version> && git push origin v<version>`.
   The `Build Desktop App` workflow (`.github/workflows/build.yml`) builds Linux (AppImage) + Windows (NSIS, per-user) and publishes the GitHub Release with `latest.json`, the `.sig` files and `LICENSE`. Signing is optional. Without the repo secrets the release is a plain unsigned build with no `latest.json` (players update by hand). To turn auto-update on, add the secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the workflow then signs and publishes `latest.json`, which installed launchers find in the newest release, so that release must be public (not draft, not prerelease). Never commit the key; keep an offline backup (lose it and installed launchers cannot update; players reinstall by hand). The public key is in `game-launcher/src-tauri/tauri.conf.json`.
