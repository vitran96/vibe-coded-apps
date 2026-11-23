import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promptUpdatesIfAvailable } from '../src/js/updateModal.js';
import { getManifest } from '../src/js/gameManager.js';
import { createMockOps, createFetch } from './helpers.js';

describe('Update Modal Flow', () => {
  let els;

  function createMockElement(id = '', tag = 'div') {
    return {
      id,
      tagName: tag.toUpperCase(),
      textContent: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      children: [],
      appendChild(child) { this.children.push(child); },
      querySelectorAll(selector) {
        const found = [];
        const walk = (node) => {
          if (selector === '.update-select-item:checked' && node.classList?.contains('update-select-item') && node.checked) found.push(node);
          for (const c of node.children || []) walk(c);
        };
        walk(this);
        return found;
      },
      get innerHTML() { return ''; },
      set innerHTML(_v) { this.children = []; }
    };
  }

  beforeEach(() => {
    els = {};
    for (const id of ['update-modal', 'update-modal-list', 'update-modal-choose', 'update-modal-progress', 'update-modal-result',
      'btn-update-selected', 'btn-update-all', 'btn-update-skip', 'btn-update-retry', 'btn-update-close']) els[id] = createMockElement(id, id.startsWith('btn') ? 'button' : 'div');
    els['update-modal'].classList.add('hidden');
    els['chk-dont-ask'] = { ...createMockElement('chk-dont-ask', 'input'), type: 'checkbox', checked: false };
    globalThis.document = {
      getElementById: (id) => els[id] || null,
      createElement: (tag) => createMockElement('', tag)
    };
  });

  const game = (id, extra = {}) => ({ id, name: id, version: '2.0.0', installedVersion: '1.0.0', type: 'html', url: `https://example.com/${id}.html`, ...extra });
  const pendingGames = [game('game-1'), game('game-2')];
  const page = '<html><body>game</body></html>';

  test('displays the modal and populates items', () => {
    promptUpdatesIfAvailable(pendingGames);
    assert.equal(els['update-modal'].classList.contains('hidden'), false);
    assert.equal(els['update-modal-list'].children.length, 2);
    assert.equal(els['btn-update-retry'].classList.contains('hidden'), true);
  });

  test('Update All installs every game and closes the dialog by itself', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({ 'https://example.com/game-1.html': page, 'https://example.com/game-2.html': page });
    let completed = false;
    promptUpdatesIfAvailable(pendingGames, () => { completed = true; }, ops);
    await els['btn-update-all'].onclick();
    assert.equal(els['update-modal'].classList.contains('hidden'), true);
    assert.equal(completed, true);
    const m = await getManifest(ops);
    assert.equal(m.games['game-1'].version, '2.0.0');
    assert.equal(m.games['game-2'].version, '2.0.0');
  });

  test('Update Selected updates only the checked game', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({ 'https://example.com/game-1.html': page });
    promptUpdatesIfAvailable(pendingGames, () => {}, ops);
    els['update-modal-list'].querySelectorAll = () => [{ value: 'game-1' }];
    await els['btn-update-selected'].onclick();
    const m = await getManifest(ops);
    assert.ok(m.games['game-1']);
    assert.ok(!m.games['game-2']);
  });

  // R16
  test('R16 one of two fails: the result lists both, shows a retry, and retry updates only the failed one', async () => {
    const { ops } = createMockOps();
    ops.fetch = createFetch({ 'https://example.com/game-1.html': page }); // game-2 answers 404
    let completed = false;
    promptUpdatesIfAvailable(pendingGames, () => { completed = true; }, ops);
    await els['btn-update-all'].onclick();

    assert.equal(els['update-modal'].classList.contains('hidden'), false, 'stays open to show the result');
    assert.equal(completed, false);
    const text = els['update-modal-result'].children.map((c) => c.textContent).join('\n');
    assert.match(text, /game-1/);
    assert.match(text, /game-2/);
    assert.match(text, /kiểm tra kết nối mạng/, 'plain Vietnamese message, no HTTP code');
    assert.doesNotMatch(text, /HTTP|https?:/);
    assert.equal(els['btn-update-retry'].classList.contains('hidden'), false);
    assert.equal(els['btn-update-close'].classList.contains('hidden'), false);

    ops.fetch = createFetch({ 'https://example.com/game-2.html': page });
    await els['btn-update-retry'].onclick();
    assert.equal(els['update-modal'].classList.contains('hidden'), true);
    assert.equal(completed, true);
    assert.equal((await getManifest(ops)).games['game-2'].version, '2.0.0');
  });

  test('R16 progress text names the game being updated', async () => {
    const { ops } = createMockOps();
    const seen = [];
    ops.fetch = createFetch({ 'https://example.com/game-1.html': page, 'https://example.com/game-2.html': page });
    Object.defineProperty(els['update-modal-progress'], 'textContent', { set(v) { seen.push(v); }, get() { return seen.at(-1) || ''; } });
    promptUpdatesIfAvailable(pendingGames, () => {}, ops);
    await els['btn-update-all'].onclick();
    assert.ok(seen.some((s) => /game-1.*1\/2/.test(s)));
    assert.ok(seen.some((s) => /game-2.*2\/2/.test(s)));
  });

  test('Skip closes the modal without updating and saves the dont-ask choice', async () => {
    const { ops } = createMockOps();
    els['chk-dont-ask'].checked = true;
    let completed = false;
    promptUpdatesIfAvailable(pendingGames, () => { completed = true; }, ops);
    await els['btn-update-skip'].onclick();
    assert.equal(els['update-modal'].classList.contains('hidden'), true);
    assert.equal(completed, true);
    assert.equal((await getManifest(ops)).settings.skipUpdatePrompt, true);
  });
});
