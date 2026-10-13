import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promptUpdatesIfAvailable } from '../src/js/updateModal.js';

describe('Update Modal Flow', () => {
  let modal;
  let list;
  let chkDontAsk;
  let btnUpdateSelected;
  let btnUpdateAll;
  let btnSkip;
  let elementsMap;

  function createMockElement(id = '', tag = 'div') {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      children: [],
      appendChild(child) {
        this.children.push(child);
      },
      querySelectorAll(selector) {
        const found = [];
        function walk(node) {
          if (selector === '.update-select-item:checked') {
            if (node.classList?.contains('update-select-item') && node.checked) {
              found.push(node);
            }
          }
          if (node.children) {
            for (const c of node.children) walk(c);
          }
        }
        walk(this);
        return found;
      },
      get innerHTML() { return ''; },
      set innerHTML(val) {
        this.children = [];
      }
    };
    return el;
  }

  beforeEach(() => {
    modal = createMockElement('update-modal');
    modal.classList.add('hidden');
    list = createMockElement('update-modal-list');
    chkDontAsk = { ...createMockElement('chk-dont-ask', 'input'), type: 'checkbox', checked: false };
    btnUpdateSelected = createMockElement('btn-update-selected', 'button');
    btnUpdateAll = createMockElement('btn-update-all', 'button');
    btnSkip = createMockElement('btn-update-skip', 'button');

    elementsMap = new Map([
      ['update-modal', modal],
      ['update-modal-list', list],
      ['chk-dont-ask', chkDontAsk],
      ['btn-update-selected', btnUpdateSelected],
      ['btn-update-all', btnUpdateAll],
      ['btn-update-skip', btnSkip]
    ]);

    globalThis.document = {
      getElementById: (id) => elementsMap.get(id) || null,
      createElement: (tag) => {
        const el = createMockElement('', tag);
        return el;
      }
    };
  });

  const pendingGames = [
    { id: 'game-1', name: 'Game One', version: '2.0.0', installedVersion: '1.0.0', url: 'https://example.com/1.html' },
    { id: 'game-2', name: 'Game Two', version: '3.0.0', installedVersion: '2.0.0', url: 'https://example.com/2.html' }
  ];

  test('promptUpdatesIfAvailable displays modal and populates items', () => {
    promptUpdatesIfAvailable(pendingGames);

    assert.equal(modal.classList.contains('hidden'), false);
    assert.equal(list.children.length, 2);
  });

  test('btnUpdateAll triggers updates for all pending games and closes modal', async () => {
    const updatedGames = [];
    const mockOps = {
      fetch: async () => ({
        ok: true,
        headers: { get: () => '0' },
        arrayBuffer: async () => new Uint8Array()
      }),
      appDataDir: async () => '/data',
      join: async (...p) => p.join('/'),
      exists: async () => true,
      mkdir: async () => {},
      writeTextFile: async (path, content) => {},
      readTextFile: async () => JSON.stringify({ settings: {}, games: {} })
    };

    let completed = false;
    promptUpdatesIfAvailable(pendingGames, () => {
      completed = true;
    }, mockOps);

    // Click Update All
    await btnUpdateAll.onclick();

    assert.equal(modal.classList.contains('hidden'), true);
    assert.equal(completed, true);
  });

  test('btnUpdateSelected updates only checked games', async () => {
    let completed = false;
    const mockOps = {
      fetch: async () => ({
        ok: true,
        headers: { get: () => '0' },
        arrayBuffer: async () => new Uint8Array()
      }),
      appDataDir: async () => '/data',
      join: async (...p) => p.join('/'),
      exists: async () => true,
      mkdir: async () => {},
      writeTextFile: async () => {},
      readTextFile: async () => JSON.stringify({ settings: {}, games: {} })
    };

    promptUpdatesIfAvailable(pendingGames, () => {
      completed = true;
    }, mockOps);

    // Mock that only game-1 checkbox is checked in DOM
    list.querySelectorAll = () => [{ value: 'game-1' }];

    await btnUpdateSelected.onclick();

    assert.equal(modal.classList.contains('hidden'), true);
    assert.equal(completed, true);
  });

  test('btnSkip closes modal without updating and saves dontAsk choice', async () => {
    let savedManifest = null;
    const mockOps = {
      appDataDir: async () => '/data',
      join: async (...p) => p.join('/'),
      exists: async () => true,
      writeTextFile: async (path, content) => {
        savedManifest = JSON.parse(content);
      },
      readTextFile: async () => JSON.stringify({ settings: { skipUpdatePrompt: false }, games: {} })
    };

    chkDontAsk.checked = true;
    let completed = false;

    promptUpdatesIfAvailable(pendingGames, () => {
      completed = true;
    }, mockOps);

    await btnSkip.onclick();

    assert.equal(modal.classList.contains('hidden'), true);
    assert.equal(completed, true);
    assert.ok(savedManifest);
    assert.equal(savedManifest.settings.skipUpdatePrompt, true);
  });
});
