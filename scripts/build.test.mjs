// node --test scripts/build.test.mjs — self-check for the offline / sub-route detector in build.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findProblems } from './build.mjs';

test('flags CDN scripts, styles, import maps and fonts', () => {
  const html = `<script src="https://cdn.jsdelivr.net/npm/tone@15.0.4/build/Tone.js"></script>
<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}</script>
<style>@font-face{src:url(//example.com/a.woff2)}</style>`;
  assert.equal(findProblems(html).length, 4);
});

test('flags root-absolute paths', () => {
  const html = `<img src="/logo.png"><script>navigator.serviceWorker.register('/sw.js'); const m = { start_url: '/' };</script>`;
  assert.equal(findProblems(html).length, 3);
});

test('allows relative paths, data URLs, anchors, hyperlinks and SVG namespace', () => {
  const html = `<script src="./main.js"></script><img src="data:image/png;base64,AA=="><a href="#rules">x</a>
<a href="https://github.com/x/y">source</a><svg xmlns="http://www.w3.org/2000/svg"></svg>
<script>navigator.serviceWorker.register('./sw.js', { scope: './' })</script>`;
  assert.deepEqual(findProblems(html), []);
});
