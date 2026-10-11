// render.js — Three.js board and piece renderer with animations
(() => {
  let THREE = null;
  let scene, camera, renderer;
  let boardMesh = null;
  let boardTexture = null;
  let pieceAtlasTexture = null;
  let pieceMaterials = {};
  let pieceMeshes = []; // array of { mesh, shadowMesh, sq, piece, anim }
  let highlightMeshes = [];
  let confettiGroup = null;
  let containerEl = null;

  let renderRequested = false;
  let activeTweens = [];
  let isFlipped = false;
  let faceToFace = false;
  let labelMode = 'han'; // 'han' | 'viet'

  // Board dimensions in 3D world units:
  // 9 files: x from -4.0 to +4.0 (step 1.0)
  // 10 ranks: z from 4.5 down to -4.5 (rank 0 at z = 4.5, rank 9 at z = -4.5)
  function sqToCoords(sq) {
    const f = sq % 9;
    const r = Math.floor(sq / 9);
    const x = f - 4.0;
    const z = 4.5 - r;
    return { x, z };
  }

  function coordsToSq(x, z) {
    const f = Math.round(x + 4.0);
    const r = Math.round(4.5 - z);
    if (f < 0 || f > 8 || r < 0 || r > 9) return -1;
    return r * 9 + f;
  }

  function createBoardCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2276;
    const ctx = canvas.getContext('2d');

    const pal = window.House ? window.House.palette() : {};
    const boardBg = pal.board || '#E9DCC4';
    const lineCol = pal['board-line'] || '#8C7A62';

    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Margins and cell dimensions
    const marginX = 140;
    const marginY = 140;
    const w = canvas.width - marginX * 2;
    const h = canvas.height - marginY * 2;
    const cellW = w / 8;
    const cellH = h / 9;

    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    // Outer border
    ctx.strokeRect(marginX - 20, marginY - 20, w + 40, h + 40);
    ctx.strokeRect(marginX, marginY, w, h);

    // Horizontal lines (all 10 ranks)
    for (let r = 0; r < 10; r++) {
      const y = marginY + r * cellH;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(marginX + w, y);
      ctx.stroke();
    }

    // Vertical lines (files)
    // Red territory (ranks 0..4, top 4 cells in canvas coordinates)
    // River gap between rank 4 and 5
    for (let f = 0; f < 9; f++) {
      const x = marginX + f * cellW;
      // Top half
      ctx.beginPath();
      ctx.moveTo(x, marginY);
      ctx.lineTo(x, marginY + 4 * cellH);
      ctx.stroke();
      // Bottom half
      ctx.beginPath();
      ctx.moveTo(x, marginY + 5 * cellH);
      ctx.lineTo(x, marginY + 9 * cellH);
      ctx.stroke();
    }

    // Palace diagonals
    // Top palace (ranks 0..2)
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * cellW, marginY);
    ctx.lineTo(marginX + 5 * cellW, marginY + 2 * cellH);
    ctx.moveTo(marginX + 5 * cellW, marginY);
    ctx.lineTo(marginX + 3 * cellW, marginY + 2 * cellH);
    ctx.stroke();

    // Bottom palace (ranks 7..9)
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * cellW, marginY + 7 * cellH);
    ctx.lineTo(marginX + 5 * cellW, marginY + 9 * cellH);
    ctx.moveTo(marginX + 5 * cellW, marginY + 7 * cellH);
    ctx.lineTo(marginX + 3 * cellW, marginY + 9 * cellH);
    ctx.stroke();

    // Corner marks (ticks)
    function drawCross(fx, ry, corners = [true, true, true, true]) {
      const cx = marginX + fx * cellW;
      const cy = marginY + ry * cellH;
      const arm = 16, dist = 10;
      ctx.lineWidth = 4;
      // top-left
      if (corners[0]) {
        ctx.beginPath();
        ctx.moveTo(cx - dist - arm, cy - dist); ctx.lineTo(cx - dist, cy - dist); ctx.lineTo(cx - dist, cy - dist - arm);
        ctx.stroke();
      }
      // top-right
      if (corners[1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dist + arm, cy - dist); ctx.lineTo(cx + dist, cy - dist); ctx.lineTo(cx + dist, cy - dist - arm);
        ctx.stroke();
      }
      // bottom-left
      if (corners[2]) {
        ctx.beginPath();
        ctx.moveTo(cx - dist - arm, cy + dist); ctx.lineTo(cx - dist, cy + dist); ctx.lineTo(cx - dist, cy + dist + arm);
        ctx.stroke();
      }
      // bottom-right
      if (corners[3]) {
        ctx.beginPath();
        ctx.moveTo(cx + dist + arm, cy + dist); ctx.lineTo(cx + dist, cy + dist); ctx.lineTo(cx + dist, cy + dist + arm);
        ctx.stroke();
      }
    }

    // Cannon positions
    [ [1, 2], [7, 2], [1, 7], [7, 7] ].forEach(([fx, ry]) => drawCross(fx, ry));
    // Soldier positions
    [0, 2, 4, 6, 8].forEach(fx => {
      drawCross(fx, 3, [fx > 0, fx < 8, fx > 0, fx < 8]);
      drawCross(fx, 6, [fx > 0, fx < 8, fx > 0, fx < 8]);
    });

    // River text
    ctx.fillStyle = lineCol;
    ctx.font = 'bold 72px "Noto Serif TC", "Be Vietnam Pro", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const riverY = marginY + 4.5 * cellH;

    if (labelMode === 'viet') {
      ctx.fillText('Sở hà', marginX + 2 * cellW, riverY);
      ctx.fillText('Hán giới', marginX + 6 * cellW, riverY);
    } else {
      ctx.fillText('楚河', marginX + 2 * cellW, riverY);
      ctx.fillText('漢界', marginX + 6 * cellW, riverY);
    }

    return canvas;
  }

  // Create piece textures
  function createPieceAtlas() {
    const tileSize = 256;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = tileSize * 7;
    atlasCanvas.height = tileSize * 2;
    const ctx = atlasCanvas.getContext('2d');

    const pal = window.House ? window.House.palette() : {};
    const cs = getComputedStyle(document.documentElement);
    const redCol = cs.getPropertyValue('--xq-red').trim() || '#B8432E';
    const blackCol = cs.getPropertyValue('--xq-black').trim() || '#2B2622';
    const surfaceCol = pal.surface || '#FBF8F2';

    const GLYPHS_HAN = {
      1: { red: '帥', black: '將' },
      2: { red: '仕', black: '士' },
      3: { red: '相', black: '象' },
      4: { red: '傌', black: '馬' },
      5: { red: '俥', black: '車' },
      6: { red: '炮', black: '砲' },
      7: { red: '兵', black: '卒' }
    };

    const GLYPHS_VIET = {
      1: { red: 'Tg', black: 'Tg' },
      2: { red: 'S', black: 'S' },
      3: { red: 'T', black: 'T' },
      4: { red: 'M', black: 'M' },
      5: { red: 'X', black: 'X' },
      6: { red: 'P', black: 'P' },
      7: { red: 'B', black: 'B' }
    };

    const glyphs = labelMode === 'viet' ? GLYPHS_VIET : GLYPHS_HAN;

    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const isRed = (sideIdx === 0);
      const col = isRed ? redCol : blackCol;

      for (let t = 1; t <= 7; t++) {
        const x = (t - 1) * tileSize;
        const y = sideIdx * tileSize;
        const cx = x + tileSize / 2;
        const cy = y + tileSize / 2;

        // Disc background
        ctx.fillStyle = surfaceCol;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        // Double rings
        ctx.strokeStyle = col;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize / 2 - 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize / 2 - 24, 0, Math.PI * 2);
        ctx.stroke();

        // Glyph
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = isRed ? glyphs[t].red : glyphs[t].black;

        if (labelMode === 'viet') {
          ctx.font = 'bold 100px "Be Vietnam Pro", sans-serif';
        } else {
          ctx.font = 'bold 124px "Noto Serif TC", serif';
        }
        ctx.fillText(text, cx, cy);
      }
    }

    return atlasCanvas;
  }

  function createPieceMaterial(type, side, rotate180 = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const sideIdx = side === 1 ? 0 : 1;
    const tileSize = 256;
    const sx = (type - 1) * tileSize;
    const sy = sideIdx * tileSize;

    if (rotate180) {
      ctx.translate(128, 128);
      ctx.rotate(Math.PI);
      ctx.translate(-128, -128);
    }
    ctx.drawImage(pieceAtlasCanvas, sx, sy, tileSize, tileSize, 0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const pal = window.House ? window.House.palette() : {};
    const sideMat = new THREE.MeshStandardMaterial({
      color: pal['surface-2'] || '#EAE2D4',
      roughness: 0.65,
      metalness: 0.05
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      metalness: 0.05
    });

    return [sideMat, topMat, sideMat];
  }

  let pieceAtlasCanvas = null;
  let pieceGeometry = null;
  let shadowGeometry = null;
  let shadowMaterial = null;

  function initShadowResources() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 20, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    shadowMaterial = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false
    });
    shadowGeometry = new THREE.PlaneGeometry(1.1, 1.1);
  }

  const Render = {
    init(threeModule, canvas, container) {
      THREE = threeModule;
      containerEl = container;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
      camera.position.set(0, 20, 0);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lights
      const pal = window.House ? window.House.palette() : {};
      const hemiLight = new THREE.HemisphereLight(pal.surface || 0xffffff, pal.bg || 0x444444, 1.2);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
      dirLight.position.set(-6, 18, 6);
      scene.add(dirLight);

      // Board plane: 9 units wide, 10 units high (plus margins -> 9.4 x 10.4)
      const boardGeo = new THREE.PlaneGeometry(9.6, 10.6);
      boardTexture = new THREE.CanvasTexture(createBoardCanvas());
      boardTexture.colorSpace = THREE.SRGBColorSpace;
      const boardMat = new THREE.MeshBasicMaterial({ map: boardTexture });
      boardMesh = new THREE.Mesh(boardGeo, boardMat);
      boardMesh.rotation.x = -Math.PI / 2;
      boardMesh.position.y = -0.01;
      scene.add(boardMesh);

      // Pieces shared geometry
      pieceGeometry = new THREE.CylinderGeometry(0.44, 0.44, 0.16, 48);
      pieceAtlasCanvas = createPieceAtlas();
      initShadowResources();

      // Confetti group
      confettiGroup = new THREE.Group();
      scene.add(confettiGroup);

      // Resize observer
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(containerEl);
      this.resize();

      // Animation loop
      const animate = (time) => {
        requestAnimationFrame(animate);
        let hasActiveTween = false;
        const now = performance.now();

        for (let i = activeTweens.length - 1; i >= 0; i--) {
          const tw = activeTweens[i];
          const progress = Math.min(1, (now - tw.start) / tw.dur);
          tw.update(progress);
          if (progress >= 1) {
            if (tw.complete) tw.complete();
            activeTweens.splice(i, 1);
          } else {
            hasActiveTween = true;
          }
        }

        if (renderRequested || hasActiveTween) {
          renderer.render(scene, camera);
          renderRequested = false;
        }
      };
      requestAnimationFrame(animate);

      // Listen to house theme change to recolor scene
      window.addEventListener('housethemechange', () => this.refreshTheme());

      // Attempt to preload CJK font then redraw atlas
      if (document.fonts) {
        document.fonts.load('700 64px "Noto Serif TC"', '帥將').then(() => {
          this.refreshTheme();
        }).catch(() => {});
      }
    },

    requestRender() {
      renderRequested = true;
    },

    resize() {
      if (!containerEl || !renderer || !camera) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      if (w === 0 || h === 0) return;

      renderer.setSize(w, h, false);

      // Fit board (9.6 x 10.6) into viewport
      const boardW = 9.8;
      const boardH = 10.8;
      const aspect = w / h;
      const boardAspect = boardW / boardH;

      let viewW, viewH;
      if (aspect > boardAspect) {
        viewH = boardH;
        viewW = boardH * aspect;
      } else {
        viewW = boardW;
        viewH = boardW / aspect;
      }

      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();

      this.requestRender();
    },

    setFlipped(flipped) {
      isFlipped = flipped;
      if (camera) {
        camera.rotation.z = isFlipped ? Math.PI : 0;
      }
      this.requestRender();
    },

    setFaceToFace(val) {
      faceToFace = val;
      this.refreshPieces();
    },

    setLabelMode(mode) {
      labelMode = mode;
      this.refreshTheme();
    },

    refreshTheme() {
      if (!boardTexture) return;
      // Redraw board texture
      const newBoardCanvas = createBoardCanvas();
      boardTexture.image = newBoardCanvas;
      boardTexture.needsUpdate = true;

      // Redraw piece atlas
      pieceAtlasCanvas = createPieceAtlas();
      pieceMaterials = {}; // bust material cache
      this.refreshPieces();
    },

    refreshPieces() {
      for (const p of pieceMeshes) {
        const rotateTop = (faceToFace && p.piece < 0);
        const mats = createPieceMaterial(Math.abs(p.piece), p.piece > 0 ? 1 : -1, rotateTop);
        p.mesh.material = mats;
      }
      this.requestRender();
    },

    syncBoard(pos, animateMove = null) {
      // Clear old pieces
      for (const p of pieceMeshes) {
        scene.remove(p.mesh);
        scene.remove(p.shadowMesh);
      }
      pieceMeshes = [];

      for (let sq = 0; sq < 90; sq++) {
        const piece = pos.board[sq];
        if (piece === 0) continue;

        const coords = sqToCoords(sq);
        const rotateTop = (faceToFace && piece < 0);
        const mats = createPieceMaterial(Math.abs(piece), piece > 0 ? 1 : -1, rotateTop);

        const mesh = new THREE.Mesh(pieceGeometry, mats);
        mesh.position.set(coords.x, 0.08, coords.z);

        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(coords.x, 0.005, coords.z);

        scene.add(shadowMesh);
        scene.add(mesh);

        pieceMeshes.push({ mesh, shadowMesh, sq, piece });
      }

      this.requestRender();
    },

    animateMove(fromSq, toSq, onComplete) {
      const pIdx = pieceMeshes.findIndex(p => p.sq === fromSq);
      if (pIdx === -1) {
        if (onComplete) onComplete();
        return;
      }

      const pObj = pieceMeshes[pIdx];
      const startCoords = sqToCoords(fromSq);
      const endCoords = sqToCoords(toSq);

      // Captured piece at destination?
      const capIdx = pieceMeshes.findIndex(p => p.sq === toSq);
      if (capIdx !== -1) {
        const capObj = pieceMeshes[capIdx];
        pieceMeshes.splice(capIdx, 1);
        // Scale out animation for captured piece
        activeTweens.push({
          start: performance.now(),
          dur: 120,
          update: (t) => {
            const s = 1 - t;
            capObj.mesh.scale.set(s, s, s);
            capObj.shadowMesh.scale.set(s, s, s);
          },
          complete: () => {
            scene.remove(capObj.mesh);
            scene.remove(capObj.shadowMesh);
          }
        });
      }

      pObj.sq = toSq;

      // Slide and lift arc
      activeTweens.push({
        start: performance.now(),
        dur: 200,
        update: (t) => {
          // Arc lift
          const lift = Math.sin(t * Math.PI) * 0.35;
          const x = startCoords.x + (endCoords.x - startCoords.x) * t;
          const z = startCoords.z + (endCoords.z - startCoords.z) * t;
          pObj.mesh.position.set(x, 0.08 + lift, z);
          pObj.shadowMesh.position.set(x, 0.005, z);
        },
        complete: () => {
          pObj.mesh.position.set(endCoords.x, 0.08, endCoords.z);
          pObj.shadowMesh.position.set(endCoords.x, 0.005, endCoords.z);
          if (onComplete) onComplete();
        }
      });

      this.requestRender();
    },

    clearHighlights() {
      for (const h of highlightMeshes) {
        scene.remove(h);
      }
      highlightMeshes = [];
      this.requestRender();
    },

    showSelection(sq) {
      const coords = sqToCoords(sq);
      const ringGeo = new THREE.RingGeometry(0.46, 0.52, 32);
      const pal = window.House ? window.House.palette() : {};
      const ringMat = new THREE.MeshBasicMaterial({
        color: pal.accent || 0xB8432E,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(coords.x, 0.015, coords.z);
      scene.add(ring);
      highlightMeshes.push(ring);
      this.requestRender();
    },

    showTargets(quietSquares, captureSquares) {
      const pal = window.House ? window.House.palette() : {};
      const accentCol = pal.accent || 0xB8432E;

      // Quiet targets: small dots
      const dotGeo = new THREE.CircleGeometry(0.12, 24);
      const dotMat = new THREE.MeshBasicMaterial({
        color: accentCol,
        transparent: true,
        opacity: 0.65
      });

      for (const sq of quietSquares) {
        const c = sqToCoords(sq);
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(c.x, 0.012, c.z);
        scene.add(dot);
        highlightMeshes.push(dot);
      }

      // Capture targets: rings
      const capGeo = new THREE.RingGeometry(0.44, 0.52, 32);
      const capMat = new THREE.MeshBasicMaterial({
        color: accentCol,
        side: THREE.DoubleSide
      });

      for (const sq of captureSquares) {
        const c = sqToCoords(sq);
        const ring = new THREE.Mesh(capGeo, capMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(c.x, 0.012, c.z);
        scene.add(ring);
        highlightMeshes.push(ring);
      }

      this.requestRender();
    },

    showLastMove(fromSq, toSq) {
      if (fromSq < 0 || toSq < 0) return;
      const pal = window.House ? window.House.palette() : {};
      const markerGeo = new THREE.RingGeometry(0.38, 0.42, 4); // square ring
      const markerMat = new THREE.MeshBasicMaterial({
        color: pal.accent || 0xB8432E,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });

      [fromSq, toSq].forEach(sq => {
        const c = sqToCoords(sq);
        const m = new THREE.Mesh(markerGeo, markerMat);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.PI / 4;
        m.position.set(c.x, 0.011, c.z);
        scene.add(m);
        highlightMeshes.push(m);
      });

      this.requestRender();
    },

    showCheck(kingSq) {
      if (kingSq < 0) return;
      const c = sqToCoords(kingSq);
      const ringGeo = new THREE.RingGeometry(0.48, 0.56, 32);
      const pal = window.House ? window.House.palette() : {};
      const ringMat = new THREE.MeshBasicMaterial({
        color: pal.warn || 0xB7791F,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(c.x, 0.013, c.z);
      scene.add(ring);
      highlightMeshes.push(ring);
      this.requestRender();
    },

    raycastSquare(clientX, clientY) {
      if (!containerEl || !camera) return -1;
      const rect = containerEl.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const intersects = raycaster.intersectObject(boardMesh);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        return coordsToSq(pt.x, pt.z);
      }
      return -1;
    },

    triggerConfetti() {
      // 60 confetti quads
      const pal = window.House ? window.House.palette() : {};
      const cols = [pal.accent || '#B8432E', pal['accent-2'] || '#2E7566'];
      const quads = [];
      const geo = new THREE.PlaneGeometry(0.12, 0.12);

      for (let i = 0; i < 60; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: cols[i % cols.length],
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          (Math.random() - 0.5) * 4,
          0.2 + Math.random() * 2,
          (Math.random() - 0.5) * 4
        );
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        confettiGroup.add(mesh);
        quads.push({
          mesh,
          vy: 0.04 + Math.random() * 0.06,
          vx: (Math.random() - 0.5) * 0.04,
          vz: (Math.random() - 0.5) * 0.04
        });
      }

      activeTweens.push({
        start: performance.now(),
        dur: 900,
        update: (t) => {
          quads.forEach(q => {
            q.mesh.position.y += q.vy;
            q.mesh.position.x += q.vx;
            q.mesh.position.z += q.vz;
            q.mesh.rotation.x += 0.1;
            q.mesh.rotation.y += 0.1;
          });
        },
        complete: () => {
          quads.forEach(q => {
            confettiGroup.remove(q.mesh);
          });
        }
      });

      this.requestRender();
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.Render = Render;
})();
