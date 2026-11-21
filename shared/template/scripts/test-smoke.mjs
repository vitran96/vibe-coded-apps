// Smoke test for the built file. Replace with rule tests when the game has rules.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /<html lang="vi" data-theme="giay">/);
assert.match(html, /const APP_VERSION = '1\.0\.0';/);
console.log('smoke test passed');
