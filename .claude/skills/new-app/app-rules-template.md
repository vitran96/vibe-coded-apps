---
paths:
  - "<id>/**"
---

# <app name> — app rules

Template stub from the `new-app` skill. Save as `.claude/rules/<id>.md`, replace this text with the app's rules, decisions and invariants. Root `CLAUDE.md` wins on conflict.

- Route/folder id: `<id>` (kebab-case); storage prefix: `<prefix>_` (must be unique, matches `STORAGE_PREFIX` in `src/main.js`).
- Names: vi `<Tên tiếng Việt>`, en `<English name>`.
- Forced light theme (`giay`) by default; never follow the OS dark-mode setting.
- Build: `node shared/scripts/build.mjs <id>` (writes `index.html` and `files.txt`; commit both); check: `node shared/scripts/check.mjs <id>` (see root `CLAUDE.md`).
