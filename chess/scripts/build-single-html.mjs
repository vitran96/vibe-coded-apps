#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/build-single-html.mjs <input.html> <output.html>');
  process.exit(1);
}

const inputDir = path.dirname(path.resolve(inputPath));
let html = fs.readFileSync(inputPath, 'utf8');

// Inline local stylesheets: <link rel="stylesheet" href="./foo.css">
html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, (match) => {
  const hrefMatch = match.match(/href=["']([^"']+)["']/i);
  if (!hrefMatch) return match;
  const href = hrefMatch[1];
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    return match; // Keep external CDN links
  }
  const filePath = path.resolve(inputDir, href);
  if (!fs.existsSync(filePath)) {
    console.warn(`Stylesheet not found: ${filePath}`);
    return match;
  }
  const css = fs.readFileSync(filePath, 'utf8');
  return `<style>\n${css}\n</style>`;
});

// Inline local scripts: <script src="./foo.js"></script> or <script type="module" src="./foo.js"></script>
html = html.replace(/<script\s+([^>]*src=["']([^"']+)["'][^>]*)>\s*<\/script>/gi, (match, attrs, src) => {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return match; // Keep external scripts
  }
  const filePath = path.resolve(inputDir, src);
  if (!fs.existsSync(filePath)) {
    console.warn(`Script not found: ${filePath}`);
    return match;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  const typeAttr = typeMatch ? ` type="${typeMatch[1]}"` : '';
  return `<script${typeAttr}>\n${code}\n</script>`;
});

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Built ${outputPath} (${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB)`);
