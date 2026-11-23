import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up window and Tauri IPC mock for main UI tests
globalThis.window = globalThis;
const { mockIPC } = await import('@tauri-apps/api/mocks');
mockIPC((cmd, args) => {
  if (cmd.includes('resolve_directory')) return '/mock_appdata';
  if (cmd.includes('join')) return args?.paths?.join('/') || '/mock/path';
  if (cmd.includes('exists')) return false;
  if (cmd.includes('mkdir')) return null;
  return null;
});

const { showLibrary, showSettings, exitGame, renderLibrary, renderSettings, setCatalog } = await import('../src/js/main.js');
const { setLauncherVersion } = await import('../src/js/gameManager.js');
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../src/js/i18n.js';

describe('Main Application Navigation & Elder Accessibility', () => {
  let libraryView;
  let settingsView;
  let playerView;
  let gameFrame;
  let btnLibrary;
  let btnSettings;
  let elementsMap;

  function createMockElement(id = '', tag = 'div') {
    return {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      attributes: new Map(),
      setAttribute(k, v) { this.attributes.set(k, v); },
      removeAttribute(k) { this.attributes.delete(k); },
      getAttribute(k) { return this.attributes.get(k); },
      children: [],
      appendChild(child) { this.children.push(child); },
      querySelectorAll() { return []; },
      src: '',
      srcdoc: '',
      innerHTML: ''
    };
  }

  beforeEach(() => {
    libraryView = createMockElement('library-view');
    settingsView = createMockElement('settings-view');
    playerView = createMockElement('player-view');
    gameFrame = createMockElement('game-frame', 'iframe');
    btnLibrary = createMockElement('btn-library', 'button');
    btnSettings = createMockElement('btn-settings', 'button');
    const btnRemoveAll = createMockElement('btn-remove-all', 'button');
    const selectLanguage = createMockElement('select-language', 'select');

    elementsMap = new Map([
      ['library-view', libraryView],
      ['settings-view', settingsView],
      ['player-view', playerView],
      ['game-frame', gameFrame],
      ['btn-library', btnLibrary],
      ['btn-settings', btnSettings],
      ['btn-remove-all', btnRemoveAll],
      ['select-language', selectLanguage],
      ['game-list', createMockElement('game-list')],
      ['settings-game-list', createMockElement('settings-game-list')]
    ]);

    globalThis.document = {
      getElementById: (id) => elementsMap.get(id) || null,
      createElement: (tag) => createMockElement('', tag)
    };
  });

  test('showLibrary switches views and sets active nav button', () => {
    settingsView.classList.remove('hidden');
    libraryView.classList.add('hidden');

    showLibrary();

    assert.equal(settingsView.classList.contains('hidden'), true);
    assert.equal(libraryView.classList.contains('hidden'), false);
    assert.equal(btnLibrary.classList.contains('active'), true);
    assert.equal(btnSettings.classList.contains('active'), false);
  });

  test('showSettings switches views and sets active nav button', async () => {
    libraryView.classList.remove('hidden');
    settingsView.classList.add('hidden');

    await showSettings();

    assert.equal(libraryView.classList.contains('hidden'), true);
    assert.equal(settingsView.classList.contains('hidden'), false);
    assert.equal(btnSettings.classList.contains('active'), true);
    assert.equal(btnLibrary.classList.contains('active'), false);
    assert.equal(elementsMap.get('select-language').value, 'vi');
    assert.equal(elementsMap.get('btn-remove-all').disabled, true);
  });

  test('exitGame clears iframe contents, hides player view, and restores library view', () => {
    gameFrame.src = 'asset://localhost/game/index.html';
    gameFrame.srcdoc = '<script>...</script>';
    playerView.classList.remove('hidden');
    libraryView.classList.add('hidden');
    settingsView.classList.add('hidden');

    exitGame();

    assert.equal(gameFrame.srcdoc, '');
    assert.equal(gameFrame.attributes.has('src'), false);
    assert.equal(playerView.classList.contains('hidden'), true);
    assert.equal(libraryView.classList.contains('hidden'), false);
  });
});

// A DOM double rich enough for renderLibrary / renderSettings: innerHTML is kept, querySelector finds what the HTML names.
function richElement() {
  const el = {
    _html: '', children: [], buttons: {},
    classList: { _c: new Set(), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, contains(c) { return this._c.has(c); } },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    appendChild(c) { this.children.push(c); },
    addEventListener() {},
    querySelector(sel) {
      const cls = sel.replace('.', '');
      if (!el._html.includes(cls)) return null;
      return (el.buttons[cls] ||= { disabled: false, textContent: '', classList: el.classList, addEventListener() {}, onclick: null });
    }
  };
  return el;
}

