// Template app: copy the folder, then change APP_VERSION, STORAGE_PREFIX, the title and the game below.
const APP_VERSION = '1.0.0';
const STORAGE_PREFIX = 'app_';

const store = House.store(STORAGE_PREFIX);
const $ = (id) => document.getElementById(id);
const t = (key, params) => House.i18n.t(key, params);

// Stored objects carry a schema version `v`; anything else starts fresh.
let stats = store.get('stats');
if (stats?.v !== 1) stats = { v: 1, plays: 0 };
House.audio.sfx.on = store.get('sfx', true);

let msg = ['game.ready', {}]; // key + params, so the text can be re-translated on a language change

function showScreen(id) {
  $('start-screen').hidden = id !== 'start-screen';
  $('game-screen').hidden = id !== 'game-screen';
}

function render() {
  $('status').textContent = t(...msg);
  $('plays').textContent = t('game.plays', { n: stats.plays });
  $('app-version').textContent = t('settings.version', { v: APP_VERSION });
  $('sfx-on').checked = House.audio.sfx.on;
  const theme = document.documentElement.dataset.theme;
  for (const b of document.querySelectorAll('[data-theme-val]')) b.setAttribute('aria-pressed', String(b.dataset.themeVal === theme));
  for (const b of document.querySelectorAll('[data-lang-val]')) b.setAttribute('aria-pressed', String(b.dataset.langVal === House.i18n.lang));
}

function newGame() {
  stats = { v: 1, plays: stats.plays + 1 };
  store.set('stats', stats);
  House.audio.play('place');
  msg = ['game.started', { n: stats.plays }];
  render();
}

$('btn-play').onclick = () => { showScreen('game-screen'); msg = ['game.ready', {}]; render(); };
$('btn-back').onclick = () => showScreen('start-screen');
$('btn-new').onclick = newGame;
for (const id of ['btn-settings', 'btn-game-settings']) $(id).onclick = () => House.dialogs.open($('dialog-settings'));
$('btn-close-settings').onclick = () => House.dialogs.close($('dialog-settings'));

$('sfx-on').onchange = (e) => {
  House.audio.sfx.on = e.target.checked;
  store.set('sfx', House.audio.sfx.on);
};
for (const b of document.querySelectorAll('[data-theme-val]')) {
  b.onclick = () => { House.prefs.save({ theme: b.dataset.themeVal }); House.applyTheme(b.dataset.themeVal); render(); };
}
for (const b of document.querySelectorAll('[data-lang-val]')) {
  b.onclick = () => { House.prefs.save({ lang: b.dataset.langVal }); House.i18n.setLang(b.dataset.langVal); };
}

// Only this app's keys are removed; house:prefs (theme, language) stays.
$('btn-clear').onclick = () => {
  if (!confirm(t('settings.clearConfirm'))) return;
  store.clearOwn();
  stats = { v: 1, plays: 0 };
  House.audio.sfx.on = true;
  msg = ['settings.cleared', {}];
  render();
};

addEventListener('housethemechange', render);
addEventListener('houselangchange', render);
addEventListener('housestoragefail', () => House.announce(t('storage.failed')));

// Start: saved theme and language (default light, Vietnamese), then the translated text.
const prefs = House.prefs.load();
House.applyTheme(prefs.theme);
House.i18n.setLang(prefs.lang);
