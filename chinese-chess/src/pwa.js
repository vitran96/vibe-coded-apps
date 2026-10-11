// pwa.js — Runtime PWA manifest, dynamically generated icons, and install prompt
(() => {
  let deferredPrompt = null;

  function generateAppIcon(size = 192) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Rounded background
    const pal = window.House ? window.House.palette() : {};
    ctx.fillStyle = pal.accent || '#B8432E';
    const r = size * 0.22;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.fill();

    // Piece disc outline
    const cx = size / 2, cy = size / 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = size * 0.015;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
    ctx.stroke();

    // Glyph 帥
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(size * 0.45)}px "Noto Serif TC", "Be Vietnam Pro", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('帥', cx, cy);

    return canvas.toDataURL('image/png');
  }

  function setupPwa() {
    const icon192 = generateAppIcon(192);
    const icon512 = generateAppIcon(512);
    const appleIcon180 = generateAppIcon(180);

    // Apple touch icon
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = appleIcon180;

    // Web manifest
    const pal = window.House ? window.House.palette() : {};
    const baseUrl = new URL('./', window.location.href).href;
    const manifest = {
      name: 'Cờ Tướng',
      short_name: 'Cờ Tướng',
      start_url: baseUrl,
      scope: baseUrl,
      display: 'standalone',
      background_color: pal.bg || '#F3EDE2',
      theme_color: pal.bg || '#F3EDE2',
      lang: window.House ? window.House.i18n.lang : 'vi',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = URL.createObjectURL(manifestBlob);

    // Install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById('btn-install-app');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });
  }

  const Pwa = {
    init: setupPwa,
    install() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
        });
      } else {
        // iOS or already installed hint
        window.XQ.toast('Chia sẻ → Thêm vào Màn hình chính');
      }
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.Pwa = Pwa;
})();
