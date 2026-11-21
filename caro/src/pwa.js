'use strict';
// 12 PWA Bootstrap (Dynamic icons, Blob manifest, Service worker)
// ============================================================
function initPWA() {
  function drawIcon(size, padding = 0.12) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Background
    ctx.fillStyle = '#1d1b22';
    ctx.fillRect(0, 0, size, size);

    // Board plate
    const pad = size * padding;
    const bw = size - pad * 2;
    ctx.fillStyle = '#ebdcc5';
    if (ctx.roundRect) ctx.roundRect(pad, pad, bw, bw, size * 0.08);
    else ctx.fillRect(pad, pad, bw, bw);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = '#5a4635';
    ctx.lineWidth = Math.max(1, size * 0.018);
    const step = bw / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(pad + i * step, pad);
      ctx.lineTo(pad + i * step, pad + bw);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, pad + i * step);
      ctx.lineTo(pad + bw, pad + i * step);
      ctx.stroke();
    }

    // X piece
    ctx.strokeStyle = '#e0524a';
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.lineCap = 'round';
    const x1 = pad + step; const y1 = pad + step; const r = step * 0.35;
    ctx.beginPath();
    ctx.moveTo(x1 - r, y1 - r); ctx.lineTo(x1 + r, y1 + r);
    ctx.moveTo(x1 + r, y1 - r); ctx.lineTo(x1 - r, y1 + r);
    ctx.stroke();

    // O piece
    ctx.strokeStyle = '#2f7fd8';
    ctx.lineWidth = Math.max(2, size * 0.045);
    const x2 = pad + step * 3; const y2 = pad + step * 3;
    ctx.beginPath();
    ctx.arc(x2, y2, r, 0, Math.PI * 2);
    ctx.stroke();

    return c.toDataURL('image/png');
  }

  try {
    const icon192 = drawIcon(192, 0.1);
    const icon512 = drawIcon(512, 0.1);
    const icon512m = drawIcon(512, 0.2); // safe padding for maskable icon

    $('#apple-icon')?.setAttribute('href', icon192);
    $('#favicon')?.setAttribute('href', icon192);

    const manifest = {
      name: 'Caro & Gomoku',
      short_name: 'Caro',
      start_url: location.href.split('#')[0],
      scope: new URL('./', location.href).href,
      display: 'standalone',
      orientation: 'any',
      background_color: '#1d1b22',
      theme_color: '#1d1b22',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png' },
        { src: icon512, sizes: '512x512', type: 'image/png' },
        { src: icon512m, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    $('#manifest-link')?.setAttribute('href', URL.createObjectURL(blob));
  } catch {}

  // Install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.deferredInstallPrompt = e;
    const btn = $('#mn-install');
    if (btn) btn.hidden = false;
  });
}

// ============================================================
