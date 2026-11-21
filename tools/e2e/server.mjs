#!/usr/bin/env node
// Zero-dependency static server for E2E. Serves the repo root on 127.0.0.1 with GitHub Pages-like routes:
// /<app>/, /vibe-coded-apps/<app>/, and renamed or deep aliases /zz-renamed-<app>/, /any/deep/path/<app>/.
// Usage: node tools/e2e/server.mjs   (env E2E_PORT, default 4173)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Pages-like routing. Returns { rel } (file under root), { redirect } (301 to a trailing slash) or null (refuse).
export function route(raw, root = ROOT) {
  let path;
  try { path = decodeURIComponent(raw); } catch { return null; }
  if (path.includes('\0') || path.split('/').some((s) => s.startsWith('.') && s !== '')) return null; // no traversal, no dotfiles
  if (path === '/') return null;
  if (!path.endsWith('/') && !extname(path)) return { redirect: raw + '/' };
  path = path.replace(/^\/vibe-coded-apps(?=\/)/, '').replace(/^\/zz-renamed-/, '/').replace(/^\/any\/deep\/path\//, '/');
  const rel = path.replace(/^\/+/, '') + (path.endsWith('/') ? 'index.html' : '');
  const full = resolve(root, rel);
  if (!full.startsWith(resolve(root) + sep)) return null;
  return { rel };
}

export function createAppServer(root = ROOT) {
  return createServer(async (req, res) => {
    const r = req.method === 'GET' || req.method === 'HEAD' ? route(req.url.split(/[?#]/)[0], root) : null;
    if (r?.redirect) { res.writeHead(301, { Location: r.redirect }).end(); return; }
    let body = null;
    if (r) { try { body = await readFile(join(root, r.rel)); } catch { body = null; } }
    if (!body) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(r.rel)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.E2E_PORT ?? 4173);
  createAppServer().listen(port, '127.0.0.1', () => console.log(`serving ${ROOT} at http://127.0.0.1:${port}`));
}
