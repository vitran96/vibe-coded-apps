// Self-test for server.mjs: traversal refused, aliases resolve, redirects, 127.0.0.1 only. Run: node --test server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createAppServer, route } from './server.mjs';

const dir = mkdtempSync(join(tmpdir(), 'e2e-server-'));
mkdirSync(join(dir, 'app'));
writeFileSync(join(dir, 'app', 'index.html'), '<p>app</p>');
writeFileSync(join(dir, 'secret.txt'), 'SECRET');

const server = createAppServer(dir);
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;
const get = (path) => new Promise((ok, fail) => {
  // Raw request: node:http does not normalise ".." the way fetch/URL would.
  request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
    let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => ok({ status: res.statusCode, body, headers: res.headers }));
  }).on('error', fail).end();
});
test.after(() => server.close());

test('serves app index, Pages prefix and aliases', async () => {
  for (const p of ['/app/', '/vibe-coded-apps/app/', '/zz-renamed-app/', '/any/deep/path/app/']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.body, '<p>app</p>', p);
    assert.match(r.headers['content-type'], /^text\/html/);
    assert.equal(r.headers['cache-control'], 'no-store');
  }
});

test('refuses traversal, encoded traversal, dotfiles and root', async () => {
  for (const p of ['/../secret.txt', '/app/../../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/app/.env', '/']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.doesNotMatch(r.body, /SECRET/, p);
  }
  assert.equal(route('/../secret.txt', dir), null);
});

test('redirects a bare app path to its trailing slash like Pages', async () => {
  const r = await get('/app');
  assert.equal(r.status, 301);
  assert.equal(r.headers.location, '/app/');
});
