#!/usr/bin/env node
// Build <app>/src/index.html into one self-contained <app>/index.html. Zero dependencies.
// Usage: node shared/scripts/build.mjs <app...> | --all | --self-test
// Inlines relative CSS/JS/fonts (incl. ../../shared/...), turns import-map files into data: URLs,
// then fails on any network, root-absolute or un-inlined reference. Plain <a href> links are allowed.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.js': 'text/javascript', '.mjs': 'text/javascript',
};
const NET = /^(https?:)?\/\//i; // network, or protocol-relative
const isLocal = (u) => u !== '' && !/^([a-z][a-z\d+.-]*:|\/|#)/i.test(u); // relative file, no scheme
const pathOf = (dir, u) => resolve(dir, u.split(/[?#]/)[0]);
// A quoted url("...") is one token, so a url(#x) inside an SVG data: URL is not mistaken for a file.
const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]*?))\s*\)/gi;
const safeJs = (code) => code.replace(/<\/script/gi, '<\\/script'); // inlined code must not close its tag

// data: URL for a local file, or a reported problem when the file is missing or of an unknown type.
function dataUrl(p, u, problems) {
  const mime = MIME[extname(p).toLowerCase()];
  if (!existsSync(p)) { problems.push(`file not found: ${u}`); return null; }
  if (!mime) { problems.push(`no inline type for ${u}`); return null; }
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}

function inlineCss(css, dir, problems) {
  css = css.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?[^;]*;/gi, (m, _q, u) => {
    if (!isLocal(u)) return m; // left for findProblems to report
    const p = pathOf(dir, u);
    if (!existsSync(p)) { problems.push(`file not found: ${u}`); return ''; }
    return inlineCss(readFileSync(p, 'utf8'), dirname(p), problems);
  });
  return css.replace(URL_RE, (m, dq, sq, bare) => {
    const u = dq ?? sq ?? bare;
    if (!isLocal(u)) return m;
    const url = dataUrl(pathOf(dir, u), u, problems);
    return url ? `url("${url}")` : m;
  });
}

// Inline the app's local files, then return the HTML and every problem that is left.
export function buildSource(source, baseDir) {
  const problems = [];
  let html = source;

  // Import map: local files become data: URLs, so the page works without a server or network.
  html = html.replace(/(<script\b[^>]*type=["']importmap["'][^>]*>)([\s\S]*?)(<\/script>)/i, (m, open, body, close) => {
    let map;
    try { map = JSON.parse(body); } catch (e) { problems.push(`import map is not valid JSON: ${e.message}`); return m; }
    for (const [name, u] of Object.entries(map.imports ?? {})) {
      if (isLocal(u)) map.imports[name] = dataUrl(pathOf(baseDir, u), u, problems) ?? u;
    }
    return open + JSON.stringify(map) + close;
  });

  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !isLocal(href)) return tag;
    const p = pathOf(baseDir, href);
    if (!existsSync(p)) { problems.push(`file not found: ${href}`); return ''; }
    return `<style>\n${inlineCss(readFileSync(p, 'utf8'), dirname(p), problems)}\n</style>`;
  });

  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => `<style${attrs}>${inlineCss(css, baseDir, problems)}</style>`);

  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, pre, u, post) => {
    if (!isLocal(u)) return tag;
    const p = pathOf(baseDir, u);
    if (!existsSync(p)) { problems.push(`file not found: ${u}`); return ''; }
    const attrs = `${pre}${post}`.replace(/\s+/g, ' ').trim();
    return `<script${attrs ? ' ' + attrs : ''}>\n${safeJs(readFileSync(p, 'utf8'))}\n</script>`;
  });

  return { html, problems: [...problems, ...findProblems(html)] };
}

