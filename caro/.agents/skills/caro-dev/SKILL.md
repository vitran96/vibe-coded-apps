---
name: caro-dev
description: >-
  Development, inspection, patching, testing, and i18n management for the single-file Caro & Gomoku web app.
  Use whenever viewing, editing, debugging, translating, or testing index.html in this repository.
---

# Caro & Gomoku Single-File Development Skill

This repository is built entirely inside a single file: [index.html](file:///home/vi-tran/repos/vibe-coded-apps/caro/index.html) (~4,200 lines).
Because standard full-file rewrites are error-prone on large single files, all development operations must be executed through the zero-dependency Node.js CLI tool: [scripts/caro.js](file:///home/vi-tran/repos/vibe-coded-apps/caro/scripts/caro.js).

## Core Rules & Invariants

1. **Strict i18n Scope:** ONLY Vietnamese (`vn`) and English (`eng`) are supported. **Vietnamese is always default.**
2. **Single-File Runtime:** Everything (CSS, HTML, Three.js, Tone.js, AI worker, PWA manifest) resides strictly in [index.html](file:///home/vi-tran/repos/vibe-coded-apps/caro/index.html). Never create external `.css` or `.js` bundle files.
3. **No Python:** All tooling, testing, and scripting must use Node.js with standard JavaScript (`node scripts/caro.js`).
4. **Relaxing Spa Music:** Background music is disabled by default (`musicOn: false`) and uses peaceful ambient soundscapes (no drum machines or vinyl noise).

---

## Command Reference ([scripts/caro.js](file:///home/vi-tran/repos/vibe-coded-apps/caro/scripts/caro.js))

### 1. View & Explore Code Sections
Instead of scrolling through 4,200 lines, target specific sections by ID:

```bash
# List all sections with line numbers and sizes
node scripts/caro.js list

# View a section with line numbers (e.g. audio, i18n, game, rules, css, dialogs)
node scripts/caro.js view audio
node scripts/caro.js view i18n
node scripts/caro.js view rules --start 1 --end 40

# Search for any string or regex across index.html with line numbers and context
node scripts/caro.js find "spaV1"
```

Available section IDs:
`head`, `css`, `body`, `dialogs`, `constants`, `i18n`, `storage`, `rules`, `ai-engine`, `tests`, `ai-client`, `audio`, `timer`, `renderer`, `input`, `game`, `replay`, `ui`, `pwa`, `main`, `sw-source`.

---

### 2. Safely Edit & Patch Code

#### Method A: Exact String Patch (Recommended for small to medium edits)
Validates that the target string appears exactly once in `index.html`. Creates an automatic backup (`index.html.bak`) and checks JS syntax before applying:

```bash
node scripts/caro.js patch "<exact_old_code>" "<new_code>"
```

If something goes wrong:
```bash
node scripts/caro.js revert
```

#### Method B: Section Extract & Inject (Recommended for large refactors)
Extract a single section to a temporary file, edit it cleanly, and inject it back with syntax validation:

```bash
# 1. Extract section
node scripts/caro.js extract audio ./audio_temp.js

# 2. Edit audio_temp.js as needed...

# 3. Inject back into index.html (syntax checked automatically)
node scripts/caro.js inject audio ./audio_temp.js

# 4. Clean up temporary file
rm ./audio_temp.js
```

---

### 3. Managing Translations (i18n)

Only Vietnamese (`vn`) and English (`eng`) are supported.

```bash
# List all 150+ translation keys across vn and eng
node scripts/caro.js i18n list

# Inspect a specific key's translations
node scripts/caro.js i18n get playAsYou

# Add a new translation key safely to both vn and eng
node scripts/caro.js i18n add newFeatureKey "Tính năng mới" "New Feature"

# Verify all HTML data-i18n bindings and check for duplicate/missing keys
node scripts/caro.js i18n check
```

When adding UI elements:
- In HTML: `<span data-i18n="myKey">Văn bản tiếng Việt</span>`
- In JS: `t('myKey', ...args)`

---

### 4. Verification & Testing

Always run the sanity checker after modifying code:

```bash
# Run all 26 game/rules/AI unit tests in Node.js (< 0.1s)
node scripts/caro.js test

# Run full project sanity check:
# - Validates JS module syntax
# - Validates HTML tag balances (<dialog>, <script>, <style>)
# - Checks i18n rules (only vn & eng, vn default, no missing keys)
# - Checks audio defaults (music off by default)
# - Runs all 26 unit tests
node scripts/caro.js check
```
