---
name: verify-app
description: Checklist to run before committing any change to an app in this repo - the automated check (build current, no network, i18n, storage, version, a11y, app tests), then the manual keyboard, sub-route, offline and language pass.
---

# Verify an app

Run from the repo root. Stop and fix at the first failure.

## 1. Automated gate

```sh
node shared/scripts/build.mjs <app>
node shared/scripts/check.mjs <app>     # must print PASS
```

`check.mjs` covers: the committed `index.html` equals a fresh build; no network URL, root-absolute path or un-inlined file; `vi` and `en` keys match and every used key exists; storage keys and `House.store` use the app prefix, and there is no `localStorage.clear()`; `APP_VERSION` equals the `version.json` entry; static a11y (`<html lang>`, an `aria-live` region, labelled buttons, no `tabindex` > 0, no focus outline removed without `:focus-visible`); and every `scripts/test*.mjs` passes.

Also run the extra tests the root `AGENTS.md` lists for the app (chess perft, chinese-chess run-rules-tests).

UI, storage or keyboard change: then run the `playwright-test` skill (`cd tools/e2e && npx playwright test --grep @<app>`).

## 2. Sub-route and file://

```sh
npx serve .     # from the repo root
```

Open `http://localhost:3000/<app>/`. Copy the folder to a throwaway name (`cp -r <app> zz-route-check`), open it at its new route, then delete the copy. Both must start, play, save and reload state the same way. Open `<app>/index.html` straight from disk (`file://`); it must start too.

## 3. Offline

In browser devtools, set the network to offline and reload. The app must start, play and play a sound with no network requests.

## 4. Keyboard only

Do not touch the mouse. Play a full game:

- Tab reaches every control in a sensible order, and the focus ring is always visible.
- Board: arrow keys move the cursor, Enter/Space place or select, and the cursor is visible on the board.
- Esc closes the open dialog and returns focus to the control that opened it.
- Turn changes, check, win/lose/draw are announced in the `aria-live` region.
- Icon-only buttons have a translated `aria-label`.
- Reduced motion (OS setting) removes non-essential animation.
- New text or background colors keep at least 4.5:1 contrast in all four themes (`chess/scripts/check-contrast.mjs` shows how to check).

## 5. Language and theme

- Clear this app's data, set the OS to dark mode, and start: Vietnamese, `<html lang="vi">`, light theme (Giấy). The app must never follow the OS theme.
- Switch to English: every visible string changes (HUD, dialogs, toasts, results, rules). No raw keys such as `game.foo` on screen.

## 6. Storage and version

- Load a save written by the previous released version; it must still resume.
- Settings → Dữ liệu clears only this app's keys; `house:prefs` (theme, language) and other apps' keys stay.
- If the change is user-visible: the repo version is bumped with `bump-version` (see `bump-version`).

## 7. Launcher

The launcher runs `type: "html"` apps from `srcdoc`. If the app needs any file besides `index.html`, it must ship as `type: "zip"` instead. If you touched `game-launcher/`, run `npm test` there.

## 8. Regression log

If you fixed a bug that could come back, add an entry to the app's `FIXED_ISSUES.md`: symptom, root cause, invariant, location, test.
