---
name: verify-app
description: Checklist to run before committing any change to an app in this repo - build, tests, no CDN/offline, relative paths and sub-route, i18n vi-first, accessibility and keyboard, storage prefix, version, and launcher compatibility.
---

# Verify an app

Run from the app folder (`cd <app>`). Stop and fix at the first failure.

## 1. Build and test

From the repo root: `node scripts/build.mjs <app> --test --check` (see the `build-app` skill). The build must finish with no warnings about missing files.

## 2. Offline / no CDN

```sh
grep -noE '(src|href)="https?://[^"]+"|from ?"https?://[^"]+"|"https?://[^"]+\.(m?js|css|woff2?)"' index.html
```

Expected: no output. Any hit is a runtime network dependency; vendor it.

## 3. Relative paths only

```sh
grep -noE '(src|href|action)="/[^/][^"]*"|register\(["'"'"']/|start_url["'"'"']?: *["'"'"']/' index.html
```

Expected: no output. Then serve the repo root and open the app twice, at its own route and at a renamed copy:

```sh
cd .. && cp -r <app> tmp-route-check && npx serve . 
# open http://localhost:3000/<app>/ and http://localhost:3000/tmp-route-check/ ; delete tmp-route-check after
```

Both must load, play, save and reload state the same way. Also open `index.html` directly from disk (`file://`) — it must still start.

## 4. i18n

- Start with cleared storage **and the OS in dark mode**: UI is Vietnamese, `<html lang="vi">`, and the theme is light (Giấy). `grep -n "prefers-color-scheme" src/*.js src/*.css index.html` must not show theme detection.
- Switch to English: every visible string changes (HUD, dialogs, toasts, results, rules page). No raw keys like `game.foo` on screen.
- Every new key exists in both `vi` and `en`.

## 5. Accessibility and keyboard

Unplug the mouse mentally: play a full game with keyboard only.

- Tab reaches every control in a sensible order, focus ring always visible.
- Board: arrow keys move a cursor, Enter/Space selects/places, the cursor is visible on the board.
- Esc closes the top dialog and returns focus to the control that opened it.
- Turn changes, check, win/lose/draw are announced via `aria-live`.
- Icon-only buttons have `aria-label` (translated).
- Reduced motion (OS setting) removes non-essential animation.
- New text/background colors keep ≥ 4.5:1 contrast in all four themes (`chess/scripts/check-contrast.mjs` shows how to check).

## 6. Storage and version

```sh
grep -noE "localStorage\.(get|set|remove)Item\(['\"][^'\"]+" src/*.js index.html | grep -v "<prefix>_" | grep -v "house:prefs"
grep -n "localStorage.clear" src/*.js index.html
```

Expected: no output for both (replace `<prefix>` with the app's prefix). Keys built from a prefix constant are fine; check that constant.
If the change is user-visible: `APP_VERSION` bumped and equal to this app's entry in root `version.json` (see `release-app`).

## 7. Launcher

The launcher runs `type: "html"` apps from `srcdoc` (no base URL, `localStorage` proxied).
If the app needs any file besides `index.html` to play, it must ship as `type: "zip"` instead. If you touched `game-launcher/`, run `npm test` there.

## 8. Regression log

If you fixed a bug that could come back, add an entry to `FIXED_ISSUES.md`: symptom, root cause, invariant, location, test.