describe('Library and Settings screens (hardening R10, R15, ota R17)', () => {
  let lists;
  let alerts;
  beforeEach(() => {
    lists = { 'game-list': richElement(), 'settings-game-list': richElement() };
    alerts = [];
    globalThis.alert = (m) => alerts.push(m);
    globalThis.confirm = () => true;
    globalThis.document = { getElementById: (id) => lists[id] || null, createElement: () => richElement() };
    setLauncherVersion(null);
  });

  test('R10 the type pill follows the type: HTML, ZIP, FILES (and a .zip URL without type is ZIP)', async () => {
    setCatalog([
      { id: 'a', name: 'A', version: '1', type: 'html', url: 'https://x.test/a' },
      { id: 'b', name: 'B', version: '1', type: 'zip', url: 'https://x.test/b.zip' },
      { id: 'c', name: 'C', version: '1', type: 'files', url: 'https://x.test/c' },
      { id: 'd', name: 'D', version: '1', url: 'https://x.test/d.zip' }
    ]);
    await renderLibrary();
    const pills = lists['game-list'].children.map((c) => c.innerHTML.match(/type-pill">(\w+)</)[1]);
    assert.deepEqual(pills, ['HTML', 'ZIP', 'FILES', 'ZIP']);
  });

  test('ota R17 a game outside the launcher range shows its plain message, and max-range games cannot be started', async () => {
    setLauncherVersion('2.2.0');
    setCatalog([
      { id: 'old', name: 'Old', version: '1', type: 'html', url: 'https://x.test/o', minLauncher: '2.3.0' },
      { id: 'new', name: 'New', version: '1', type: 'html', url: 'https://x.test/n', maxLauncher: '2.1.0' },
      { id: 'free', name: 'Free', version: '1', type: 'html', url: 'https://x.test/f', minLauncher: -1, maxLauncher: null }
    ]);
    await renderLibrary();
    const [oldCard, newCard, freeCard] = lists['game-list'].children.map((c) => c.innerHTML);
    assert.match(oldCard, new RegExp(TRANSLATIONS.vi.range_old));
    assert.match(oldCard, new RegExp(TRANSLATIONS.vi.btn_update_launcher));
    assert.match(newCard, new RegExp(TRANSLATIONS.vi.range_new));
    assert.match(newCard, /action-btn[^>]*disabled/);
    assert.doesNotMatch(freeCard, /card-note/);
  });

  test('R15 a failing Download in Settings shows the plain message and the list is drawn again', async () => {
    setCatalog([{ id: 'g', name: 'G', version: '1.0.0', type: 'html', url: 'https://x.test/g' }]);
    await renderSettings();
    const row = lists['settings-game-list'].children[0];
    const btn = row.querySelector('.btn-predownload');
    assert.ok(btn.onclick, 'download button is wired');
    const drawnBefore = lists['settings-game-list'].children.length;
    await btn.onclick();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(alerts.length, 1);
    assert.doesNotMatch(alerts[0], /HTTP|https?:|Error/);
    assert.ok([TRANSLATIONS.vi.err_network, TRANSLATIONS.vi.err_generic].includes(alerts[0]), alerts[0]);
    assert.equal(drawnBefore, 1);
    assert.notEqual(lists['settings-game-list'].children[0], row, 'a fresh row replaced the one stuck on "downloading"');
  });

  test('ota R9/R16 Settings shows the update mode, the running launcher version and the last check', async () => {
    const els = { 'select-update-mode': { value: '' }, 'about-version': { textContent: '' }, 'about-last-check': { textContent: '' } };
    const real = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) => els[id] || real(id);
    setLauncherVersion('2.3.0');
    setCatalog([]);
    await renderSettings();
    assert.equal(els['select-update-mode'].value, 'ask');
    assert.equal(els['about-version'].textContent, '2.3.0');
    assert.equal(els['about-last-check'].textContent, TRANSLATIONS.vi.never_checked);
  });

  test('R8 Redownload does not remove the game before installing', () => {
    const src = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /btn-redownload[^\n]*\n?[^\n]*removeGame/);
    assert.match(src, /wire\('\.btn-redownload', 'btn_redownloading', \(\) => installOrUpdateGame\(game\)\)/);
  });
});
