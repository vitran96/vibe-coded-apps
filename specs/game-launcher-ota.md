---
id: game-launcher-ota
app: game-launcher
status: accepted
version-introduced: 2.3.0
---

# Game launcher: install and update itself (Tự cập nhật)

## Goal

The desktop launcher installs for one user only (no admin rights) and updates itself like Steam or VS Code: it checks once a day, asks the player, installs, then asks to restart. Publishing an update needs a release only, never a code change. Games, saves and settings are never lost.

## Requirements

Installer:
- R1 The Windows installer is NSIS in `currentUser` mode: no admin prompt, installs under the user's own folders. The MSI and the `.deb` are no longer published (both install per machine and cannot self-update). Linux ships the AppImage only (user-level, self-updating).
- R2 The Windows installer offers "Create a desktop shortcut", checked by default; the Start-menu shortcut is always created. Tauri has no config key for this checkbox. Approach, in order: (a) verify what the stock NSIS finish page does in the built installer; (b) if it is missing or unchecked, use `bundle.windows.nsis.installerHooks` (a `.nsh` file; `NSIS_HOOK_PREFINISHPAGE` if the pinned bundler has it, see Notes); (c) last resort, a custom NSIS `template`.
- R3 App identity and data folder never change between versions: `identifier` stays `com.vi-tran.tauri-app`, so `games_cache/` and `manifest.json` survive every update. The launcher reads a manifest written by any older version (no data reset on update).

Update feed (no code change per release):
- R4 Uses the official Tauri updater plugin (`tauri-plugin-updater`, plus `tauri-plugin-process` for restart). The feed is the `latest.json` of the newest published GitHub Release (`.../releases/latest/download/latest.json`), configured once in `tauri.conf.json` `plugins.updater.endpoints`. It holds `version`, `notes`, `pub_date` and per-platform `url` + `signature`.
- R5 When the signing key secret exists, the release workflow (`.github/workflows/build.yml`) builds signed update bundles and uploads them and `latest.json` to the release; the release must be public, not draft or prerelease, or it does not become "latest". Cutting a `v*` tag is the only step to ship an update.
- R6 Signing is optional for the project but mandatory for any update that is offered: when the repo secret exists the build is signed and the release carries `latest.json`; without it the build is unsigned, no feed is published and installed launchers are updated by hand. Every offered update is signed. The public key is in `tauri.conf.json`; the private key and password are GitHub secrets (`TAURI_SIGNING_PRIVATE_KEY`, `..._PASSWORD`), never in the repo. A download whose signature does not verify is discarded and never installed.
- R7 An update is offered only when the feed `version` is higher than the running version (semver); a lower or equal version is ignored, never a downgrade.

