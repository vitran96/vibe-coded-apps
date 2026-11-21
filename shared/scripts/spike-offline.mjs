// M0 spike: build one self-contained page (three via data: import map, Tone + fonts inlined)
// and check it statically. Usage: node shared/scripts/spike-offline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VENDOR = path.join(ROOT, 'shared/vendor');
const OUT_DIR = path.join(ROOT, 'out/spike');
const OUT = path.join(OUT_DIR, 'index.html');

const read = (rel) => fs.readFileSync(path.join(VENDOR, rel));
const b64 = (buf) => buf.toString('base64');

const three = read('three@0.170.0/three.module.min.js');
const tone = read('tone@15.0.4/Tone.js').toString('utf8');
const fonts = [400, 600, 800].map((w) => ({ w, buf: read(`fonts/be-vietnam-pro-${w}.woff2`) }));

// Inert literals inside the vendored libraries (namespace string and a doc link). Not loaded at runtime.
const INERT = [
  ['http://www.w3.org/1999/xhtml', 1],
  ['https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing', 1],
];

const fontFaces = fonts
  .map(({ w, buf }) => `@font-face{font-family:'Be Vietnam Pro';font-weight:${w};font-style:normal;font-display:swap;` +
    `src:url(data:font/woff2;base64,${b64(buf)}) format('woff2')}`)
  .join('\n');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>M0 spike</title>
<style>
${fontFaces}
:root{--bg:#f6f1e7;--fg:#1f1a14;--accent:#8b2e1f}
html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font-family:'Be Vietnam Pro',sans-serif}
body{display:flex;flex-direction:column;height:100dvh;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}
h1{font-size:1.4rem;margin:12px 16px}
button{min-height:44px;min-width:44px;margin:0 16px;padding:0 20px;font:inherit;font-weight:600;background:var(--accent);color:#fff;border:0;border-radius:8px}
button:focus-visible{outline:3px solid var(--fg);outline-offset:2px}
canvas{flex:1;min-height:0;width:100%;touch-action:none;display:block}
p{margin:8px 16px;font-weight:600}
</style>
<script type="importmap">{"imports":{"three":"data:text/javascript;base64,${b64(three)}"}}</script>
<script>${tone.replace(/<\/script/gi, '<\\/script')}</script>
</head>
<body>
<h1>M0: lập phương 3D và âm thanh (offline)</h1>
<button id="beep" type="button">Phát âm thanh</button>
<canvas id="c" role="img" aria-label="Khối lập phương xoay"></canvas>
<p id="status" aria-live="polite">Đang tải…</p>
<script type="module">
import * as THREE from 'three';
const status = document.getElementById('status');
const canvas = document.getElementById('c');
try {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.5, 2, 4); camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(3, 5, 2); scene.add(sun);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x8b2e1f }));
  scene.add(cube);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setAnimationLoop(() => { if (!still) cube.rotation.y += 0.01; renderer.render(scene, camera); });
  status.textContent = 'Khối lập phương: OK. Bấm nút để nghe âm.';
} catch (e) {
  status.textContent = 'WebGL lỗi: ' + e.message;
}
document.getElementById('beep').addEventListener('click', async () => {
  try {
    await Tone.start();
    new Tone.Synth().toDestination().triggerAttackRelease('C5', '8n');
    status.textContent = 'Tone: OK.';
  } catch (e) {
    status.textContent = 'Âm thanh lỗi: ' + e.message;
  }
});
</script>
</body>
</html>
`;

// ---- static checks ----
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1; };
const check = (cond, msg) => { if (!cond) fail(msg); else console.log('ok   ' + msg); };

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

// Scan the JS as decoded too, so literals inside the base64 import map are seen.
const decoded = html.replace(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g, (_, d) => Buffer.from(d, 'base64').toString('utf8'));
let remaining = decoded;
for (const [lit, n] of INERT) {
  const count = remaining.split(lit).length - 1;
  check(count === n, `inert literal ${lit} appears ${count}x (expected ${n})`);
  remaining = remaining.split(lit).join('');
}
const netHits = remaining.match(/https?:\/\/[^\s"')]*/gi) ?? [];
check(netHits.length === 0, `no http(s):// left in output${netHits.length ? ': ' + netHits.join(' ') : ''}`);
check(!/<(link|script|img)\b[^>]*\b(src|href)=["']?(?!data:|#)/i.test(html), 'no src/href pointing to a file or URL');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
check(!/url\(\s*['"]?(?!data:|#)/i.test(css), 'every url() in the page CSS is a data: URI');

const dataUrls = [...html.matchAll(/data:([a-z/0-9+-]+);base64,([A-Za-z0-9+/=]+)/g)];
const importMapUrl = dataUrls.find((m) => m[1] === 'text/javascript');
check(!!importMapUrl && Buffer.from(importMapUrl[2], 'base64').equals(three),
  'import map "three" decodes byte-identical to three@0.170.0/three.module.min.js');
for (const { w, buf } of fonts) {
  const m = dataUrls.find((d) => d[1] === 'font/woff2' && Buffer.from(d[2], 'base64').equals(buf));
  check(!!m, `font weight ${w} decodes byte-identical to vendored woff2`);
}
check(html.includes(tone.slice(0, 200)) || html.includes('window.Tone'), 'Tone.js inlined');

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`\nwrote ${OUT} (${kb(Buffer.byteLength(html))}; three ${kb(three.length)}, Tone ${kb(Buffer.byteLength(tone))}, fonts ${kb(fonts.reduce((a, f) => a + f.buf.length, 0))} raw)`);
if (process.exitCode) console.error('spike checks FAILED'); else console.log('spike static checks PASSED');
