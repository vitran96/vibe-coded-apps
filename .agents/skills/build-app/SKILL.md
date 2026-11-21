---
name: build-app
description: Build and check apps in this repo - one app, all apps, the static check gate, helper self-tests, and the game-launcher (web build or desktop binary). Use whenever you need to build, rebuild or check anything here.
---

# Build and check

Run from the repo root. Zero dependencies for apps (Node 22 in CI). Scripts exit non-zero on failure.

| Case | Command | Result |
|---|---|---|
| Rebuild one app after editing `src/` | `node shared/scripts/build.mjs chess` | `chess/index.html` regenerated from `chess/src/` |
| Several apps | `node shared/scripts/build.mjs chess caro` | each rebuilt; exit 1 if any fails |
| Every app | `node shared/scripts/build.mjs --all` | apps without `src/index.html` are skipped |
| Static gate before a commit | `node shared/scripts/check.mjs <app>` or `--all` | built file current, no network, i18n, storage, version, a11y, app tests |
| Helper self-tests | `node shared/scripts/build.mjs --self-test` and `node shared/house/self-test.mjs` | build rules and house helpers |
| Launcher web frontend | `cd game-launcher && npm ci && npm test && npm run build` | `game-launcher/dist/` |
| Launcher desktop binary | `cd game-launcher && npm run tauri build` | needs Rust + system WebKit libs; CI does this on a `v*` tag |

## Notes

- The build inlines CSS, JS, fonts and the import-map libraries into one `index.html`. It fails on any network URL, root-absolute path or un-inlined local file, and warns above 2 MB.
- Commit the rebuilt `index.html` together with the `src/` change. `check.mjs` fails when the committed file is stale.
- Test scripts not named `test*.mjs` (chess `perft.mjs`, chinese-chess `run-rules-tests.mjs`) are not run by `check.mjs`; run them by hand (root `AGENTS.md` lists them).
- A new app is found automatically: any top-level folder with `src/index.html` or `index.html`.
