# FIXED_ISSUES.md

Regression log: symptom, root cause, invariant, location, test. Newest first.

### [ISSUE-001] Windows CI unit tests fail (R6 path, R7 line endings)
- **Symptom:** "Build Desktop App" failed on Windows only: R6 threw `ENOENT scandir 'D:\D:\...'`, R7 (`game-launcher/LICENSE`) failed its regex.
- **Root Cause:** (a) a test used `new URL(...).pathname` as a file path, which is `/D:/...` on Windows; (b) the Windows runner checks out with CRLF and the repo had no `.gitattributes`, so LF-only regexes failed.
- **Invariant:** turn `import.meta.url` into a path with `fileURLToPath`, never `.pathname`; every text file is LF in every checkout (`.gitattributes`: `* text=auto eol=lf`); `gen-license.mjs` normalises the repo `LICENSE` to LF.
- **Location:** `test/config.test.js` (root path), `.gitattributes`, `scripts/gen-license.mjs` (root LICENSE read).
- **Test:** `test/config.test.js` R6 and `test/license.test.js` R7, run by the Windows job.

### [ISSUE-002] Desktop build step fails when no updater signing key is set
- **Symptom:** "Prepare Windows artifacts" exited 1 on a build without `TAURI_SIGNING_PRIVATE_KEY` although the build itself succeeded.
- **Root Cause:** the loop's last command `[ -f "$f.sig" ] && cp …` returns 1 when there is no `.sig`; bash `-e` uses that as the step's exit code.
- **Invariant:** optional-file copies in `build.yml` end with `|| true` (the `.sig` is optional).
- **Location:** `.github/workflows/build.yml` (Linux and Windows "Prepare … artifacts" steps).
- **Test:** dry run `gh workflow run build.yml -f platform=windows -f create_release=false` goes green.
