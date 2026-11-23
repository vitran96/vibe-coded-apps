---
id: game-launcher-files-type
app: game-launcher
status: implemented
version-introduced: 2.3.0
---

# Launcher catalog type `files` (multi-file apps)

## Goal

An app may ship `index.html` plus extra files (images, sounds, levels) and still install and run offline in the launcher, without packing a zip. `html` and `zip` keep working as today.

## Requirements

Build and check (`shared/scripts/`):
- R1 `build.mjs` writes `<app>/files.txt` for every app it builds, next to `index.html`; the file is committed like `index.html`.
- R2 Manifest format: UTF-8, no BOM, LF line ends, one entry per line, final newline, no comments or blank lines. The build writes `<sha256>  <path>` entries (64 lowercase hex, two spaces, path; the `sha256sum` format, so `sha256sum -c files.txt` works inside the app folder). The launcher also accepts a bare `<path>` line (a manifest from another host without hashes); such files are unchecked. Line 1 is `index.html`; the rest are sorted by path in byte order; no duplicate paths; `files.txt` never lists itself.
- R3 Manifest rule (allowlist): `index.html`, then `LICENSE` (specs/licensing.md R5), then every regular file under `<app>/assets/` (recursive, `/` separators, paths relative to the app folder). Dot-files and dot-folders are skipped. Nothing else is listed, so `src/`, `scripts/`, `tmp/`, `node_modules/`, `AGENTS.md`, `FIXED_ISSUES.md`, `CLAUDE.md`, `GEMINI.md` are never shipped. `sw.js` and other runtime-optional files are not listed. An app with no `assets/` gets a manifest of only `index.html`. `assets/` files the build already inlines stay listed (one simple rule; they are not needed at runtime but the download is small).
- R4 `build.mjs` fails (no write) if any manifest path fails the path rule of R9.
- R5 `check.mjs <app>` fails when `files.txt` is missing, differs from what `build.mjs` would write, or lists a file that does not exist.

Catalog (`version.json`):
- R6 `type` may be `"files"`; then `url` is the app's base folder (with or without a trailing `/`), and the manifest is `<url>/files.txt`. `html` and `zip` entries keep their current meaning; an entry without `type` whose `url` ends in `.zip` is still a zip.
- R7 `files` is opt-in per app: no app is switched to it by this spec (moving an app is a later task).

Launcher (`game-launcher/src/js/`):
- R8 The one install-type helper of `game-launcher-hardening` R10 (replaces the three `isZip` guesses in `installOrUpdateGame`, `prepareGameForLaunch`, `renderLibrary`) also returns `"files"` for `type: "files"`. An unknown `type` is refused with an error, not treated as `html`.
- R9 Path rule, applied to every manifest line before any file is downloaded, using the shared path helper of `game-launcher-hardening` R1/R2: reject an empty line, a leading `/`, a backslash, a `..` segment, NUL. On top of that, for manifest lines: reject any `:` (URL scheme or drive letter), a `.` segment, an empty segment (`a//b`) and control characters; line 1 must be `index.html`; duplicates are rejected. One bad line fails the whole install; the bad line is logged to the console, the player sees the plain message of `game-launcher-hardening` R17.
- R10 `installOrUpdateGame` for `files`: fetch `<url>/files.txt` (no-cache), validate (R9), then download each path from `<url>/<path>` (each segment URL-encoded) with the existing `downloadWithProgress`, compare its sha256 with the manifest when present (a mismatch never stops the install: it is the advisory warning of `game-launcher-hardening` R18/R20), and write the bytes to `games_cache/<id>/<path>`, creating parent folders.
- R11 Progress for `files` is files done / total, as 0..100; per-file byte progress is not shown.
- R12 The entry `index.html` gets the storage shim injected the same way as zip (after `<head>`, else prepended), using one shared function for both types.
- R13 After success the local manifest entry is `{ type: "files", entryPoint: "index.html", installed: true, version }`; on any failure the game is not marked installed and the error reaches the caller.
- R14 `prepareGameForLaunch` for `files` returns `{ mode: "url", url: convertFileSrc(games_cache/<id>/index.html) }` (asset://, like zip); it errors if the entry is missing.
- R15 `removeGame` for `files` removes the whole `games_cache/<id>/` folder, like zip.
- R16 The library card type pill shows `FILES` for this type; the offline catalog fallback keeps `type: "files"` from the local manifest (launch and remove read the manifest type, per `game-launcher-hardening` R11).

## Out of scope

- Atomic install (temp folder then swap), zip-slip checks, stale files from an older version, type-change orphans, manifest safety, error wording: `specs/game-launcher-hardening.md` (R1-R17). This spec depends on it and does not repeat it; its R3/R5/R6/R7 swap rules apply to the `files` folder exactly as to zip.
- Parallel downloads; resuming a partial install; skipping unchanged files on update (the hashes make it possible later; v1 re-downloads all).
- Moving existing apps from `html` to `files` (R7).

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1, R2, R3, R4 | `node shared/scripts/build.mjs --self-test` (no `assets/` gives index.html + LICENSE; nested `assets/` sorted; dot-files skipped; bad paths refused; `src/`, `scripts/` never listed because only `assets/` is walked) | unit |
| R5 | `node shared/scripts/check.mjs --all` (rules in `check.mjs`; verified by hand by corrupting `files.txt`, `LICENSE` and `version.json`: each fails; no automated negative test) | unit + manual |
| R6 | `test/files.test.js` R6 (trailing slash; unknown type refused); `test/safety.test.js` (`.zip` URL without type is zip) | unit |
| R7 | manual: `version.json` has no `files` entry | manual |
| R8 | `test/safety.test.js` R10 (`gameType`, unknown refused, no `isZip` left); `test/main.test.js` R10 | unit |
| R9 | `test/safety.test.js` (every rejected form); `test/files.test.js` R9 (only `files.txt` fetched, nothing written) | unit |
| R10, R11, R12, R13 | `test/files.test.js` (URLs requested, files written, progress 25/50/75/100, shim after `<head>`, manifest entry, failing file leaves nothing) | unit |
| R14, R15 | `test/files.test.js` R14/R15 | unit |
| R16 | `test/main.test.js` R10 (FILES pill); manual: install a `files` app, go offline, relaunch (no app uses `files` yet) | unit + manual |

## Notes

- `files.txt` is plain text so it can be read and diffed by hand; paths are relative to the app URL, so the app stays sub-route agnostic (CLAUDE.md rule 4).
- `html` mode still loads `index.html` alone, so for `html` apps extra files must stay optional (CLAUDE.md rule 3).
- Tauri scopes already allow this: `http:allow-fetch` for `https://*/*`, asset protocol `$APPDATA/**`.
- Decided: inlined `assets/` files stay listed; `sw.js` is not listed; apps without `src/index.html` still need a `files.txt` (`check.mjs` requires it).
- Hashes are advisory: they only mark the game with a warning (`game-launcher-hardening` R18), they never block install or play. `files.txt` may come from any host that follows this structure (R6).
