---
name: playwright-test
description: Run, debug and add Playwright browser tests (tools/e2e) for apps, not the desktop app; seed old saves; WebGL headless notes.
---

# Playwright tests

## 1. When

After `check.mjs` passes and before committing any UI, storage, i18n or keyboard change. Always for a new app (new-app step 6).

## 2. Setup once

```sh
cd tools/e2e && npm ci && npx playwright install --with-deps chromium   # firefox/webkit optional
```

Apps never need this. `check.mjs` and `build.mjs` do not call it.

## 3. Run

| Want | Command (from `tools/e2e`) |
|---|---|
| Everything, Chromium + phone | `npx playwright test --project=chromium --project=phone-portrait` |
| One app | add `--grep @<app>` (tests are tagged by app name) |
| One file | `npx playwright test specs/caro.spec.mjs` |
| Another engine | `--project=firefox` (WebKit needs `E2E_WEBKIT=1`, see config) |
| Debug | `--headed`, `--debug`, or `PWDEBUG=1` |
| Report | `npx playwright show-report` (traces on failure: `npx playwright show-trace <zip>`) |

The server (`tools/e2e/server.mjs`) starts itself on `127.0.0.1:4173`. Tests load the built `index.html`, never `src/`, so run `build.mjs` first.

## 4. Fixtures (`lib/`)

- `test` (fixtures.mjs): fails any test on an external request, page error or console error.
- `seed(page, 'caro-1.1.0.json')`: writes a legacy save before the app runs (once per tab).
- `stored(page, 'caro_current')`: reads back a localStorage key as JSON. Use it for real state.
- `board.mjs`: `walk(page, dx, dy)` moves the cursor; `expectAnnounced(page, /text/)` waits on live regions.
- `apps.mjs`: `MODES` (served, pages, renamed, deep, file) and `newVsAi` recipes. `house-adapters.mjs`: per-app house selectors and `keyMove`.

## 5. Old saves

`saves/<app>-<ver>.json` holds real or hand-built localStorage. `capture-saves.mjs` re-captures from git history (old builds need network, run by hand). Chess and chinese-chess captures did not reach a move, so their files are hand-built from the legacy code; say so in the commit.

## 6. New app

Copy `specs/_template.spec.mjs` to `specs/<app>.spec.mjs`, replace `<APP>`, fill `MOVE`, the announcement regex, and add a `NEW_VS_AI` and `HOUSE` recipe. `coverage.spec.mjs` fails until the file exists.

## 7. Writing rules

- Keyboard first. Read state from text a screen reader gets, or from storage. No pixels.
- No `waitForTimeout`. Use `expect.poll` or `expectAnnounced`.
- No test-only code in apps. The one allowed hook is read-only `House.debug`.
- A failing WebGL assertion becomes `test.fixme('reason')`, never deleted.

## 8. WebGL and flake notes

- Chromium flags: `--use-angle=swiftshader --enable-unsafe-swiftshader`. Firefox: `webgl.force-enabled`.
- "Canvas blank" usually means the data-URL import map or Three.js failed in that engine: check the console guard output first.
- Retries are 1 on CI only. Under load, caro B4 and B7 failed once and passed on rerun: rerun a single test before debugging it.
- Open finding: caro `ensureVisible()` recentres the camera on every placement (see caro.spec D4a).
