import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { t, applyI18n, errorText, TRANSLATIONS } from '../src/js/i18n.js';

describe('i18n Translations & Helpers', () => {
  test('translates keys for vi and en', () => {
    assert.equal(t('brand_title', 'vi'), 'Trò chơi');
    assert.equal(t('brand_title', 'en'), 'Games');
  });

  test('interpolates parameters', () => {
    assert.equal(t('downloading', 'vi', { percent: 45 }), 'Đang tải 45%');
    assert.equal(t('downloading', 'en', { percent: 45 }), 'Downloading 45%');
    assert.equal(t('installed_status', 'vi', { installed: '1.0', target: '2.0' }), 'Đã cài: v1.0 | Bản mới: v2.0');
  });

  test('falls back to vi for unknown lang or key', () => {
    assert.equal(t('brand_title', 'fr'), 'Trò chơi');
    assert.equal(t('nonexistent_key', 'vi'), 'nonexistent_key');
  });

  test('applyI18n updates DOM elements', () => {
    const elementsWithI18n = [
      { getAttribute: (k) => k === 'data-i18n' ? 'nav_library' : null, textContent: '' }
    ];
    const elementsWithTitle = [
      { getAttribute: (k) => k === 'data-i18n-title' ? 'nav_library_title' : null, title: '' }
    ];

    globalThis.document = {
      documentElement: { lang: '' },
      querySelectorAll: (sel) => {
        if (sel === '[data-i18n]') return elementsWithI18n;
        if (sel === '[data-i18n-title]') return elementsWithTitle;
        return [];
      }
    };

    applyI18n('vi');
    assert.equal(document.documentElement.lang, 'vi');
    assert.equal(elementsWithI18n[0].textContent, 'Thư viện');
    assert.equal(elementsWithTitle[0].title, 'Xem thư viện trò chơi');

    applyI18n('en');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(elementsWithI18n[0].textContent, 'Library');
    assert.equal(elementsWithTitle[0].title, 'View Game Library');
  });

  // hardening R17, ota R15
  test('R17 vi and en have the same keys; every key used in index.html exists', () => {
    const vi = Object.keys(TRANSLATIONS.vi), en = Object.keys(TRANSLATIONS.en);
    assert.deepEqual(vi.filter((k) => !en.includes(k)), []);
    assert.deepEqual(en.filter((k) => !vi.includes(k)), []);
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    const used = [...html.matchAll(/data-i18n(?:-title)?="([\w.-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(used.filter((k) => !vi.includes(k)), []);
  });

  test('R17 error messages are plain words: no codes, URLs or English-only text in vi', () => {
    for (const key of Object.keys(TRANSLATIONS.vi).filter((k) => k.startsWith('err_'))) {
      assert.doesNotMatch(TRANSLATIONS.vi[key], /HTTP|https?:|\b[45]\d\d\b|Error|failed/i, key);
      assert.doesNotMatch(TRANSLATIONS.en[key], /HTTP|https?:|\b[45]\d\d\b/i, key);
    }
    assert.match(errorText({ key: 'err_network' }, 'vi'), /kết nối mạng/);
    assert.match(errorText({ key: 'err_damaged' }, 'en'), /old version still works/);
    assert.match(errorText({ key: 'err_missing' }, 'vi'), /Tải lại/);
    assert.equal(errorText(new Error('HTTP 404 when fetching https://x'), 'vi'), TRANSLATIONS.vi.err_generic);
    assert.equal(errorText(undefined, 'en'), TRANSLATIONS.en.err_generic);
  });
});
