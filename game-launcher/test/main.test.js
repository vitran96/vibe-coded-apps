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

const { showLibrary, showSettings, exitGame } = await import('../src/js/main.js');

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

    elementsMap = new Map([
      ['library-view', libraryView],
      ['settings-view', settingsView],
      ['player-view', playerView],
      ['game-frame', gameFrame],
      ['btn-library', btnLibrary],
      ['btn-settings', btnSettings],
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
  });

  test('exitGame clears iframe contents and hides player view', () => {
    gameFrame.src = 'asset://localhost/game/index.html';
    gameFrame.srcdoc = '<script>...</script>';
    playerView.classList.remove('hidden');

    exitGame();

    assert.equal(gameFrame.srcdoc, '');
    assert.equal(gameFrame.attributes.has('src'), false);
    assert.equal(playerView.classList.contains('hidden'), true);
  });
});
