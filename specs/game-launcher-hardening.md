---
id: game-launcher-hardening
app: game-launcher
status: implemented
version-introduced: 2.3.0
---

# Game launcher: safe install and update (Cài và cập nhật an toàn)

## Goal

Older, non-technical players never lose a playable game because a download broke, and a bad or hostile download cannot write outside the game's folder. Extends `specs/game-launcher.md` (R3, R5); paths below are in `game-launcher/src/js/`.

## Requirements

- R1 Every archive entry path is checked before anything is written: reject `..` segments, absolute paths (`/x`, `C:\x`, `C:/x`), backslashes, empty or NUL-containing names. One bad entry rejects the whole install; nothing is written to the game folder (today `zipExtractor.js:28` joins it unchecked).
- R2 The R1 check is one exported helper; the files type (`specs/game-launcher-files-type.md`, written separately) uses the same helper for its paths instead of its own.
- R3 A zip install or update writes into `games_cache/<id>.tmp/` (cleared first), checks the entry point exists there, then removes `<id>/` and renames `<id>.tmp/` to `<id>/`. On any failure `<id>/` and its manifest entry stay untouched and `<id>.tmp/` is removed.
- R4 An html install or update writes `<id>.html.tmp`, checks it is non-empty and decodes as UTF-8, then renames it over `<id>.html` (today `gameManager.js:148` overwrites in place). Same failure rule as R3.
- R5 After an update, files the new version no longer ships are gone (follows from R3's swap; asserted by its own test).
- R6 The manifest entry (version, type, entryPoint) is written only after the swap in R3/R4 succeeds.
- R7 When an update changes type (html to zip or zip to html), the old type's file or folder is removed after the swap succeeds, so no orphan stays in `games_cache/` (today `removeGame` removes only `meta.type`'s artifact, `gameManager.js:176`).
- R8 "Redownload" never removes the playable copy first: it is an install with R3/R4 rules (today `main.js:370` calls `removeGame` before `installOrUpdateGame`, so a failed redownload leaves no game).
- R9 A download whose byte count differs from a non-zero `Content-Length` fails before anything is written (today `downloadWithProgress`, `gameManager.js:87-108`, never compares). Empty bodies fail too. A compressed transfer (a `Content-Encoding` header) is not length-checked, because its `Content-Length` is that of the compressed bytes.
- R10 One helper decides the install type for a catalog entry (`type` field, `.zip` URL fallback); it replaces the copies at `gameManager.js:121`, `gameManager.js:212` and `main.js:183` and drives the type pill (`main.js:196`).
- R11 Once installed, the manifest's `type` and `entryPoint` are authoritative: launch, remove and the type pill read them, not the catalog (today `prepareGameForLaunch` uses `game.entryPoint` from the catalog, `gameManager.js:220`, which the offline catalog at `main.js:118` does not carry).
- R12 `saveManifest` writes `manifest.json.tmp` then renames it over `manifest.json` (today `gameManager.js:60` writes in place).
- R13 An unreadable or invalid `manifest.json` is renamed to `manifest.json.bad` before defaults are used, so the next save does not silently erase every install record (today `gameManager.js:44` swallows the error and the next save overwrites it).
- R14 Manifest changes are read-modify-write on a fresh read, serialised one at a time: two installs at once, or a settings toggle during an install, never drop the other change (today `installOrUpdateGame` reads at `gameManager.js:123` and saves at `:159`; the auto-update toggle saves a manifest read at render time, `main.js:336-338`).
- R15 Install, update, redownload and remove buttons in Settings catch errors, re-enable the button with its normal label and show the R17 message (today `main.js:348`, `:359`, `:371` have no catch; the button stays on "Updating..." forever).
- R16 The update modal shows per-game progress and, at the end, which games updated and which failed, in plain words, with a "Thử lại" / "Try again" button that retries only the failed ones (today `updateModal.js:42` passes a no-op progress and `:44` only logs to the console). The auto-update loop (`main.js:148-153`) continues after one game fails and tells the player the same way.
- R17 Error messages are i18n keys, vi first, with no codes, URLs or English-only text (today `main.js:252` shows `err.message`, e.g. `HTTP 404 when fetching https://...`, and `gameManager.js:222`, `:226` are hard-coded English). Each says what happened and what to do, and that the old version still works when it does. Wording (TBD final):
  - no network: "Không tải được trò chơi. Hãy kiểm tra kết nối mạng rồi thử lại." / "Could not download the game. Check your internet connection and try again."
  - broken or unsafe download: "Tệp tải về bị hỏng. Bản cũ vẫn chơi được. Hãy thử lại sau." / "The download was damaged. Your old version still works. Please try again later."
  - files missing at launch: "Không tìm thấy trò chơi trên máy. Hãy bấm Tải lại." / "The game is missing on this computer. Please press Download again."
  - Technical detail goes to `console.error` only.
