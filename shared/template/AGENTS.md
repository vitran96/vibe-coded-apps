# AGENTS.md — <app name>

Template stub from `shared/template/`. Replace this text with the app's rules, decisions and invariants.

- Route/folder id: `<id>` (kebab-case); storage prefix: `<prefix>_` (must be unique, matches `STORAGE_PREFIX` in `src/main.js`).
- Names: vi `<Tên tiếng Việt>`, en `<English name>`.
- Forced light theme (`giay`) by default; never follow the OS dark-mode setting.
- Build: `node shared/scripts/build.mjs <id>`; check: `node shared/scripts/check.mjs <id>` (see root `AGENTS.md`).
