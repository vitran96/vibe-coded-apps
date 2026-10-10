# Caro & Gomoku - Project Guidelines & Rules

## 1. Single-File Architecture Constraint
- **Single File Truth:** The entire application runtime must reside strictly in [index.html](file:///home/vi-tran/repos/vibe-coded-apps/caro/index.html).
- Do NOT extract or split runtime styles, templates, or scripts into external `.css` or `.js` asset files.
- All styles (`<style>`), dialogs (`<dialog>`), game logic, AI Web Worker, Three.js 3D board renderer, Tone.js audio engine, i18n dictionaries, and service worker templates are bundled in [index.html](file:///home/vi-tran/repos/vibe-coded-apps/caro/index.html).

## 2. i18n (Internationalization) Standards
- **Supported Languages:** ONLY Vietnamese (`vn`) and English (`eng`) are supported. Do NOT add any other languages.
- **Default Language:** Vietnamese (`vn`) is always the default (`DEFAULT_SETTINGS.display.lang = 'vn'`).
- **Translation Completeness:** Every user-facing string (HUD, toolbar, replay bar, dialogs, toasts, confirmation messages, game settings, history filters) MUST have both `vn` and `eng` translations in the `I18N` object.
- **Template Bindings:** Use `data-i18n="<key>"` in HTML elements and call `t('<key>', ...args)` in JavaScript.

## 3. Audio & Music Defaults
- **Default State:** Background music is disabled by default (`DEFAULT_SETTINGS.audio.musicOn: false`).
- **Music Style:** Ambient relaxing spa music (warm sine pads, soft meditation chimes, lush 6.5s reverb, 44 BPM). No drums, beats, or vinyl noise.

## 4. Developer Toolchain & Scripts
- **Strictly Node.js / JavaScript:** Do NOT use Python. All helper scripts, test runners, and automation must use Node.js with standard library JS (no external npm dependencies).
- **CLI Helper:** Use [scripts/caro.js](file:///home/vi-tran/repos/vibe-coded-apps/caro/scripts/caro.js) for all development tasks:
  - `node scripts/caro.js list` - View code sections, line numbers, and sizes.
  - `node scripts/caro.js view <section|query>` - View isolated sections or search code.
  - `node scripts/caro.js patch "<search>" "<replace>"` - Safe unique string replacement with auto-backup and syntax validation.
  - `node scripts/caro.js test` - Run all 26 unit tests directly in Node.js.
  - `node scripts/caro.js check` - Run comprehensive sanity checks (syntax, tag balance, i18n parity, default language, unit tests).
  - `node scripts/caro.js i18n check` / `list` / `add` - Inspect and maintain translation keys.
- **Verification Rule:** Always run `node scripts/caro.js check` after making edits to guarantee zero regression.