- R18 Integrity is advisory, never blocking. A catalog entry may carry `sha256` and `size` of its payload (html: `index.html`; zip: the zip; files: `files.txt`, whose lines may carry per-file hashes, `game-launcher-files-type` R2/R10). After download the launcher compares them: a mismatch never stops the install or the play. The game installs and runs, the manifest records `integrity: "mismatch"`, and the library card and Settings show a plain warning ("Không kiểm tra được độ nguyên vẹn của trò chơi này. Bạn vẫn chơi được." / "This game could not be verified. You can still play it."). Fields absent: `integrity: "unchecked"`, no warning; all match: `"ok"`. A cut-off transfer (R9) and a missing entry point (R3) are still real failures. For this repo `build.mjs` writes the fields and `check.mjs` fails when stale.
- R19 The catalog is not tied to this repo. `CATALOG_URL` defaults to this repo’s Pages URL `https://vitran96.github.io/vibe-coded-apps/version.json` (same deployment as the apps; today `gameManager.js:8` reads raw GitHub `main`, which updates before Pages deploys) but stays replaceable (`setCatalogUrl`), and entry `url`s may be any host serving the same structure (`index.html`, a `.zip`, or `files.txt` plus files). No code assumes this repo’s host or name. Catalog and download requests send no-cache headers.
- R20 On an R18 mismatch the launcher first retries that download once with a cache-busting `?r=<timestamp>`; if it still differs, R18’s warning applies.
- R21 Catalog and entry URLs must be `https://` (or `http://localhost` / `127.0.0.1` for local testing); any other scheme is refused with the R17 message.

## Out of scope

- Signatures; blocking on a bad checksum (R18 only warns).
- Resuming partial downloads; disk-space checks.
- The files type itself (`specs/game-launcher-files-type.md`).

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | `test/zipExtractor.test.js` R1 (`../x`, `/x`, `C:\x`, `a\..\x`: rejected, nothing written); `test/files.test.js` R9 | unit |
| R2 | `test/safety.test.js` (`unsafePath`); `zipExtractor.js` and `parseFilesManifest` import it | unit |
| R3, R6 | `test/gameManager.test.js` R3/R6 (zip fails midway, old folder and manifest kept, no `.tmp`); R3 entry point missing | unit |
| R4 | `test/gameManager.test.js` R4/R6 (html write fails), R4 invalid UTF-8 | unit |
| R5 | `test/gameManager.test.js` R5 | unit |
| R7 | `test/gameManager.test.js` R7 (html to zip and back) | unit |
| R8 | `test/gameManager.test.js` R8 (failed redownload keeps the game); `test/main.test.js` R8 (no `removeGame` before install) | unit |
| R9 | `test/gameManager.test.js` R9 (cut-off, empty, compressed) | unit |
| R10 | `test/safety.test.js` R10 (`gameType` table; no other `.zip` guess in `src/js`); `test/main.test.js` R10 (pill) | unit |
| R11 | `test/gameManager.test.js` R11 | unit |
| R12, R13, R14 | `test/gameManager.test.js` R12, R13, R14 | unit |
| R15 | `test/main.test.js` R15 (failing Download: plain message, row drawn again) | unit |
| R16 | `test/updateModal.test.js` R16 (one of two fails: both listed, retry updates only the failed one, progress text); auto-update loop continues and alerts (code in `main.js`, not unit-tested) | unit |
| R17 | `test/i18n.test.js` R17 (vi/en parity, plain words, `errorText`); manual: unplug the network, press Update, read the message in vi and en | unit + manual |
| R18, R20 | `test/gameManager.test.js` R18, R20; `test/files.test.js` R18; `node shared/scripts/check.mjs --all` (stale `sha256`/`size` fail) | unit |
| R19 | `test/gameManager.test.js` R19 (default URL, replaceable, foreign host installs, no-cache header) | unit |
| R21 | `test/gameManager.test.js` R21; `test/safety.test.js` | unit |

## Notes

- R3/R4/R12 use `rename` from `@tauri-apps/plugin-fs`. `fs:allow-appdata-write-recursive` already includes it (its `write-all` set), so `capabilities/default.json` needed no change for it.
- A foreign catalog is untrusted input: R1/R2 (path checks), R9, R21 matter most there; R18 only informs the player.
- Moving the default off raw GitHub also needs `release-app`/`bump-version` docs to name the Pages URL (with the implementation).
- Done as a side effect: the zip extractor injects the shim only into the entry point (test in `zipExtractor.test.js`).
- Not unit-tested: the hourly/auto-update alert in `syncCatalogAndCheckUpdates` and the card/Settings integrity warning text (rendered from `meta.integrity`).