Behaviour (`game-launcher/src/js/`):
- R8 While the launcher is open it checks at most once per 24 hours: on start, and while it stays open every 24 h. The time of the last successful check is stored under a launcher key (not a game key). A failed check (offline, 404, bad JSON) is silent and retried at the next start.
- R9 Setting "Cập nhật phần mềm / Software updates" with three choices: "Hỏi tôi" / "Ask me" (default), "Chỉ tải về" / "Download only", "Không cập nhật" / "Never update". "Never" skips the daily check and every prompt. "Download only" downloads in the background without asking, then asks only to restart.
- R10 Ask mode: when a new version is found, a dialog shows the new version, plain-language notes (from `notes`, vi/en fallback to the text as given) and three buttons: "Cập nhật ngay" / "Update now", "Để sau" / "Later", "Không hỏi nữa" / "Don't ask again" (sets R9 to Never). "Later" asks again at the next check.
- R11 A "Kiểm tra cập nhật" / "Check for updates" button in Settings always works, even in Never mode, and tells the player "Bạn đang dùng bản mới nhất" / "You have the latest version" when there is none.
- R12 Download shows progress. When the download is done a dialog asks "Khởi động lại ngay" / "Restart now" or "Để sau" / "Later"; the install (and, on Windows, the installer's own restart) happens only on "Restart now". "Later" keeps playing and the update is offered again at the next start. The app never restarts without the player's choice.
- R13 No prompt appears while a game is running or a download or install of a game is in progress; it waits until the player is back on the library screen.
- R14 Any failure (no network, bad signature, disk full) shows one plain message (vi first, no codes or URLs) saying the current version keeps working, and leaves the installed launcher untouched; technical detail goes to `console.error` only.
- R15 All new text is in the `vi` and `en` dictionaries, dialogs are keyboard reachable (Esc = Later, visible focus, buttons at least 44px), per the house rules.
- R16 Settings → Thông tin shows the running launcher version (already set by `bump-version.mjs`) and the last check time.
- R17 A catalog entry may have `minLauncher` and `maxLauncher` (semver, inclusive). Absent, `null` or `-1` means no limit; any other invalid value is ignored (no limit) with a `console.warn`. A game outside the range cannot be installed, updated or launched: its card shows a plain message (below min: "Cần cập nhật phần mềm trước" / "Update the launcher first" with a button that starts the R10 flow; above max: "Trò chơi này chưa dùng được với bản phần mềm này" / "This game does not work with this launcher version"). Files already on disk are kept.
- R18 The range is compared with the running launcher version; the update modal for games (`game-launcher-hardening` R16) skips out-of-range games. `check.mjs` fails when `minLauncher` is greater than `maxLauncher` or not valid.

## Out of scope

- macOS builds and notarisation; mobile; delta (binary diff) updates; staged rollouts; rollback to an older version.
- Updating games (`specs/game-launcher.md`, `game-launcher-hardening`).
- A custom update server or a hand-written app-version JSON: `latest.json` from the release plays that role.

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | `test/config.test.js` R1 (targets `nsis` + `appimage`, `installMode: currentUser`); manual: install on Windows as a normal user, no admin prompt (not run here) | unit + manual |
| R2 | manual: the built installer offers "Create desktop shortcut", checked (NOT verified: needs a Windows build; see Notes) | manual |
| R3 | `test/config.test.js` R3 (identifier unchanged; a 2.2.0 manifest still loads, launches, removes) | unit |
| R4 | `test/config.test.js` R4 (one endpoint, newest release `latest.json`, updater artifacts on); `test/latest.test.js` (feed shape) | unit |
| R5 | `test/latest.test.js` (workflow signs, writes `latest.json`, no msi/deb); manual: tag a release and see `latest.json` and `.sig` files (not run here) | unit + manual |
| R6 | `test/config.test.js` R6 (public key set, no private key in the repo); manual: tamper a bundle, update refused (the plugin verifies the signature) | unit + manual |
| R7 | `test/safety.test.js` (strictly higher only); `test/updater.test.js` R7 | unit |
| R8 | `test/updater.test.js` R8 (23 h no check, 25 h check, silent failure, time stored) | unit |
| R9, R10, R11 | `test/updater.test.js` (modes, ask choices, never mode, check now); `test/main.test.js` ota R9 | unit |
| R12, R13, R14 | `test/updater.test.js` (restart only on yes, deferral while a game runs, failure message); `test/dialogs.test.js` | unit |
| R15 | `test/dialogs.test.js` (Esc = Later, first button focused); `test/i18n.test.js`; manual: keyboard pass | unit + manual |
| R16 | `test/main.test.js` ota R9/R16 | unit |
| R17, R18 | `test/safety.test.js` (null, -1, absent, min only, max only, both, invalid, boundaries); `test/files.test.js` (install and launch refused outside the range); `test/main.test.js` (card message); `check.mjs --all` (min > max fails, verified by hand) | unit |

## Notes

- Keep the private signing key backed up offline: if it is lost, installed launchers cannot verify any new update and players must reinstall by hand. Changing the public key has the same effect.
- Launchers older than this feature have no updater: players install once by hand, then updates are automatic.
- Status stays `accepted` until R1, R2 and R5 are checked on a real Windows build and a real tagged release. Nothing here could build the installer or run `cargo check` (the nix-shell build was not run).
- Optional by decision (2026-11-23): without the secrets the release is a plain unsigned build; the launcher's daily check then fails silently (R8) and "Check for updates" says it cannot check. The default `tauri build` needs no key (`createUpdaterArtifacts` is off; `src-tauri/tauri.signed.conf.json` turns it on in CI).
- Signing key: generated on this machine in `~/.tauri/game-launcher.key` (password in `game-launcher.key.password`, both mode 600, outside the repo). To publish: add both as repo secrets `TAURI_SIGNING_PRIVATE_KEY` (the key file text) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and back them up offline.
- Done with this spec: the new packages are installed (`@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, crates `tauri-plugin-updater`, `tauri-plugin-process`).
- Needs (done): `tauri-plugin-updater` and `tauri-plugin-process` in `Cargo.toml` and `lib.rs`, `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` in `package.json`, and `updater:default`, `process:allow-restart` in `capabilities/default.json`. These are new dependencies: ask before installing.
- R2 research: Tauri issue #15267 (closed, PR #16168) added an `NSIS_HOOK_PREFINISHPAGE` hook; which bundler release has it is unconfirmed, and whether the stock finish page already shows a checked desktop-shortcut box is also unconfirmed. Check both on the pinned Tauri before choosing (a)/(b)/(c).
- Decided: new dependencies are approved for implementation; `.deb` dropped; min/max launcher version added (R17).
