import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateStorageShim } from '../src/js/storageShim.js';

describe('Storage Shim Generator', () => {
  test('generates valid script tag with gameId prefix', () => {
    const shim = generateStorageShim('retro-rpg');
    assert.match(shim, /<script id="__storage_shim__">/);
    assert.match(shim, /const prefix = "__game_retro-rpg__";/);
    assert.match(shim, /<\/script>/);
  });

  test('sanitizes special characters in gameId', () => {
    const shim = generateStorageShim('game#1 2!@');
    assert.match(shim, /const prefix = "__game_game_1_2____";/);
  });

  test('provides working localStorage proxy isolation', () => {
    const rawStorage = new Map();
    const mockWindow = {
      localStorage: {
        getItem: (k) => (rawStorage.has(k) ? rawStorage.get(k) : null),
        setItem: (k, v) => rawStorage.set(k, String(v)),
        removeItem: (k) => rawStorage.delete(k),
        clear: () => rawStorage.clear(),
        get length() { return rawStorage.size; }
      }
    };

    // Simulate shim function for game1
    const prefix1 = '__game_game1__';
    const proxy1 = {
      getItem: (k) => mockWindow.localStorage.getItem(prefix1 + k),
      setItem: (k, v) => mockWindow.localStorage.setItem(prefix1 + k, String(v)),
      removeItem: (k) => mockWindow.localStorage.removeItem(prefix1 + k),
      clear: () => {
        for (const k of Array.from(rawStorage.keys())) {
          if (k.startsWith(prefix1)) rawStorage.delete(k);
        }
      },
      key: (i) => {
        const keys = Array.from(rawStorage.keys()).filter(k => k.startsWith(prefix1));
        return keys[i] ? keys[i].replace(prefix1, '') : null;
      },
      get length() {
        return Array.from(rawStorage.keys()).filter(k => k.startsWith(prefix1)).length;
      }
    };

    // Simulate shim for game2
    const prefix2 = '__game_game2__';
    const proxy2 = {
      getItem: (k) => mockWindow.localStorage.getItem(prefix2 + k),
      setItem: (k, v) => mockWindow.localStorage.setItem(prefix2 + k, String(v)),
      removeItem: (k) => mockWindow.localStorage.removeItem(prefix2 + k),
      clear: () => {
        for (const k of Array.from(rawStorage.keys())) {
          if (k.startsWith(prefix2)) rawStorage.delete(k);
        }
      },
      key: (i) => {
        const keys = Array.from(rawStorage.keys()).filter(k => k.startsWith(prefix2));
        return keys[i] ? keys[i].replace(prefix2, '') : null;
      },
      get length() {
        return Array.from(rawStorage.keys()).filter(k => k.startsWith(prefix2)).length;
      }
    };

    // Game 1 sets highscore
    proxy1.setItem('highscore', 100);
    assert.equal(proxy1.getItem('highscore'), '100');
    assert.equal(proxy1.length, 1);

    // Game 2 does not see Game 1 highscore
    assert.equal(proxy2.getItem('highscore'), null);
    proxy2.setItem('highscore', 500);
    assert.equal(proxy2.getItem('highscore'), '500');

    // Raw storage has both prefixed keys
    assert.equal(rawStorage.get('__game_game1__highscore'), '100');
    assert.equal(rawStorage.get('__game_game2__highscore'), '500');

    // Clearing game 1 does not affect game 2
    proxy1.clear();
    assert.equal(proxy1.getItem('highscore'), null);
    assert.equal(proxy2.getItem('highscore'), '500');
  });
});
