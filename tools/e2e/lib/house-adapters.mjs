// Per-app recipes for the generic house checks (B1-B13). Each app builds its Settings/shortcuts differently;
// this file is the only place that knows those selectors. A missing entry fails on purpose.

// Settings dialog id and the key-to-dialog map come from each app's markup. `?` for chinese-chess opens a screen.
export const HOUSE = {
  caro: {
    prefix: 'caro_',
    async openSettings(p) {
      if (await p.locator('#dlg-settings').isVisible()) return;
      if (!(await p.locator('#dlg-menu').isVisible())) await p.locator('#btn-menu').click();
      await p.locator('#mn-settings').click();
    },
    pickTheme: (p, id) => p.locator(`input[name="st_theme"][value="${id}"]`).check({ force: true }),
    // Language changes re-render the sheet, so this must run before pickTheme-style edits are needed again.
    pickLang: (p, l) => p.locator(`input[name="st_lang"][value="${l}"]`).check({ force: true }),
    commit: (p) => p.locator('#form-settings button[type="submit"]').click(),
    async resetData(p) {
      await p.locator('#btn-reset-settings').click();
      await p.locator('#cf-yes').click();
    },
    async toggles(p) {
      await this.openSettings(p);
      const r = {
        music: await p.locator('input[name="musicOn"]').isChecked(),
        sfx: await p.locator('input[name="sfxOn"]').isChecked(),
        timerOff: !(await p.locator('input[name="st_timerEnabled"]').isChecked()),
      };
      await p.keyboard.press('Escape');
      return r;
    },
    // Cursor starts in the centre; Enter places a stone (input.js).
    keyMove: async (p) => { await p.keyboard.press('Enter'); },
    opener: '#btn-menu', // a visible button that opens a sheet (B8 focus return)
    shortcuts: { n: '#dlg-new-game', h: '#dlg-history', s: '#dlg-settings', '?': '#dlg-help' },
    sfxBox: 'input[name="sfxOn"]',
    audioLive: '#dlg-settings',
  },
  chess: {
    prefix: 'covua_',
    async openSettings(p) {
      if (await p.locator('#dialog-settings').isVisible()) return;
      // The start screen stays visible (but covered) under the game screen, so pick by the active screen.
      if (await p.locator('#game-screen').isVisible()) {
        const box = await p.locator('#btn-desktop-settings').boundingBox(); // off-screen on phones
        const inView = box && box.x >= 0 && box.x + box.width <= p.viewportSize().width;
        if (inView) return p.locator('#btn-desktop-settings').click();
        return p.keyboard.press('s');
      }
      await p.locator('#btn-start-settings').click();
    },
    pickTheme: (p, id) => p.locator(`#seg-theme button[data-val="${id}"]`).click(),
    pickLang: (p, l) => p.locator(`#seg-lang button[data-val="${l}"]`).click(),
    commit: (p) => p.locator('#btn-close-settings').click(),
    async resetData(p) {
      p.once('dialog', (d) => d.accept());
      await p.locator('#btn-reset-data').click();
    },
    async toggles(p) {
      await this.openSettings(p);
      const r = {
        music: await p.locator('#chk-music').isChecked(),
        sfx: await p.locator('#chk-sfx').isChecked(),
        timerOff: await p.locator('#seg-settings-timer button[data-val="off"]').evaluate((b) => b.classList.contains('active')),
      };
      await p.keyboard.press('Escape');
      return r;
    },
    // Same recipe as boot.spec A5: e2 to e4 with the board cursor.
    keyMove: async (p) => {
      await p.locator('#chess-canvas').focus();
      for (const [key, n] of [['ArrowRight', 4], ['ArrowDown', 6], ['Enter', 1], ['ArrowUp', 2], ['Enter', 1]]) {
        for (let i = 0; i < n; i++) await p.keyboard.press(key);
      }
    },
    opener: '#btn-history',
    shortcuts: { n: '#dialog-new-game', h: '#dialog-history', s: '#dialog-settings', '?': '#dialog-help' },
    sfxBox: '#chk-sfx',
  },
  'chinese-chess': {
    prefix: 'cotuong_',
    async openSettings(p) {
      if (await p.locator('#dialog-settings').isVisible()) return;
      if (await p.locator('#btn-start-settings').isVisible()) await p.locator('#btn-start-settings').click();
      else await p.keyboard.press('s');
    },
    pickTheme: (p, id) => p.locator('#settings-theme-select').selectOption(id),
    pickLang: (p, l) => p.locator('#settings-lang-select').selectOption(l),
    commit: (p) => p.locator('#dialog-settings button.btn-icon').click(),
    async resetData(p) {
      await p.locator('#btn-reset-defaults').click();
    },
    async toggles(p) {
      await this.openSettings(p);
      const r = {
        music: await p.locator('#settings-music-toggle').isChecked(),
        sfx: await p.locator('#settings-sfx-toggle').isChecked(),
      };
      await p.locator('#dialog-settings button.btn-icon').click();
      await p.keyboard.press('n'); // timer lives in the new-game sheet
      r.timerOff = await p.locator('#dialog-newgame .chip-timer-mode[data-val="off"]').evaluate((b) => b.classList.contains('selected'));
      await p.locator('#dialog-newgame button.btn-icon').click();
      return r;
    },
    opener: '#btn-start-history',
    shortcuts: { n: '#dialog-newgame', h: '#dialog-history', s: '#dialog-settings', '?': '#screen-rules.active' },
    // Red soldier a3 to a4 with the board cursor (cursor starts on a9; Red at the bottom, rows 0-9 upward).
    keyMove: async (p) => {
      await p.locator('#canvas-3d').focus();
      for (const [key, n] of [['ArrowDown', 6], ['Enter', 1], ['ArrowUp', 1], ['Enter', 1]]) {
        for (let i = 0; i < n; i++) await p.keyboard.press(key);
      }
    },
    sfxBox: '#settings-sfx-toggle',
  },
};

export const houseOf = (app) => {
  const h = HOUSE[app];
  if (!h) throw new Error(`no HOUSE recipe for ${app}: add one in tools/e2e/lib/house-adapters.mjs`);
  return h;
};
