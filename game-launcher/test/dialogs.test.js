import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDomUi } from '../src/js/dialogs.js';

describe('Launcher update dialog (ota R10, R12, R15)', () => {
  let els, listeners, doc;
  const mk = () => ({
    textContent: '', children: [], style: {}, _html: '',
    classList: { _c: new Set(['hidden']), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, contains(c) { return this._c.has(c); }, toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); } },
    set innerHTML(v) { this._html = v; this.children = []; }, get innerHTML() { return this._html; },
    appendChild(c) { this.children.push(c); }
  });
  beforeEach(() => {
    els = Object.fromEntries(['ota-modal', 'ota-title', 'ota-text', 'ota-notes', 'ota-progress', 'ota-progress-fill', 'ota-progress-text', 'ota-actions'].map((id) => [id, mk()]));
    listeners = {};
    doc = {
      getElementById: (id) => els[id],
      createElement: () => ({ ...mk(), type: '', className: '', focused: false, listeners: {}, addEventListener(e, fn) { this.listeners[e] = fn; }, focus() { this.focused = true; } }),
      addEventListener: (e, fn) => { listeners[e] = fn; },
      removeEventListener: (e) => { delete listeners[e]; }
    };
  });
  const update = { version: '2.3.0', currentVersion: '2.2.0', body: 'Fixes' };

  test('R10 the question has three buttons, the first is focused, version and notes are shown, vi labels', async () => {
    const ui = createDomUi(() => 'vi', doc);
    const p = ui.ask(update);
    const btns = els['ota-actions'].children;
    assert.deepEqual(btns.map((b) => b.textContent), ['Cập nhật ngay', 'Để sau', 'Không hỏi nữa']);
    assert.equal(btns[0].focused, true);
    assert.match(els['ota-text'].textContent, /2\.3\.0/);
    assert.equal(els['ota-notes'].textContent, 'Fixes');
    assert.equal(els['ota-modal'].classList.contains('hidden'), false);
    btns[0].listeners.click();
    assert.equal(await p, 'now');
    assert.equal(els['ota-modal'].classList.contains('hidden'), true);
  });

  test('R15 Esc means Later and closes the dialog', async () => {
    const ui = createDomUi(() => 'en', doc);
    const p = ui.ask(update);
    assert.equal(els['ota-actions'].children[1].textContent, 'Later');
    listeners.keydown({ key: 'Escape' });
    assert.equal(await p, 'later');
    assert.equal(els['ota-modal'].classList.contains('hidden'), true);
    assert.equal(listeners.keydown, undefined, 'key handler removed');
  });

  test('R12 the restart question resolves true only on Restart now', async () => {
    const ui = createDomUi(() => 'vi', doc);
    let p = ui.askRestart();
    els['ota-actions'].children[0].listeners.click();
    assert.equal(await p, true);
    p = ui.askRestart();
    listeners.keydown({ key: 'Escape' });
    assert.equal(await p, false);
  });

  test('R14 the error dialog is plain words and has a close button; quiet progress shows nothing', async () => {
    const ui = createDomUi(() => 'vi', doc);
    ui.progress(10, true);
    assert.equal(els['ota-modal'].classList.contains('hidden'), true);
    const p = ui.error();
    assert.match(els['ota-text'].textContent, /Bản hiện tại vẫn dùng bình thường/);
    els['ota-actions'].children[0].listeners.click();
    await p;
    ui.progress(40);
    assert.match(els['ota-progress-text'].textContent, /40%/);
    assert.equal(els['ota-progress-fill'].style.width, '40%');
  });
});
