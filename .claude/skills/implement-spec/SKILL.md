---
name: implement-spec
description: Implement an accepted spec in specs/<app>.md - diff each numbered requirement against the code, then build, check, add an e2e test per requirement, bump the version if user-visible, log bugs, and mark the spec implemented. Use when the user asks to build, implement or fix what a spec says, or after save-spec for a new app.
---

# Implement a spec

Read `specs/README.md`, the app's `specs/<app>.md`, and its `.claude/rules/<app>.md` and `FIXED_ISSUES.md` if present; keep every invariant.

## 1. Gate

Implement only `status: accepted` (or a `draft` the user asked to build now). New app: run `new-app` first.

## 2. Diff

Read the spec's Requirements and Acceptance. For each R, find the code that does it:

```sh
grep -rn "<keyword>" <app>/src/ | head; grep -n "test('" tools/e2e/specs/<app>.spec.mjs
```

List each R as `done` or `missing`, with its file, before coding.

## 3. Implement the missing Rs

Edit `<app>/src/` only (never a built `index.html`), reuse `shared/house/`, follow root `CLAUDE.md`.

## 4. Build and check

```sh
node shared/scripts/build.mjs <app>
node shared/scripts/check.mjs <app>
```

## 5. One e2e test per R

Add a test to `tools/e2e/specs/<app>.spec.mjs` (see `playwright-test`), titled `D<n> R<k>: ...`. If a check is manual only, say so in the spec; do not invent a test.

```sh
cd tools/e2e && npx playwright test --project=chromium --grep @<app>
```

## 6. Version and bugs

- User-visible change: `bump-version` skill. Never edit `APP_VERSION` or `version.json` by hand.
- Bug fixed along the way: entry in `<app>/FIXED_ISSUES.md`.

## 7. Mark the spec

Tick passing acceptance rows; leave `TBD` (with a Notes reason) where no check exists. When every R has code and a passing check: `status: implemented`, `version-introduced` = new version.

## 8. Final gate

```sh
node shared/scripts/check.mjs --all
```

Then the `verify-app` manual pass. Do not commit (this repo uses jj).

Report: Rs done, Rs missing, version bumped, manual steps left.
