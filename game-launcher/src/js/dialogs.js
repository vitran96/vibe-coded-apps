import { t } from './i18n.js';

// The launcher-update dialogs (game-launcher-ota R10, R12, R14, R15): one modal, buttons made on demand.
// Esc picks the action marked `cancel` ("Later"); the first button gets the focus.
export function createDomUi(getLang, doc = globalThis.document) {
  const el = (id) => doc.getElementById(id);
  const lang = () => getLang();
  let keyHandler = null;

  function close() {
    el('ota-modal')?.classList.add('hidden');
    if (keyHandler) { doc.removeEventListener?.('keydown', keyHandler); keyHandler = null; }
  }

  function show({ title, text, notes = '', actions = [], percent = null }) {
    el('ota-title').textContent = title;
    el('ota-text').textContent = text;
    const notesEl = el('ota-notes');
    notesEl.textContent = notes;
    notesEl.classList.toggle('hidden', !notes);
    const prog = el('ota-progress');
    prog.classList.toggle('hidden', percent === null);
    if (percent !== null) {
      el('ota-progress-fill').style.width = `${percent}%`;
      el('ota-progress-text').textContent = t('ota_downloading', lang(), { percent });
    }
    const box = el('ota-actions');
    box.innerHTML = '';
    el('ota-modal').classList.remove('hidden');
    return new Promise((resolve) => {
      const done = (id) => { close(); resolve(id); };
      actions.forEach((a, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = a.primary ? 'btn-primary' : a.cancel ? 'btn-text' : 'btn-secondary';
        b.textContent = a.label;
        b.addEventListener('click', () => done(a.id));
        box.appendChild(b);
        if (i === 0) b.focus?.();
      });
      const cancel = actions.find((a) => a.cancel);
      if (cancel) {
        keyHandler = (e) => { if (e.key === 'Escape') done(cancel.id); };
        doc.addEventListener?.('keydown', keyHandler);
      }
      if (!actions.length) resolve(null);
    });
  }

  return {
    async ask(update) {
      return show({
        title: t('ota_title', lang()),
        text: t('ota_text', lang(), { version: update.version, current: update.currentVersion || '' }),
        notes: update.body || '',
        actions: [
          { id: 'now', label: t('ota_now', lang()), primary: true },
          { id: 'later', label: t('ota_later', lang()), cancel: true },
          { id: 'never', label: t('ota_never', lang()) }
        ]
      });
    },
    progress(percent, quiet = false) {
      if (quiet) return;
      show({ title: t('ota_title', lang()), text: '', percent });
    },
    async askRestart() {
      const id = await show({
        title: t('ota_restart_title', lang()),
        text: t('ota_restart_text', lang()),
        actions: [
          { id: 'now', label: t('ota_restart_now', lang()), primary: true },
          { id: 'later', label: t('ota_later', lang()), cancel: true }
        ]
      });
      return id === 'now';
    },
    error() {
      return show({
        title: t('ota_title', lang()),
        text: t('ota_failed', lang()),
        actions: [{ id: 'close', label: t('btn_close', lang()), primary: true, cancel: true }]
      });
    },
    info(text) {
      return show({ title: t('ota_title', lang()), text, actions: [{ id: 'close', label: t('btn_close', lang()), primary: true, cancel: true }] });
    }
  };
}
