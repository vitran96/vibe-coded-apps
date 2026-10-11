#!/usr/bin/env node
// Inline local CSS/JS into one HTML file. Zero dependencies.
// Usage: node build-single-html.mjs <src/index.html> <out/index.html>
// - Inlines <link rel="stylesheet" href="./x.css"> and <script src="./x.js">.
// - Leaves http(s):// and // (CDN) references untouched.
// - Fails if a root-absolute path ("/x") or an un-inlined local CSS/JS reference remains.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('Usage: node build-single-html.mjs <src.html> <out.html>');
  process.exit(1);
}

const baseDir = dirname(resolve(src));
const isExternal = (u) => /^(https?:)?\/\//i.test(u) || u.startsWith('data:') || u.startsWith('blob:');
// Root-absolute paths are left in place so the final check reports them instead of crashing.
const skip = (u) => isExternal(u) || u.startsWith('/');
const read = (u) => readFileSync(resolve(baseDir, u.split(/[?#]/)[0]), 'utf8');
// Keep "</script>" inside inlined code from closing the tag early.
const safeJs = (code) => code.replace(/<\/script/gi, '<\\/script');

let html = readFileSync(src, 'utf8');

html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
  const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
  if (!href || skip(href)) return tag;
  return `<style>\n${read(href)}\n</style>`;
});

html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, pre, url, post) => {
  if (skip(url)) return tag;
  const attrs = `${pre}${post}`.replace(/\s+/g, ' ').trim();
  return `<script${attrs ? ' ' + attrs : ''}>\n${safeJs(read(url))}\n</script>`;
});

const problems = [];
for (const m of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
  const u = m[1];
  if (isExternal(u) || u.startsWith('#') || u.startsWith('mailto:')) continue;
  if (u.startsWith('/')) problems.push(`root-absolute path (breaks sub-route deploy): ${u}`);
  else if (/\.(css|m?js)([?#]|$)/i.test(u)) problems.push(`local CSS/JS not inlined: ${u}`);
}
if (/\bimport\s[^;]*?from\s*["']\.\.?\//.test(html)) {
  problems.push('relative ES module import found in inlined code; local files cannot import each other in a single HTML');
}

if (problems.length) {
  console.error('Build failed:\n- ' + problems.join('\n- '));
  process.exit(1);
}

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, html);
console.log(`Built ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
