---
id: licensing
app: repo
status: accepted
version-introduced: 2.3.0
---

# Licenses (Giấy phép)

## Goal

This repo is MIT. Every app and the desktop launcher carries a `LICENSE` file that states the repo license and lists the license of every third-party library it contains, so a copy of any app, or of the installed launcher, is lawful to share.

## Requirements

- R1 The repo root has `LICENSE` with the MIT text, copyright `2026 vitran96`. (Done with this spec.)
- R2 Every app has `<app>/LICENSE`: the repo MIT text, then a "Third-party notices" section with, for each library the app's build actually inlines (Three.js, Tone.js, each font file): name, pinned version, license name and the full license text copied from `shared/vendor/**`.
- R3 `build.mjs` writes `<app>/LICENSE` (never by hand); it is committed with `index.html`, and `check.mjs` fails when it is missing or stale. Apps without any vendored library get the MIT text only.
- R4 The same notices are embedded at the top of the built `index.html` as an HTML comment, so a copy of `index.html` alone (launcher `html` type, a downloaded file) still carries them.
- R5 `LICENSE` is part of the `files.txt` manifest, right after `index.html`, so the launcher `files` type installs it (`game-launcher-files-type` R2/R3 updated at implementation).
- R6 `check.mjs` fails when a library under `shared/vendor/` has no license file, or a license file does not name the pinned version's license.
- R7 `game-launcher/LICENSE` has the repo MIT text plus notices for everything shipped in the binary: runtime npm dependencies (`@tauri-apps/*`, `jszip`, anything Vite bundles into `dist/`) and Rust crates (from `cargo metadata`, license text from the crate sources). A dual-licensed package is listed under the permissive option (`jszip`: MIT).
- R8 `game-launcher/scripts/gen-license.mjs` (Node, zero new dependencies) generates R7 from `package-lock.json`, `node_modules` and `cargo metadata`. It fails on a dependency whose license is not in an allowed list (MIT, BSD-2/3, ISC, Apache-2.0, OFL-1.1, Zlib, Unicode, MPL-2.0 for crates) so a copyleft package is a conscious decision.
- R9 The launcher ships the file: the Windows installer shows it on a license page (`bundle.licenseFile`), it is bundled as a resource (also in the AppImage), and Settings → Thông tin has a "Giấy phép" / "Licenses" button that shows it (vi and en labels, keyboard reachable). It is attached to each GitHub Release.
- R10 `npm test` in `game-launcher/` fails when `game-launcher/LICENSE` is stale or lacks a runtime dependency.

## Out of scope

- Legal review, SBOM formats (SPDX, CycloneDX), per-game license button in the apps (TBD).
- Dev-only tools (Playwright, Tauri CLI) that are not shipped.

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | `head -3 LICENSE` | manual |
| R2, R3, R4 | `node shared/scripts/build.mjs --self-test` (notices, comment-safe embed, only used libraries); `check.mjs --all` (stale `LICENSE` fails, verified by hand) | unit |
| R5 | `check.mjs --all` and the `files.txt` self-tests: `LICENSE` is listed after `index.html` | unit |
| R6 | `check.mjs --all` (verified by hand: removing `shared/vendor/tone@*/LICENSE` fails both the repo check and every app that inlines it) | unit + manual |
| R7, R8 | `game-launcher/test/license.test.js` (`pickLicense` table, MIT preferred, copyleft refused, jszip under MIT, every runtime dependency present) | unit |
| R9 | `test/config.test.js` (`licenseFile`, resource); `test/latest.test.js` (workflow attaches LICENSE); manual: run the Windows installer and see the license page, open Settings → Thông tin → Giấy phép (not run here) | unit + manual |
| R10 | `cd game-launcher && npm test` (fingerprint of both lock files must match the one stored in `LICENSE`) | unit |

## Notes

- Status stays `accepted` until the R9 installer license page and the Giấy phép button are checked by hand.
- A few crates (16 notices today) ship no license file; their entry says so and names the repository.
- The fingerprint covers package names and versions from `package-lock.json` and `Cargo.lock`, not the license texts; run `node scripts/gen-license.mjs` after any dependency change.
- Copyright holder is the GitHub handle `vitran96`; change it to a legal name in R1 and regenerate if wanted.
- Fonts are OFL-1.1: the OFL text must travel with the font, which R2 and R4 cover.
- `jszip` is `(MIT OR GPL-3.0-or-later)`; the notice states that MIT is chosen.
