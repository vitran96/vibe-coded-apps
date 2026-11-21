'use strict';
// 06 Renderer (Three.js Orthographic board, procedural materials, instanced stones)
// ============================================================
// Material tinted from house tokens; recolor() re-reads the token after a theme change.
const themedMat = (role, opts = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: House.palette()[role], ...opts });
  m.userData.pal = role;
  return m;
};

class BoardRenderer {
  constructor(hostEl) {
    this.host = hostEl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, 0, 80);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.host.appendChild(this.renderer.domElement);

    this.N = 30;
    this.cellSize = 1.0;
    this.N = 30;
    this.cellSize = 1.0;
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.scene.background = new THREE.Color(House.palette().bg);

    this.needsRender = true;
    this.animatingStones = [];
    this.winLineMesh = null;
    this.winPulses = [];
    this.lastMoveRing = null;
    this.ghostMeshX = null;
    this.ghostMeshO = null;
    this.coordGroup = null;

    this.initLights();
    this.initMeshes();
    this.initResize();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x6688aa, 1.2);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(15, -20, 60);
    this.scene.add(this.dirLight);
  }

  initMeshes() {
    // Last move indicator ring
    const ringGeo = new THREE.RingGeometry(0.34, 0.42, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc107, side: THREE.DoubleSide });
    this.lastMoveRing = new THREE.Mesh(ringGeo, ringMat);
    this.lastMoveRing.position.z = 0.25;
    this.lastMoveRing.visible = false;
    this.boardGroup.add(this.lastMoveRing);

    // Ghost stone indicators: X crossed bars & O torus
    const bar1 = new THREE.BoxGeometry(0.68, 0.16, 0.06);
    const bar2 = new THREE.BoxGeometry(0.68, 0.16, 0.06);
    bar1.rotateZ(Math.PI / 4);
    bar2.rotateZ(-Math.PI / 4);
    const geoGhostX = THREE.mergeGeometries([bar1, bar2]);
    this.ghostMatX = themedMat('p1', { transparent: true, opacity: 0.55 });
    this.ghostMeshX = new THREE.Mesh(geoGhostX, this.ghostMatX);
    this.ghostMeshX.position.z = 0.18;
    this.ghostMeshX.visible = false;
    this.boardGroup.add(this.ghostMeshX);

    const geoGhostO = new THREE.TorusGeometry(0.26, 0.075, 16, 32);
    this.ghostMatO = themedMat('p2', { transparent: true, opacity: 0.55 });
    this.ghostMeshO = new THREE.Mesh(geoGhostO, this.ghostMatO);
    this.ghostMeshO.position.z = 0.18;
    this.ghostMeshO.visible = false;
    this.boardGroup.add(this.ghostMeshO);
  }

  // Re-tints the scene after a theme change; each themed material remembers its token in userData.pal.
  recolor() {
    const p = House.palette();
    this.scene.background.set(p.bg);
    this.scene.traverse(o => { const role = o.material?.userData?.pal; if (role) o.material.color.set(p[role]); });
  }

  buildBoard(N) {
    this.N = 30; // 30x30 default
    N = 30;
    // Clear old board elements
    while (this.boardGroup.children.length > 0) {
      this.boardGroup.remove(this.boardGroup.children[0]);
    }
    this.boardGroup.add(this.lastMoveRing);
    if (this.ghostMeshX) this.boardGroup.add(this.ghostMeshX);
    if (this.ghostMeshO) this.boardGroup.add(this.ghostMeshO);

    const S = this.cellSize;
    const boardExtent = N * S;
    const halfExtent = boardExtent / 2;

    // Clean white board surface
    const planeGeo = new THREE.PlaneGeometry(boardExtent, boardExtent);
    this.boardMat = themedMat('board');
    this.boardPlane = new THREE.Mesh(planeGeo, this.boardMat);
    this.boardPlane.frustumCulled = false;
    this.boardPlane.position.z = 0;
    this.boardGroup.add(this.boardPlane);

    // Grid lines separating square rectangle cells (N + 1 lines)
    const linePoints = [];
    const half = (N / 2) * S;
    for (let i = 0; i <= N; i++) {
      const coord = (i - N / 2) * S;
      // Vertical line
      linePoints.push(new THREE.Vector3(coord, -half, 0.02));
      linePoints.push(new THREE.Vector3(coord, half, 0.02));
      // Horizontal line
      linePoints.push(new THREE.Vector3(-half, coord, 0.02));
      linePoints.push(new THREE.Vector3(half, coord, 0.02));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x82a6cb,
      linewidth: 1
    });
    this.gridLines = new THREE.LineSegments(lineGeo, lineMat);
    this.gridLines.frustumCulled = false;
    this.boardGroup.add(this.gridLines);

    // Frame border around the grid
    const frameColor = 0x5a8fb8;
    const frameMat = themedMat('board-line');
    const thickness = 0.45 * S;
    const depth = 0.2;
    const totalW = boardExtent + thickness * 2;

    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(totalW, thickness, depth), frameMat);
    topFrame.position.set(0, halfExtent + thickness / 2, depth / 2);
    const btmFrame = new THREE.Mesh(new THREE.BoxGeometry(totalW, thickness, depth), frameMat);
    btmFrame.position.set(0, -halfExtent - thickness / 2, depth / 2);
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(thickness, boardExtent, depth), frameMat);
    leftFrame.position.set(-halfExtent - thickness / 2, 0, depth / 2);
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(thickness, boardExtent, depth), frameMat);
    rightFrame.position.set(halfExtent + thickness / 2, 0, depth / 2);

    this.boardGroup.add(topFrame);
    this.boardGroup.add(btmFrame);
    this.boardGroup.add(leftFrame);
    this.boardGroup.add(rightFrame);

    this.buildStones(N);
    this.updateCoords();
    this.needsRender = true;
  }

  buildStones(N) {
    const count = N * N;

    // Actual 3D crossed bars for X
    const bar1 = new THREE.BoxGeometry(0.68, 0.16, 0.06);
    const bar2 = new THREE.BoxGeometry(0.68, 0.16, 0.06);
    bar1.rotateZ(Math.PI / 4);
    bar2.rotateZ(-Math.PI / 4);
    const geoX = THREE.mergeGeometries([bar1, bar2]);
    const matX = themedMat('p1');

    // Actual 3D Torus for O
    const geoO = new THREE.TorusGeometry(0.26, 0.075, 16, 32);
    const matO = themedMat('p2');

    this.meshX = new THREE.InstancedMesh(geoX, matX, count);
    this.meshO = new THREE.InstancedMesh(geoO, matO, count);
    this.meshX.frustumCulled = false;
    this.meshO.frustumCulled = false;

    const dummy = new THREE.Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();

    for (let i = 0; i < count; i++) {
      this.meshX.setMatrixAt(i, dummy.matrix);
      this.meshO.setMatrixAt(i, dummy.matrix);
    }
    this.meshX.instanceMatrix.needsUpdate = true;
    this.meshO.instanceMatrix.needsUpdate = true;

    this.boardGroup.add(this.meshX);
    this.boardGroup.add(this.meshO);
  }

  updateCoords() {
    if (this.coordGroup) {
      this.boardGroup.remove(this.coordGroup);
      this.coordGroup = null;
    }
    if (!App.settings.display.showCoords) {
      this.needsRender = true;
      return;
    }

    this.coordGroup = new THREE.Group();
    const textColor = '#35597d';
    const S = this.cellSize;
    const halfExtent = (this.N * S) / 2;

    const makeLabelSprite = (text) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = textColor;
      ctx.font = 'bold 36px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 32);

      const tex = new THREE.CanvasTexture(c);
      const spriteMat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.6 * S, 0.6 * S, 1);
      return sprite;
    };

    // Columns (letters) along top and bottom
    for (let x = 0; x < this.N; x++) {
      const label = colName(x);
      const { wx } = this.cellToWorld(x, 0);
      const topSp = makeLabelSprite(label);
      topSp.position.set(wx, halfExtent + 0.28 * S, 0.2);
      const btmSp = makeLabelSprite(label);
      btmSp.position.set(wx, -halfExtent - 0.28 * S, 0.2);
      this.coordGroup.add(topSp);
      this.coordGroup.add(btmSp);
    }

    // Rows (numbers) along left and right
    for (let y = 0; y < this.N; y++) {
      const label = String(this.N - y);
      const { wy } = this.cellToWorld(0, y);
      const leftSp = makeLabelSprite(label);
      leftSp.position.set(-halfExtent - 0.28 * S, wy, 0.2);
      const rightSp = makeLabelSprite(label);
      rightSp.position.set(halfExtent + 0.28 * S, wy, 0.2);
      this.coordGroup.add(leftSp);
      this.coordGroup.add(rightSp);
    }

    this.boardGroup.add(this.coordGroup);
    this.needsRender = true;
  }

  // Convert (x, y) cell to world coordinate (center of square cell)
  cellToWorld(x, y) {
    const S = this.cellSize;
    const wx = (x + 0.5 - this.N / 2) * S;
    const wy = (this.N / 2 - (y + 0.5)) * S;
    return { wx, wy };
  }

  // Test hook (House.debug): CSS px of a cell centre on screen. Reads only.
  cellToClient(x, y) {
    const { wx, wy } = this.cellToWorld(x, y);
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3(wx, wy, 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  // Convert world coordinate to (cx, cy) cell
  worldToCell(wx, wy) {
    const S = this.cellSize;
    const cx = Math.floor((wx / S) + this.N / 2);
    const cy = Math.floor(this.N / 2 - (wy / S));
    return { cx, cy };
  }

  setStone(x, y, player, animate = true) {
    if (!this.meshX || !this.meshO) return;
    const idx = y * this.N + x;
    const { wx, wy } = this.cellToWorld(x, y);
    const dummy = new THREE.Object3D();
    dummy.position.set(wx, wy, 0.1);

    const isReduceMotion = App.settings.display.reduceMotion === 'on' ||
      (App.settings.display.reduceMotion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (player === 1) {
      if (animate && !isReduceMotion) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.meshX.setMatrixAt(idx, dummy.matrix);
        this.animatingStones.push({ mesh: this.meshX, idx, pos: [wx, wy], t0: performance.now(), dur: 150 });
      } else {
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.meshX.setMatrixAt(idx, dummy.matrix);
      }
      this.meshX.instanceMatrix.needsUpdate = true;
    } else if (player === 2) {
      if (animate && !isReduceMotion) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.meshO.setMatrixAt(idx, dummy.matrix);
        this.animatingStones.push({ mesh: this.meshO, idx, pos: [wx, wy], t0: performance.now(), dur: 150 });
      } else {
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.meshO.setMatrixAt(idx, dummy.matrix);
      }
      this.meshO.instanceMatrix.needsUpdate = true;
    } else {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      this.meshX.setMatrixAt(idx, dummy.matrix);
      this.meshO.setMatrixAt(idx, dummy.matrix);
      this.meshX.instanceMatrix.needsUpdate = true;
      this.meshO.instanceMatrix.needsUpdate = true;
    }
    this.needsRender = true;
  }

  setLastMove(x, y) {
    if (x === null || y === null || x === undefined || y === undefined) {
      this.lastMoveRing.visible = false;
    } else {
      const { wx, wy } = this.cellToWorld(x, y);
      this.lastMoveRing.position.set(wx, wy, 0.22);
      this.lastMoveRing.visible = true;
    }
    this.needsRender = true;
  }

  setGhost(x, y, player) {
    if (x === null || y === null) {
      if (this.ghostMeshX) this.ghostMeshX.visible = false;
      if (this.ghostMeshO) this.ghostMeshO.visible = false;
    } else {
      const { wx, wy } = this.cellToWorld(x, y);
      if (player === 1) {
        if (this.ghostMeshO) this.ghostMeshO.visible = false;
        if (this.ghostMeshX) {
          this.ghostMeshX.position.set(wx, wy, 0.18);
          this.ghostMeshX.visible = true;
        }
      } else {
        if (this.ghostMeshX) this.ghostMeshX.visible = false;
        if (this.ghostMeshO) {
          this.ghostMeshO.position.set(wx, wy, 0.18);
          this.ghostMeshO.visible = true;
        }
      }
    }
    this.needsRender = true;
  }

  showWinningLine(coords) {
    this.clearWinningLine();
    if (!coords || coords.length < 5) return;

    const points = coords.map(([x, y]) => {
      const { wx, wy } = this.cellToWorld(x, y);
      return new THREE.Vector3(wx, wy, 0.28);
    });

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.1, 12, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffd152, transparent: true, opacity: 0.95 });
    this.winLineMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.winLineMesh.frustumCulled = false;
    this.boardGroup.add(this.winLineMesh);

    this.winPulses = coords.slice();
    this.needsRender = true;
  }

  clearWinningLine() {
    if (this.winLineMesh) {
      this.boardGroup.remove(this.winLineMesh);
      this.winLineMesh = null;
    }
    this.winPulses = [];
    this.needsRender = true;
  }

  getTargetZoom() {
    const size = App.settings?.display?.cellSize || (IS_TOUCH_DEVICE ? 'large' : 'normal');
    if (size === 'huge') return 64;
    if (size === 'large') return 48;
    return 32;
  }

  fitBoard() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;

    const boardSize = (this.N + 2.5) * this.cellSize;
    const aspect = w / h;
    const fullFitZoom = aspect > 1 ? (h / boardSize) : (w / boardSize);
    const targetZoom = this.getTargetZoom();

    // On larger desktop screens, fit whole board if cells are big enough;
    // on iPad/iPhone/mobile, use targetZoom so cells stay touch-friendly.
    const zoom = Math.max(fullFitZoom, targetZoom);
    this.camera.zoom = Math.max(0.1, zoom);
    this.camera.position.set(0, 0, 80);
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  panTo(targetX, targetY, smooth = true) {
    const maxPan = ((this.N + 4) * this.cellSize) / 2;
    targetX = clamp(targetX, -maxPan, maxPan);
    targetY = clamp(targetY, -maxPan, maxPan);

    if (!smooth) {
      this.camera.position.x = targetX;
      this.camera.position.y = targetY;
      this.clampCamera();
      this.needsRender = true;
      return;
    }

    const startX = this.camera.position.x;
    const startY = this.camera.position.y;
    const t0 = performance.now();
    const dur = 240;
    const step = () => {
      const now = performance.now();
      const p = clamp((now - t0) / dur, 0, 1);
      const ease = p * (2 - p);
      this.camera.position.x = startX + (targetX - startX) * ease;
      this.camera.position.y = startY + (targetY - startY) * ease;
      this.clampCamera();
      this.needsRender = true;
      if (p < 1) requestAnimationFrame(step);
    };
    step();
  }

  ensureVisible(x, y, smooth = true) {
    const { wx, wy } = this.cellToWorld(x, y);
    const cam = this.camera;
    const halfW = (this.host.clientWidth / 2) / cam.zoom;
    const halfH = (this.host.clientHeight / 2) / cam.zoom;
    const S = this.cellSize;
    const pad = 1.2 * S;
    const clearanceW = Math.min(2.0 * S, halfW * 0.5);
    const clearanceH = Math.min(2.0 * S, halfH * 0.5);

    let targetX = cam.position.x;
    let targetY = cam.position.y;

    const fitsX = halfW >= (this.N / 2 + 0.5) * S;
    const fitsY = halfH >= (this.N / 2 + 0.5) * S;

    if (!fitsX) {
      if (wx < cam.position.x - halfW + pad) {
        targetX = wx + halfW - clearanceW;
      } else if (wx > cam.position.x + halfW - pad) {
        targetX = wx - halfW + clearanceW;
      }
    } else if (Math.abs(cam.position.x) > 0.1) {
      targetX = 0;
    }

    if (!fitsY) {
      if (wy < cam.position.y - halfH + pad) {
        targetY = wy + halfH - clearanceH;
      } else if (wy > cam.position.y + halfH - pad) {
        targetY = wy - halfH + clearanceH;
      }
    } else if (Math.abs(cam.position.y) > 0.1) {
      targetY = 0;
    }

    if (Math.abs(targetX - cam.position.x) > 0.05 || Math.abs(targetY - cam.position.y) > 0.05) {
      this.panTo(targetX, targetY, smooth);
    }
  }

  focusCell(x, y, smooth = true) {
    const { wx, wy } = this.cellToWorld(x, y);
    this.panTo(wx, wy, smooth);
  }

  clampCamera() {
    const maxPan = ((this.N + 4) * this.cellSize) / 2;
    this.camera.position.x = clamp(this.camera.position.x, -maxPan, maxPan);
    this.camera.position.y = clamp(this.camera.position.y, -maxPan, maxPan);
  }

  initResize() {
    const onResize = () => {
      const w = this.host.clientWidth;
      const h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      const halfW = w / 2;
      const halfH = h / 2;
      this.camera.left = -halfW;
      this.camera.right = halfW;
      this.camera.top = halfH;
      this.camera.bottom = -halfH;
      this.camera.updateProjectionMatrix();
      this.needsRender = true;
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    // Stone drop animations
    if (this.animatingStones.length > 0) {
      const dummy = new THREE.Object3D();
      this.animatingStones = this.animatingStones.filter((anim) => {
        const p = clamp((now - anim.t0) / anim.dur, 0, 1);
        // Ease scale curve: 0 -> 1.15 -> 1.0
        let s;
        if (p < 0.7) {
          s = (p / 0.7) * 1.15;
        } else {
          s = 1.15 - ((p - 0.7) / 0.3) * 0.15;
        }
        dummy.position.set(anim.pos[0], anim.pos[1], 0.1);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        anim.mesh.setMatrixAt(anim.idx, dummy.matrix);
        anim.mesh.instanceMatrix.needsUpdate = true;
        return p < 1;
      });
      this.needsRender = true;
    }

    // Winning line pulse
    if (this.winLineMesh && this.winPulses.length > 0) {
      const pulse = 0.8 + 0.2 * Math.sin(now * 0.008);
      this.winLineMesh.material.opacity = pulse;
      this.needsRender = true;
    }

    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }
}

// ============================================================