// Loading contexts only: src/href of non-link tags, link href, import map, @import, url(), and JS that loads from a URL.
// Literal URL strings that are not loaded (text, comments, namespace constants) are allowed.
export function findProblems(html) {
  const out = [];
  const im = html.match(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  if (im) {
    try {
      for (const [name, u] of Object.entries(JSON.parse(im[1]).imports ?? {})) {
        if (!u.startsWith('data:')) out.push(`import map entry "${name}" is not inlined: ${u}`);
      }
    } catch { out.push('import map is not valid JSON'); }
  }

  const js = [], css = [];
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
      if (!/importmap/i.test(attrs)) js.push(body);
      return `<script${attrs}></script>`;
    })
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, body) => { css.push(body); return '<style></style>'; });

  for (const [, tag, attrs] of markup.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const t = tag.toLowerCase();
    for (const [, n, raw] of attrs.matchAll(/\s(src|href|poster|srcset|data)\s*=\s*["']([^"']*)["']/gi)) {
      const name = n.toLowerCase(), v = raw.trim();
      const where = `<${t} ${name}>: ${v}`;
      if (!v || v.startsWith('#') || v.startsWith('data:') || /^(mailto|tel):/i.test(v)) continue;
      if (t === 'a' && name === 'href' && /^https?:\/\//i.test(v)) continue; // plain hyperlink
      if (NET.test(v)) out.push(`network URL in ${where}`);
      else if (v.startsWith('/')) out.push(`root-absolute path in ${where}`);
      else if (t === 'a' && name === 'href') continue; // relative page link, not a load
      else out.push(`local file not inlined in ${where}`);
    }
  }

  for (const c of css) {
    if (/@import/i.test(c)) out.push('@import not inlined in CSS');
    for (const m of c.matchAll(URL_RE)) {
      const u = m[1] ?? m[2] ?? m[3];
      if (!u.startsWith('data:') && !u.startsWith('#')) out.push(`CSS url() must be a data: URL: ${u}`);
    }
  }

  const JS_RULES = [
    [/\bimport\s*\(\s*['"`](?:https?:)?\/\//, 'dynamic import of a network URL'],
    [/\bimport\s*['"](?:https?:)?\/\//, 'static import of a network URL'],
    [/\bfrom\s*['"](?:https?:)?\/\//, 'import from a network URL'],
    [/\b(?:fetch|importScripts|Worker|SharedWorker|WebSocket|EventSource)\s*\(\s*['"`](?:https?:)?\/\//, 'network request or worker from a literal URL'],
    [/\.src\s*=\s*['"`](?:https?:)?\/\//, 'script or image src set to a network URL'],
    [/\bimport\s*\(\s*['"`]\.{0,2}\//, 'dynamic import of a local file (inline it instead)'],
    [/\bfrom\s*['"]\.{1,2}\//, 'relative ES import of a local file (inline it instead)'],
    [/\bimport\s*['"]\.{1,2}\//, 'relative ES import of a local file (inline it instead)'],
  ];
  for (const body of js) {
    for (const [re, msg] of JS_RULES) {
      const m = body.match(re);
      if (m) out.push(`${msg} in inlined JS: ${m[0].slice(0, 80)}`);
    }
  }
  return out;
}

// ---- Licenses (specs/licensing.md) ----
// Every vendored library: how to spot it in the source, its license file under shared/vendor/ and what that file must say.
export const VENDOR = [
  { re: /vendor\/(three@[\d.]+)\//, name: 'Three.js', license: 'MIT', file: (m) => `${m[1]}/LICENSE`, expect: /Permission is hereby granted/, version: (m) => m[1].split('@')[1] },
  { re: /vendor\/(tone@[\d.]+)\//, name: 'Tone.js', license: 'MIT', file: (m) => `${m[1]}/LICENSE`, expect: /Permission is hereby granted/, version: (m) => m[1].split('@')[1] },
  { re: /vendor\/fonts\/be-vietnam-pro/, name: 'Be Vietnam Pro (font)', license: 'OFL-1.1', file: () => 'fonts/OFL.txt', expect: /SIL OPEN FONT LICENSE/ },
  { re: /vendor\/fonts\/noto-serif-tc/, name: 'Noto Serif TC (font subset)', license: 'OFL-1.1', file: () => 'fonts/noto-serif-tc.OFL.txt', expect: /SIL OPEN FONT LICENSE/ },
];
const VENDOR_DIR = join(ROOT, 'shared', 'vendor');
const TEXT_FILE = /\.(m?js|css|html)$/;

// The libraries an app inlines: vendor paths named in its src/ and, when it uses the house kit, in shared/house/.
export function usedVendors(appDir) {
  const files = [];
  const src = join(appDir, 'src');
  if (existsSync(src)) for (const f of readdirSync(src)) if (TEXT_FILE.test(f)) files.push(join(src, f));
  if (files.some((f) => /shared\/house/.test(readFileSync(f, 'utf8')))) {
    const h = join(ROOT, 'shared', 'house');
    for (const f of readdirSync(h)) if (TEXT_FILE.test(f)) files.push(join(h, f));
  }
  const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const out = [];
  for (const v of VENDOR) {
    const m = all.match(v.re);
    if (!m) continue;
    const p = join(VENDOR_DIR, v.file(m));
    out.push({ name: v.version ? `${v.name} ${v.version(m)}` : v.name, license: v.license, text: existsSync(p) ? readFileSync(p, 'utf8').trim() : null, file: v.file(m) });
  }
  return out;
}

// The repo MIT text, then one notice per library. Pure: the caller passes the root license text.
export function licenseText(rootLicense, libs) {
  let out = rootLicense.trim() + '\n';
  if (libs.length) {
    out += '\n----------------------------------------------------------------\nThird-party notices\n----------------------------------------------------------------\n';
    for (const l of libs) out += `\n${l.name} (${l.license})\n\n${l.text}\n`;
  }
  return out;
}

// Notices go in a comment right after the doctype, so a copy of index.html alone still carries them.
export function embedLicense(html, license) {
  const c = `<!--\n${license.replace(/--/g, '- -')}-->`;
  const m = html.match(/^<!doctype[^>]*>/i);
  return m ? `${m[0]}\n${c}${html.slice(m[0].length)}` : `${c}\n${html}`;
}

// ---- files.txt (specs/game-launcher-files-type.md) ----
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Same rule the launcher applies to every manifest line.
export function badPath(p) {
  return p === '' || p.startsWith('/') || /[\\:\x00-\x1f]/.test(p) || p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..');
}

function walk(dir, base = '') {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

// index.html first, then LICENSE and assets/** sorted by path. Lines are "<sha256>  <path>". Throws on a bad path.
export function manifestText(appDir, html, license) {
  const rest = [{ path: 'LICENSE', data: Buffer.from(license) }];
  for (const rel of walk(join(appDir, 'assets'), 'assets')) rest.push({ path: rel, data: readFileSync(join(appDir, rel)) });
  rest.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const entries = [{ path: 'index.html', data: Buffer.from(html) }, ...rest];
  for (const e of entries) if (badPath(e.path)) throw new Error(`bad path in files.txt: ${e.path}`);
  return entries.map((e) => `${sha256(e.data)}  ${e.path}`).join('\n') + '\n';
}

// Everything the build writes for one app: HTML (with notices), LICENSE, files.txt, and the problems found.
export function buildFile(srcPath) {
  const appDir = dirname(dirname(resolve(srcPath)));
  const { html: inlined, problems } = buildSource(readFileSync(srcPath, 'utf8'), dirname(resolve(srcPath)));
  const libs = usedVendors(appDir);
  libs.filter((l) => l.text === null).forEach((l) => problems.push(`no license file for ${l.name}: shared/vendor/${l.file}`));
  const license = licenseText(readFileSync(join(ROOT, 'LICENSE'), 'utf8'), libs.filter((l) => l.text));
  const html = embedLicense(inlined, license);
  let files = '';
  try { files = manifestText(appDir, html, license); } catch (e) { problems.push(e.message); }
  return { html, problems, license, files };
}

// version.json carries sha256 and size of what the launcher downloads, so it can warn about a damaged copy.
export function catalogFields(entry, html, files) {
  const data = entry.type === 'files' ? files : html;
  return { sha256: sha256(Buffer.from(data)), size: Buffer.byteLength(data) };
}

const SKIP = new Set(['shared', 'game-launcher', 'node_modules', 'out', 'dist', 'target', 'tools', 'archived']);
// Every app folder: has index.html (built or source) or src/index.html.
export function allApps() {
  return readdirSync(ROOT).filter((d) => !d.startsWith('.') && !SKIP.has(d)
    && statSync(join(ROOT, d)).isDirectory()
    && (existsSync(join(ROOT, d, 'index.html')) || existsSync(join(ROOT, d, 'src', 'index.html'))))
    .sort();
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'house-build-'));
  const cases = [
    { name: 'pass: local css, js, shared js, font, import map, escaped </script>, plain link', pass: true,
      files: {
        'app/src/style.css': '@font-face{font-family:F;src:url(./f.woff2)}body{background:#fff}',
        'app/src/f.woff2': 'FONT',
        'app/src/vendor/lib.js': 'export const x = 1;',
        'shared/house/kit.js': 'window.House = {};',
        'app/src/main.js': "import { x } from 'lib'; const docs = 'https://example.com/docs'; console.log(x, '</script>');",
      },
      html: '<!doctype html><html lang="vi"><head><link rel="stylesheet" href="./style.css">' +
        '<script type="importmap">{"imports":{"lib":"./vendor/lib.js"}}</script>' +
        '<script src="../../shared/house/kit.js"></script></head><body><a href="https://example.com">link</a>' +
        '<script type="module" src="./main.js"></script></body></html>',
      after: (h) => h.includes('data:font/woff2;base64,') && h.includes('data:text/javascript;base64,') && h.includes('<\\/script>') && !h.includes('src="./') },
    { name: 'pass: no import map, no stylesheet', pass: true, files: {}, html: '<html lang="vi"><body><script>console.log(1)</script></body></html>' },
    { name: 'pass: url(#n) inside a quoted SVG data: URL is not a file', pass: true, files: {},
      html: `<style>.a{background-image:url("data:image/svg+xml,%3Cfilter id='n'%3E%3Cg filter='url(%23n)'/%3E")}</style>` },
    { name: 'fail: CDN script', files: {}, html: '<script src="https://cdn.jsdelivr.net/npm/tone@15.0.4/build/Tone.js"></script>', expect: /network URL in <script src/ },
    { name: 'fail: CDN stylesheet', files: {}, html: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito">', expect: /network URL in <link href/ },
    { name: 'fail: network import map', files: {}, html: '<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.170.0/build/three.module.js"}}</script>', expect: /import map entry "three" is not inlined/ },
    { name: 'fail: @import left in CSS', files: {}, html: '<style>@import url(https://fonts.googleapis.com/x.css);</style>', expect: /@import not inlined/ },
    { name: 'fail: network url() in CSS', files: {}, html: '<style>.a{background:url(https://x.example/a.png)}</style>', expect: /CSS url\(\) must be a data: URL/ },
    { name: 'fail: root-absolute img', files: {}, html: '<img src="/logo.png">', expect: /root-absolute path in <img src/ },
    { name: 'fail: local image not inlined', files: { 'app/src/logo.png': 'PNG' }, html: '<img src="./logo.png">', expect: /local file not inlined in <img src/ },
    { name: 'fail: root-absolute plain link', files: {}, html: '<a href="/docs">docs</a>', expect: /root-absolute path in <a href/ },
    { name: 'fail: relative ES import', files: { 'app/src/a.js': 'export const a = 1;' }, html: "<script type=\"module\">import { a } from './a.js'; console.log(a);</script>", expect: /relative ES import/ },
    { name: 'fail: fetch of a literal network URL', files: {}, html: "<script>fetch('https://api.example.com/x')</script>", expect: /network request or worker/ },
    { name: 'fail: script.src set to a network URL', files: {}, html: "<script>const s = document.createElement('script'); s.src = 'https://x.example/t.js';</script>", expect: /src set to a network URL/ },
    { name: 'fail: missing local script', files: {}, html: '<script src="./nope.js"></script>', expect: /file not found: \.\/nope\.js/ },
    { name: 'fail: import map is not JSON', files: {}, html: '<script type="importmap">{bad</script>', expect: /import map is not valid JSON/ },
  ];

  let failed = 0;
  cases.forEach((c, i) => {
    const root = join(dir, `c${i}`);
    for (const [rel, text] of Object.entries(c.files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
    mkdirSync(join(root, 'app/src'), { recursive: true });
    const { html, problems } = buildSource(c.html, join(root, 'app/src'));
    let ok;
    if (c.pass) ok = problems.length === 0 && (!c.after || c.after(html));
    else ok = problems.some((p) => c.expect.test(p));
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}${ok ? '' : `\n     problems: ${JSON.stringify(problems)}`}`);
  });
  // files.txt and LICENSE (specs/game-launcher-files-type.md R1-R4, specs/licensing.md R2-R4)
  const extra = [
    ['bad paths are refused', () => ['', '/x', 'a\\b', '../x', 'a/../b', 'a//b', './a', 'C:x', 'a\nb'].every(badPath) && !badPath('assets/a b.png')],
    ['no assets: only index.html and LICENSE', () => {
      const d = join(dir, 'm1'); mkdirSync(d, { recursive: true });
      const lines = manifestText(d, '<html>', 'L').trimEnd().split('\n');
      return lines.length === 2 && lines[0] === `${sha256(Buffer.from('<html>'))}  index.html` && lines[1].endsWith('  LICENSE');
    }],
    ['assets sorted, dot-files skipped', () => {
      const d = join(dir, 'm2'); mkdirSync(join(d, 'assets/z'), { recursive: true });
      writeFileSync(join(d, 'assets/b.png'), 'b'); writeFileSync(join(d, 'assets/a.png'), 'a');
      writeFileSync(join(d, 'assets/z/c.mp3'), 'c'); writeFileSync(join(d, 'assets/.hidden'), 'h');
      const paths = manifestText(d, 'x', 'L').trimEnd().split('\n').map((l) => l.split('  ')[1]);
      return paths.join() === 'index.html,LICENSE,assets/a.png,assets/b.png,assets/z/c.mp3';
    }],
    ['notices sit right after the doctype and are comment-safe', () => {
      const h = embedLicense('<!doctype html><html></html>', 'MIT -- text\n');
      return h.startsWith('<!doctype html>\n<!--\nMIT - - text') && h.endsWith('--><html></html>');
    }],
    ['license text lists only the given libraries', () => {
      const t = licenseText('MIT root', [{ name: 'Lib 1', license: 'MIT', text: 'LIBTEXT' }]);
      return t.includes('Third-party notices') && t.includes('Lib 1 (MIT)') && !licenseText('MIT root', []).includes('Third-party');
    }],
    ['catalog fields follow the entry type', () => {
      const a = catalogFields({ type: 'html' }, 'abc', 'f'), b = catalogFields({ type: 'files' }, 'abc', 'f');
      return a.size === 3 && a.sha256 === sha256(Buffer.from('abc')) && b.size === 1;
    }],
  ];
  for (const [name, fn] of extra) {
    let ok = false;
    try { ok = fn(); } catch { /* counts as failed */ }
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`\n${cases.length + extra.length - failed}/${cases.length + extra.length} build self-tests passed`);
  return failed === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const names = args.includes('--all') ? allApps() : args.filter((a) => !a.startsWith('--'));
  if (!names.length) {
    console.error('Usage: node shared/scripts/build.mjs <app...> | --all | --self-test');
    process.exit(2);
  }
  let failed = false;
  for (const name of names) {
    const src = join(ROOT, name, 'src', 'index.html');
    if (!existsSync(src)) {
      if (args.includes('--all')) console.log(`skip ${name} (no src/index.html: source is index.html)`);
      else { console.error(`${name}: no src/index.html`); failed = true; }
      continue;
    }
    const { html, problems, license, files } = buildFile(src);
    if (problems.length) {
      failed = true;
      console.error(`Build failed for ${name}:\n- ` + problems.join('\n- '));
      continue;
    }
    const out = join(ROOT, name, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    writeFileSync(join(ROOT, name, 'LICENSE'), license);
    writeFileSync(join(ROOT, name, 'files.txt'), files);
    const catPath = join(ROOT, 'version.json');
    const cat = JSON.parse(readFileSync(catPath, 'utf8'));
    const entry = cat.games.find((g) => g.id === name);
    if (entry) {
      Object.assign(entry, catalogFields(entry, html, files));
      writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n');
    }
    const kb = Buffer.byteLength(html) / 1024;
    console.log(`Built ${name}/index.html (${kb.toFixed(1)} KB)`);
    if (kb > 2048) console.warn(`warning: ${name} is over 2 MB`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
