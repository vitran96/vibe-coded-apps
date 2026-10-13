import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { t, applyI18n, TRANSLATIONS } from '../src/js/i18n.js';

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
});
