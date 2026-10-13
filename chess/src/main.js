import * as THREE from 'three';

const APP_ID = 'chess';
const APP_VERSION = '1.0.0';
const MAKER = '';

const STORAGE_PREFIX = 'covua_';

// Storage helper with strict namespacing
const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + key) ?? localStorage.getItem('chess:' + key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
    } catch {
      console.warn('Storage failed');
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      localStorage.removeItem('chess:' + key);
    } catch {}
  },
  removeAll() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(STORAGE_PREFIX) || k.startsWith('chess:'))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

// Default settings
const DEFAULT_SETTINGS = {
  v: 1,
  timer: { kind: 'off', perMoveMs: 30000, baseMs: 600000, incMs: 0 },
  countdownFx: true,
  vibrate: true,
  legalDots: true,
  coords: true,
  autoQueen: false,
  allowUndo: true,
  pvpUndo: true,
  rotatePvp: false,
  ruleHints: true,
  notation: 'letters',
  music: false,
  sfx: true,
};

let settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
if (settings.allowUndo === undefined) {
  settings.allowUndo = settings.pvpUndo !== undefined ? settings.pvpUndo : true;
}

// Audio Engine setup
let audioCtx = null;
let sfxGain = null;
let musicGain = null;
let isAudioUnlocked = false;
let bgmSynth = null;
let bgmLoop = null;

function initAudio() {
  if (isAudioUnlocked) return;
  try {
    if (typeof Tone !== 'undefined') {
      Tone.start();
      audioCtx = Tone.context.rawContext || Tone.context;
    } else {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = settings.sfx ? 0.7 : 0;
    sfxGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = settings.music ? 0.5 : 0;
    musicGain.connect(audioCtx.destination);

    // Register chess specific SFX on House.SFX
    if (window.House && window.House.SFX) {
      window.House.SFX.capture = (c, o, t) => {
        window.House.play(c, o, 'place', 2);
        setTimeout(() => window.House.play(c, o, 'place', 1), 60);
      };
      window.House.SFX.check = (c, o, t) => {
        window.House.play(c, o, 'place', 2);
        setTimeout(() => window.House.play(c, o, 'tap'), 80);
      };
      window.House.SFX.castle = (c, o, t) => {
        window.House.play(c, o, 'place', 1);
        setTimeout(() => window.House.play(c, o, 'place', 1), 120);
      };
      window.House.SFX.promote = (c, o, t) => {
        window.House.play(c, o, 'win');
      };
      window.House.SFX.countdown = (c, o, t, n = 5) => {
        const freqs = { 5: 523.25, 4: 587.33, 3: 659.25, 2: 783.99, 1: 880 };
        const g = c.createGain();
        g.connect(o);
        const gainVal = 0.3 + (5 - n) * 0.08;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gainVal, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freqs[n] || 523.25;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.22);
      };
      window.House.SFX.timeUp = (c, o, t) => {
        window.House.play(c, o, 'invalid');
        setTimeout(() => window.House.play(c, o, 'lose'), 120);
      };
    }

    isAudioUnlocked = true;
    document.getElementById('audio-unlock-chip').style.display = 'none';
    if (settings.music) startBgm();
  } catch (e) {
    console.warn('Audio unlock failed', e);
  }
}

function playSound(name, ...args) {
  if (!settings.sfx || !audioCtx || !isAudioUnlocked) return;
  if (window.House && window.House.SFX[name]) {
    window.House.SFX[name](audioCtx, sfxGain, audioCtx.currentTime + 0.01, ...args);
  }
}

function startBgm() {
  if (!settings.music || !isAudioUnlocked || typeof Tone === 'undefined') return;
  try {
    if (!bgmSynth) {
      bgmSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.2, decay: 0.8, sustain: 0.5, release: 1.2 },
      }).toDestination();
      bgmSynth.volume.value = -12;
    }
    Tone.Transport.bpm.value = 76;
    const chords = [
      ['A3', 'C4', 'E4', 'G4', 'B4'], // Am9
      ['D3', 'F#4', 'A4', 'C5', 'E5'], // D9
      ['G3', 'B3', 'D4', 'F#4', 'A4'], // Gmaj7
      ['C3', 'E4', 'G4', 'B4', 'D5'],  // Cmaj7
    ];
    let step = 0;
    if (bgmLoop) bgmLoop.dispose();
    bgmLoop = new Tone.Loop((time) => {
      bgmSynth.triggerAttackRelease(chords[step % chords.length], '2m', time);
      step++;
    }, '2m').start(0);
    Tone.Transport.start();
  } catch (e) {
    console.warn('BGM error', e);
  }
}

function stopBgm() {
  if (typeof Tone !== 'undefined' && Tone.Transport) {
    Tone.Transport.stop();
    if (bgmLoop) bgmLoop.dispose();
    bgmLoop = null;
  }
}

// Line icon glyphs rendering for 3D tokens and 2D mini boards
const GLYPHS = {
  // SVG paths for chess pieces (2.2px stroke, round caps, 32x32 viewbox)
  pawn: '<circle cx="16" cy="10" r="4.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 15h8M11 23c1-5 9-5 10 0M8 26h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  knight: '<path d="M22 26c0-7-1-12-5-17l-1.5-3-3 2c-1.5 1-3 4-5 6.5l-2.5 3c0 1.5 1 2.5 2.5 2l2-1c2 0 3 2 2 4.5l-3.5 4h14z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="13" cy="11.5" r="1.3" fill="currentColor"/><path d="M17 11c1.8 2 2 5.5 1 9.5M8 17.5l1.5-.5M7 26h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  bishop: '<circle cx="16" cy="6" r="1.5" fill="currentColor"/><path d="M16 8v3M12 11c-2 3-2 7 1 9.5l-2 3.5h10l-2-3.5c3-2.5 3-6.5 1-9.5-2-2.5-6-2.5-8 0z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M13 15h6M7 27h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  rook: '<path d="M9 9h3v3h3V9h2v3h3V9h3v4H9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 13l1 10h10l1-10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><line x1="16" y1="16" x2="16" y2="19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 23h18M6 26h20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  queen: '<path d="M7 13l3 10h12l3-10-4.5 3.5L16 8l-4.5 8.5L7 13z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="7" cy="12" r="1.3" fill="currentColor"/><circle cx="11.5" cy="15" r="1.3" fill="currentColor"/><circle cx="16" cy="7" r="1.3" fill="currentColor"/><circle cx="20.5" cy="15" r="1.3" fill="currentColor"/><circle cx="25" cy="12" r="1.3" fill="currentColor"/><path d="M7 26h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  king: '<path d="M16 5v6M13 8h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 23c-2-6 2-10 6-10s8 4 6 10H10z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 17h8M7 26h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};

const PIECE_TYPE_MAP = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };

// Generate canvas texture for a piece token
function createPieceTexture(type, isWhite) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cs = getComputedStyle(document.documentElement);

  const discColor = cs.getPropertyValue(isWhite ? '--piece-light' : '--piece-dark').trim() || (isWhite ? '#FBF8F2' : '#2B2622');
  const inkColor = cs.getPropertyValue(isWhite ? '--piece-light-ink' : '--piece-dark-ink').trim() || (isWhite ? '#2B2622' : '#F3EDE2');

  // Disc background
  ctx.fillStyle = discColor;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // Contrast rim
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw piece glyph
  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 32 32" color="${inkColor}">${GLYPHS[type]}</svg>`;
  const img = new Image();
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);

  const tex = new THREE.CanvasTexture(canvas);
  img.onload = () => {
    ctx.drawImage(img, 24, 24, 80, 80);
    tex.needsUpdate = true;
    requestRender();
  };
  img.src = url;

  return tex;
}

// Three.js Scene, Camera, Renderer
let scene, camera, renderer;
let boardGroup, piecesGroup, overlayGroup;
let pieceTextures = {};
let squareMeshes = [];
let pieceMeshes = [];
let animList = [];
let isFlipped = false;
let renderRequested = false;

function requestRender() {
  if (!renderRequested) {
    renderRequested = true;
    requestAnimationFrame(render);
  }
}

function render() {
  renderRequested = false;
  const now = performance.now();
  let animating = false;

  // Process active animations
  for (let i = animList.length - 1; i >= 0; i--) {
    const a = animList[i];
    const t = (now - a.start) / a.dur;
    if (t >= 1) {
      a.mesh.position.copy(a.toPos);
      if (a.onEnd) a.onEnd();
      animList.splice(i, 1);
    } else {
      animating = true;
      const ease = 0.5 - Math.cos(t * Math.PI) / 2; // Smooth cosine ease
      a.mesh.position.lerpVectors(a.fromPos, a.toPos, ease);
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  if (animating) {
    requestRender();
  }
}

function initThree() {
  const canvas = document.getElementById('chess-canvas');
  const container = canvas.parentElement;
  const size = container.clientWidth || 360;

  scene = new THREE.Scene();

  const aspect = 1;
  const d = 4.6; // Board is 8x8 units (-4 to +4)
  camera = new THREE.OrthographicCamera(-d, d, d, -d, 0.1, 100);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff3e0, 0.6);
  dirLight.position.set(-5, 12, -5);
  scene.add(dirLight);

  boardGroup = new THREE.Group();
  piecesGroup = new THREE.Group();
  overlayGroup = new THREE.Group();
  scene.add(boardGroup);
  scene.add(overlayGroup);
  scene.add(piecesGroup);

  buildBoard();
  initPieceTextures();

  window.addEventListener('resize', onResize);
  window.addEventListener('housethemechange', () => {
    updateThemeColors();
  });

  setupInput();
  requestRender();
}

function onResize() {
  const canvas = document.getElementById('chess-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;
  const size = Math.min(container.clientWidth, container.clientHeight);
  if (size > 0 && renderer) {
    renderer.setSize(size, size);
    requestRender();
  }
}

function updateThemeColors() {
  initPieceTextures();
  buildBoard();
  syncBoard3D();
}

function initPieceTextures() {
  pieceTextures = {};
  for (const [code, type] of Object.entries(PIECE_TYPE_MAP)) {
    pieceTextures[code] = createPieceTexture(type, true);   // White
    pieceTextures[-code] = createPieceTexture(type, false); // Black
  }
}

function sqToPos(sq) {
  const file = sq & 7;
  const rank = sq >> 3;
  // File: 0..7 -> -3.5 to +3.5. Rank: 0..7 -> +3.5 to -3.5 (rank 1 at bottom, rank 8 at top)
  let x = file - 3.5;
  let z = -(rank - 3.5);
  if (isFlipped) {
    x = -x;
    z = -z;
  }
  return new THREE.Vector3(x, 0, z);
}

function posToSq(pos) {
  let file = Math.round(pos.x + 3.5);
  let rank = Math.round(-pos.z + 3.5);
  if (isFlipped) {
    file = 7 - file;
    rank = 7 - rank;
  }
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
  return (rank << 3) | file;
}

function buildBoard() {
  while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
  squareMeshes = [];

  const cs = getComputedStyle(document.documentElement);
  const sqLightHex = cs.getPropertyValue('--sq-light').trim() || '#EFE3CC';
  const sqDarkHex = cs.getPropertyValue('--sq-dark').trim() || '#C9A97E';
  const boardLineHex = cs.getPropertyValue('--board-line').trim() || '#8C7A62';

  const geom = new THREE.BoxGeometry(0.99, 0.08, 0.99);
  const matLight = new THREE.MeshStandardMaterial({ color: sqLightHex, roughness: 0.8 });
  const matDark = new THREE.MeshStandardMaterial({ color: sqDarkHex, roughness: 0.8 });

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = (r << 3) | f;
      const isLight = ((r + f) % 2) === 1; // standard chess board: a1 (0,0) is dark, b1 (0,1) is light
      const mesh = new THREE.Mesh(geom, isLight ? matLight : matDark);
      mesh.position.set(f - 3.5, -0.04, -(r - 3.5));
      mesh.userData = { sq };
      boardGroup.add(mesh);
      squareMeshes[sq] = mesh;
    }
  }

  // Border frame
  const frameGeom = new THREE.BoxGeometry(8.3, 0.06, 8.3);
  const frameMat = new THREE.MeshStandardMaterial({ color: boardLineHex, roughness: 0.7 });
  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.position.set(0, -0.09, 0);
  boardGroup.add(frame);

  requestRender();
}

// 3D Wooden Token creation
function createTokenMesh(val) {
  const geom = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 32);
  const cs = getComputedStyle(document.documentElement);
  const isWhite = val > 0;
  const sideColor = cs.getPropertyValue(isWhite ? '--piece-light' : '--piece-dark').trim() || (isWhite ? '#FBF8F2' : '#2B2622');

  const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.7 });
  const topMat = new THREE.MeshBasicMaterial({ map: pieceTextures[val], transparent: true });
  const bottomMat = sideMat;

  const materials = [sideMat, topMat, bottomMat];
  const mesh = new THREE.Mesh(geom, materials);
  mesh.castShadow = false;
  mesh.userData = { pieceVal: val };
  return mesh;
}

// Sync 3D Pieces with current game state
function getPieceRotation(z) {
  // Top board (z < 0): -PI/2 (upright for top player); Bottom board (z >= 0): +PI/2 (upright for bottom player)
  return z < 0 ? -Math.PI / 2 : Math.PI / 2;
}

function syncBoard3D(prevBoard = null) {
  while (piecesGroup.children.length) piecesGroup.remove(piecesGroup.children[0]);
  pieceMeshes = [];

  const b = curGame ? curGame.state.board : ChessRules.initial().board;
  for (let sq = 0; sq < 64; sq++) {
    const val = b[sq];
    if (val !== 0) {
      const mesh = createTokenMesh(val);
      const pos = sqToPos(sq);
      mesh.position.set(pos.x, 0.06, pos.z);
      mesh.rotation.y = getPieceRotation(pos.z);
      mesh.userData.sq = sq;
      piecesGroup.add(mesh);
      pieceMeshes[sq] = mesh;
    }
  }
  requestRender();
}

function animateMove(move, onDone) {
  const mesh = pieceMeshes[move.from];
  if (!mesh) {
    syncBoard3D();
    if (onDone) onDone();
    return;
  }

  const fromPos = sqToPos(move.from);
  const toPos = sqToPos(move.to);

  // If capture, remove captured mesh
  if (pieceMeshes[move.to]) {
    piecesGroup.remove(pieceMeshes[move.to]);
    delete pieceMeshes[move.to];
  }
  if (move.flags & ChessRules.FLAGS.EP) {
    const epSq = curGame.state.ep - (curGame.state.turn === 1 ? -8 : 8);
    if (pieceMeshes[epSq]) {
      piecesGroup.remove(pieceMeshes[epSq]);
      delete pieceMeshes[epSq];
    }
  }

  mesh.position.set(fromPos.x, 0.06, fromPos.z);
  mesh.rotation.y = getPieceRotation(toPos.z);
  animList.push({
    mesh,
    fromPos: mesh.position.clone(),
    toPos: new THREE.Vector3(toPos.x, 0.06, toPos.z),
    start: performance.now(),
    dur: 180,
    onEnd: () => {
      syncBoard3D();
      if (onDone) onDone();
    },
  });
  requestRender();
}

// Overlays (selection, legal dots, check pulse)
let selectedSq = -1;
let legalMovesForSelected = [];
let dotsGroup = new THREE.Group();

function updateOverlays() {
  while (overlayGroup.children.length) overlayGroup.remove(overlayGroup.children[0]);

  if (selectedSq >= 0 && settings.legalDots) {
    const cs = getComputedStyle(document.documentElement);
    const accentHex = cs.getPropertyValue('--accent').trim() || '#B8432E';

    // Highlight selected square
    const selPos = sqToPos(selectedSq);
    const selGeom = new THREE.PlaneGeometry(0.96, 0.96);
    selGeom.rotateX(-Math.PI / 2);
    const selMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.35 });
    const selMesh = new THREE.Mesh(selGeom, selMat);
    selMesh.position.set(selPos.x, 0.01, selPos.z);
    overlayGroup.add(selMesh);

    // Legal move dots
    const dotGeom = new THREE.CircleGeometry(0.16, 24);
    dotGeom.rotateX(-Math.PI / 2);
    const ringGeom = new THREE.RingGeometry(0.35, 0.44, 28);
    ringGeom.rotateX(-Math.PI / 2);

    for (const m of legalMovesForSelected) {
      const pos = sqToPos(m.to);
      const isCap = (m.captured !== 0) || (m.flags & ChessRules.FLAGS.EP);
      const geom = isCap ? ringGeom : dotGeom;
      const mat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: isCap ? 0.7 : 0.55 });
      const dot = new THREE.Mesh(geom, mat);
      dot.position.set(pos.x, 0.015, pos.z);
      overlayGroup.add(dot);
    }
  }

  // Check pulse highlight on King
  if (curGame && ChessRules.inCheck(curGame.state, curGame.state.turn)) {
    const kingSq = curGame.state.turn === 1 ? curGame.state.kings[0] : curGame.state.kings[1];
    if (kingSq >= 0) {
      const kPos = sqToPos(kingSq);
      const cs = getComputedStyle(document.documentElement);
      const dangerHex = cs.getPropertyValue('--danger').trim() || '#B8432E';
      const chkGeom = new THREE.PlaneGeometry(0.98, 0.98);
      chkGeom.rotateX(-Math.PI / 2);
      const chkMat = new THREE.MeshBasicMaterial({ color: dangerHex, transparent: true, opacity: 0.45 });
      const chkMesh = new THREE.Mesh(chkGeom, chkMat);
      chkMesh.position.set(kPos.x, 0.012, kPos.z);
      overlayGroup.add(chkMesh);
    }
  }

  requestRender();
}

// User Interaction & Pointer Handling
let isDragging = false;
let dragStartPointer = { x: 0, y: 0 };
let draggedMesh = null;
let originalMeshPos = null;

function setupInput() {
  const canvas = document.getElementById('chess-canvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    if (!curGame || curGame.isOver || isAIThinking || curGame.isReplay) return;

    const sq = getSquareFromEvent(e);
    if (sq < 0) return;

    dragStartPointer = { x: e.clientX, y: e.clientY };
    isDragging = false;

    // Tap-tap handling
    if (selectedSq >= 0) {
      const chosenMove = legalMovesForSelected.find((m) => m.to === sq);
      if (chosenMove) {
        applyHumanMove(chosenMove);
        selectedSq = -1;
        legalMovesForSelected = [];
        updateOverlays();
        return;
      }
    }

    // Select piece
    const piece = curGame.state.board[sq];
    if (piece !== 0 && (piece * curGame.state.turn > 0)) {
      if (curGame.mode === 'pve' && curGame.humanSide !== (curGame.state.turn === 1 ? 'w' : 'b')) {
        return;
      }
      selectedSq = sq;
      legalMovesForSelected = ChessRules.legalMovesFrom(curGame.state, sq);
      updateOverlays();
      draggedMesh = pieceMeshes[sq];
      if (draggedMesh) originalMeshPos = draggedMesh.position.clone();
      canvas.setPointerCapture(e.pointerId);
    } else {
      if (selectedSq >= 0) {
        playSound('invalid');
      }
      selectedSq = -1;
      legalMovesForSelected = [];
      updateOverlays();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!draggedMesh) return;
    const dist = Math.hypot(e.clientX - dragStartPointer.x, e.clientY - dragStartPointer.y);
    if (dist > 8) {
      isDragging = true;
      const worldPos = getRaycastGroundPos(e);
      if (worldPos) {
        draggedMesh.position.set(worldPos.x, 0.35, worldPos.z);
        requestRender();
      }
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (draggedMesh) {
      if (isDragging) {
        const targetSq = getSquareFromEvent(e);
        const chosenMove = legalMovesForSelected.find((m) => m.to === targetSq);
        if (chosenMove) {
          applyHumanMove(chosenMove);
          selectedSq = -1;
          legalMovesForSelected = [];
          updateOverlays();
        } else {
          draggedMesh.position.copy(originalMeshPos);
          requestRender();
        }
      }
      draggedMesh = null;
    }
    isDragging = false;
  });
}

function getSquareFromEvent(e) {
  const canvas = document.getElementById('chess-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

  const d = 4.6;
  const worldX = x * d;
  const worldZ = -y * d;
  return posToSq(new THREE.Vector3(worldX, 0, worldZ));
}

function getRaycastGroundPos(e) {
  const canvas = document.getElementById('chess-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  const d = 4.6;
  return new THREE.Vector3(x * d, 0, -y * d);
}

// Game Session & Controller
let curGame = null;
let isAIThinking = false;
let clockInterval = null;
let lastTickTime = performance.now();

class ClockController {
  constructor(timerConfig, onTick, onLowTime, onTimeout) {
    this.config = timerConfig; // { kind: 'off'|'move'|'game', perMoveMs, baseMs, incMs }
    this.onTick = onTick;
    this.onLowTime = onLowTime;
    this.onTimeout = onTimeout;
    this.wMs = timerConfig.kind === 'move' ? timerConfig.perMoveMs : timerConfig.baseMs;
    this.bMs = timerConfig.kind === 'move' ? timerConfig.perMoveMs : timerConfig.baseMs;
    this.running = false;
    this.activeSide = 1; // 1 = White, -1 = Black
    this.started = false;
    this.lastLowFired = 0;
  }

  start(side) {
    if (this.config.kind === 'off') return;
    this.activeSide = side;
    this.running = true;
    this.started = true;
    this.lastLowFired = 0;
  }

  pause() {
    this.running = false;
  }

  resume() {
    if (this.started && this.config.kind !== 'off') {
      this.running = true;
    }
  }

  switch(justMovedSide) {
    if (this.config.kind === 'off') return;
    if (this.config.kind === 'move') {
      // Reset mover's clock to full for next turn
      if (justMovedSide === 1) this.wMs = this.config.perMoveMs;
      else this.bMs = this.config.perMoveMs;
    } else if (this.config.kind === 'game') {
      // Add Fischer increment to the mover
      if (justMovedSide === 1) this.wMs += this.config.incMs;
      else this.bMs += this.config.incMs;
    }
    this.activeSide = -justMovedSide;
    this.lastLowFired = 0;
  }

  tick(deltaMs) {
    if (!this.running || this.config.kind === 'off') return;

    if (this.activeSide === 1) {
      this.wMs = Math.max(0, this.wMs - deltaMs);
    } else {
      this.bMs = Math.max(0, this.bMs - deltaMs);
    }

    const curMs = this.activeSide === 1 ? this.wMs : this.bMs;
    this.onTick(this.wMs, this.bMs, this.activeSide);

    // 5-second low time triggers
    if (curMs <= 5000 && curMs > 0) {
      const sec = Math.ceil(curMs / 1000);
      if (sec !== this.lastLowFired && sec >= 1 && sec <= 5) {
        this.lastLowFired = sec;
        this.onLowTime(sec, this.activeSide);
      }
    }

    if (curMs <= 0) {
      this.running = false;
      this.onTimeout(this.activeSide);
    }
  }
}

// AI Web Worker initialization
let aiWorker = null;
let currentSearchId = 0;

function ensureClockTicker() {
  if (clockInterval) return;
  lastTickTime = performance.now();
  clockInterval = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTickTime;
    lastTickTime = now;
    if (curGame && curGame.clock && curGame.clock.running) {
      curGame.clock.tick(delta);
    }
  }, 100);
}

function initAIWorker() {
  if (aiWorker) return;
  try {
    const rulesFactory = (ChessRules && ChessRules.factory) ? ChessRules.factory.toString() : ChessRules.toString();
    const aiFactory = (ChessAI && ChessAI.factory) ? ChessAI.factory.toString() : ChessAI.toString();
    const workerSrc = `
      const ChessRules = (${rulesFactory})();
      const ChessAI = (${aiFactory})(ChessRules);
      self.onmessage = function(e) {
        const { id, fen, level, timeBudgetMs, historyHashes } = e.data;
        try {
          const res = ChessAI.search(fen, level, timeBudgetMs, historyHashes);
          self.postMessage({ id, result: res });
        } catch (err) {
          self.postMessage({ id, error: String(err) });
        }
      };
    `;
    const blob = new Blob([workerSrc], { type: 'application/javascript' });
    aiWorker = new Worker(URL.createObjectURL(blob));
    aiWorker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (id === currentSearchId && curGame && !curGame.isOver) {
        if (error) {
          console.warn('Worker search error:', error);
          fallbackSyncAI();
        } else {
          handleAIMove(result);
        }
      }
    };
    aiWorker.onerror = (err) => {
      console.warn('AI worker failed, using sync fallback:', err);
      aiWorker = null;
      fallbackSyncAI();
    };
  } catch (err) {
    console.warn('Failed to spawn AI worker:', err);
    aiWorker = null;
  }
}

function fallbackSyncAI() {
  if (!curGame || curGame.isOver) return;
  const fen = ChessRules.toFEN(curGame.state);
  const level = curGame.aiLevel;
  const history = curGame.state.history;
  setTimeout(() => {
    try {
      const res = ChessAI.search(fen, level, 400, history);
      handleAIMove(res);
    } catch (e) {
      isAIThinking = false;
      updateStatusLine();
    }
  }, 20);
}

function startNewGame(options) {
  const mode = options.mode || 'pve';
  const aiLevel = options.aiLevel || 'medium';
  let humanSide = options.humanSide || 'w';
  if (humanSide === 'random') humanSide = Math.random() < 0.5 ? 'w' : 'b';

  const timerConfig = options.timer || settings.timer;
  const allowUndo = options.allowUndo !== undefined ? options.allowUndo : (settings.allowUndo !== false);
  const startState = ChessRules.initial();

  curGame = {
    id: Date.now().toString(),
    mode,
    aiLevel,
    humanSide,
    timerConfig,
    allowUndo,
    state: startState,
    startFEN: ChessRules.toFEN(startState),
    moves: [],
    isOver: false,
    result: null,
    reason: null,
    isReplay: false,
  };

  isFlipped = (curGame.humanSide === 'b');

  // Clock
  if (curGame.clock) curGame.clock.pause();
  curGame.clock = new ClockController(
    timerConfig,
    onClockTick,
    onLowTime,
    onTimeout
  );
  ensureClockTicker();

  showScreen('game-screen');
  buildBoard();
  syncBoard3D();
  updateUI();
  updateOverlays();

  // If PvE and Human is Black, AI plays White's first move
  if (curGame.mode === 'pve' && curGame.humanSide === 'b') {
    triggerAIMove();
  }
}

function applyHumanMove(move) {
  if (!curGame || curGame.isOver) return;

  // Check if promotion
  if ((move.flags & ChessRules.FLAGS.PROMO) && !settings.autoQueen) {
    showPromoDialog(move, (promoPiece) => {
      move.promo = promoPiece;
      executeMove(move);
    });
    return;
  } else if ((move.flags & ChessRules.FLAGS.PROMO) && settings.autoQueen) {
    move.promo = ChessRules.Q;
  }

  executeMove(move);
}

function executeMove(move) {
  const movedSide = curGame.state.turn;
  const san = ChessRules.toSAN(curGame.state, move);
  const uci = ChessRules.toUCI(move);

  // Stop countdown FX
  stopCountdownFX();

  // Clock update
  if (!curGame.clock.started && movedSide === 1) {
    curGame.clock.start(-1); // Clock starts after White's first move
  } else {
    curGame.clock.switch(movedSide);
  }

  // SFX
  if (move.flags & ChessRules.FLAGS.PROMO) playSound('promote');
  else if (move.flags & ChessRules.FLAGS.CASTLE_K || move.flags & ChessRules.FLAGS.CASTLE_Q) playSound('castle');
  else if (move.captured !== 0 || (move.flags & ChessRules.FLAGS.EP)) playSound('capture');
  else playSound('place', movedSide);

  // Apply to engine
  curGame.state = ChessRules.make(curGame.state, move);
  curGame.moves.push({
    uci,
    san,
    t: performance.now(),
    clock: [curGame.clock.wMs, curGame.clock.bMs],
  });

  animateMove(move, () => {
    checkGameStatus();
    saveAutosave();
    updateUI();

    // Check SFX
    if (!curGame.isOver && ChessRules.inCheck(curGame.state, curGame.state.turn)) {
      playSound('check');
    }

    // Trigger AI reply if needed
    if (!curGame.isOver && curGame.mode === 'pve' && curGame.state.turn === (curGame.humanSide === 'w' ? -1 : 1)) {
      triggerAIMove();
    }
  });
}

function triggerAIMove() {
  if (!curGame || curGame.isOver) return;
  isAIThinking = true;
  updateStatusLine();
  updateUndoButtons();
  initAIWorker();

  currentSearchId++;
  const searchId = currentSearchId;

  // Cap AI time budget so it never flags (Section 15.4)
  const remaining = curGame.state.turn === 1 ? curGame.clock.wMs : curGame.clock.bMs;
  let timeBudget = 800;
  if (curGame.timerConfig.kind !== 'off') {
    timeBudget = Math.min(800, remaining - 1500, Math.max(150, remaining * 0.1));
  }
  const budget = Math.max(150, timeBudget);

  if (aiWorker) {
    try {
      aiWorker.postMessage({
        id: searchId,
        fen: ChessRules.toFEN(curGame.state),
        level: curGame.aiLevel,
        timeBudgetMs: budget,
        historyHashes: curGame.state.history,
      });
    } catch (e) {
      fallbackSyncAI();
    }
  } else {
    fallbackSyncAI();
  }
}

function handleAIMove(result) {
  isAIThinking = false;
  if (!curGame || curGame.isOver) return;
  if (!result || !result.uci) {
    updateStatusLine();
    return;
  }

  const move = ChessRules.fromUCI(curGame.state, result.uci);
  if (move) {
    executeMove(move);
  } else {
    updateStatusLine();
  }
}

function checkGameStatus() {
  const st = ChessRules.status(curGame.state);
  if (st.over) {
    endGame(st.result, st.reason);
  }
}

function endGame(result, reason) {
  if (!curGame || curGame.isOver) return;
  curGame.isOver = true;
  curGame.result = result;
  curGame.reason = reason;
  curGame.clock.pause();
  stopCountdownFX();

  // SFX
  if (reason === 'checkmate') {
    const humanWon = (curGame.humanSide === 'w' && result === '1-0') || (curGame.humanSide === 'b' && result === '0-1');
    playSound(humanWon ? 'win' : 'lose');
  } else if (reason === 'stalemate' || reason === 'threefold' || reason === 'fifty' || reason === 'insufficient') {
    playSound('draw');
  } else if (reason === 'timeout') {
    playSound('timeUp');
  }

  saveRecord();
  store.remove('current');

  setTimeout(() => {
    showGameOverDialog(result, reason);
  }, 500);
}

// Timeout handler (R6)
function onTimeout(sideToMove) {
  if (!curGame || curGame.isOver) return;
  const loser = sideToMove === 1 ? 'w' : 'b';
  const winner = sideToMove === 1 ? 'b' : 'w';
  const result = loser === 'w' ? '0-1' : '1-0';
  endGame(result, 'timeout');
}

// 5-second countdown FX (R7)
function onLowTime(sec, side) {
  if (!curGame || curGame.isOver) return;
  const isHumanTurn = curGame.mode === 'pvp' || (curGame.humanSide === (side === 1 ? 'w' : 'b'));
  if (!isHumanTurn) return;

  if (settings.countdownFx) {
    const overlay = document.getElementById('countdown-overlay');
    const numEl = document.getElementById('countdown-num');
    const glow = document.getElementById('board-glow');
    if (overlay && numEl && glow) {
      overlay.style.display = 'flex';
      glow.style.display = 'block';
      numEl.textContent = sec;
      numEl.style.animation = 'none';
      void numEl.offsetWidth; // Trigger reflow
      numEl.style.animation = 'countPop 1s cubic-bezier(.34, 1.56, .64, 1) forwards';
    }
  }

  playSound('countdown', sec);
  if (settings.vibrate && navigator.vibrate) {
    navigator.vibrate(sec === 0 ? [60, 40, 120] : 30);
  }
}

function stopCountdownFX() {
  const overlay = document.getElementById('countdown-overlay');
  const glow = document.getElementById('board-glow');
  if (overlay) overlay.style.display = 'none';
  if (glow) glow.style.display = 'none';
}

function onClockTick(wMs, bMs, activeSide) {
  const topClock = document.getElementById('top-clock');
  const bottomClock = document.getElementById('bottom-clock');
  if (!topClock || !bottomClock) return;

  const isWhiteBottom = (curGame.mode === 'pvp' && !isFlipped) || (curGame.mode === 'pve' && curGame.humanSide === 'w');
  const whiteClockEl = isWhiteBottom ? bottomClock : topClock;
  const blackClockEl = isWhiteBottom ? topClock : bottomClock;

  whiteClockEl.textContent = formatClock(wMs);
  blackClockEl.textContent = formatClock(bMs);

  whiteClockEl.classList.toggle('active', activeSide === 1);
  blackClockEl.classList.toggle('active', activeSide === -1);

  whiteClockEl.classList.toggle('danger', wMs <= 10000 && curGame.timerConfig.kind !== 'off');
  blackClockEl.classList.toggle('danger', bMs <= 10000 && curGame.timerConfig.kind !== 'off');
}

function formatClock(ms) {
  if (curGame && curGame.timerConfig.kind === 'off') return '--:--';
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 10) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${totalSec}.${tenths}`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// UI Updating & DOM Helpers
function canUndoGame() {
  if (!curGame || curGame.isReplay || !curGame.allowUndo) return false;
  if (curGame.mode === 'pvp') {
    return curGame.moves.length > 0;
  }
  // PvE:
  if (isAIThinking) {
    return curGame.humanSide === 'b' ? curGame.moves.length >= 2 : curGame.moves.length >= 1;
  }
  return curGame.moves.length >= 2;
}

function updateUndoButtons() {
  const canUndo = canUndoGame();
  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) {
    btnUndo.disabled = !canUndo;
    btnUndo.style.opacity = canUndo ? '1' : '0.4';
    btnUndo.style.pointerEvents = canUndo ? 'auto' : 'none';
  }
  const btnSideUndo = document.getElementById('btn-side-undo');
  if (btnSideUndo) {
    btnSideUndo.disabled = !canUndo;
    btnSideUndo.style.opacity = canUndo ? '1' : '0.4';
    btnSideUndo.style.pointerEvents = canUndo ? 'auto' : 'none';
  }
}

function updateUI() {
  if (!curGame) return;
  updateStatusLine();
  updateMoveLists();
  updateCapturedTrays();
  updatePlayerBars();
  updateOverlays();
  updateUndoButtons();
}

function updateStatusLine() {
  const line = document.getElementById('game-status-line');
  const sideLine = document.getElementById('side-status');
  if (!line) return;

  let txt = '';
  if (curGame.isOver) {
    txt = curGame.result === '1-0' ? 'Trắng thắng!' : curGame.result === '0-1' ? 'Đen thắng!' : 'Hoà!';
  } else if (isAIThinking) {
    txt = 'Máy đang nghĩ…';
  } else if (ChessRules.inCheck(curGame.state, curGame.state.turn)) {
    txt = 'Chiếu!';
  } else {
    txt = curGame.state.turn === 1 ? 'Lượt của Trắng' : 'Lượt của Đen';
  }

  line.textContent = txt;
  if (sideLine) sideLine.textContent = txt;
}

function updatePlayerBars() {
  const topName = document.getElementById('top-name');
  const bottomName = document.getElementById('bottom-name');
  const topAvatar = document.getElementById('top-avatar');
  const bottomAvatar = document.getElementById('bottom-avatar');

  if (curGame.mode === 'pve') {
    if (curGame.humanSide === 'w') {
      bottomName.textContent = 'Bạn (Trắng)';
      topName.textContent = `Máy (${curGame.aiLevel === 'easy' ? 'Dễ' : curGame.aiLevel === 'medium' ? 'Vừa' : 'Khó'})`;
      bottomAvatar.className = 'player-avatar white';
      bottomAvatar.textContent = '♔';
      topAvatar.className = 'player-avatar black';
      topAvatar.textContent = '♚';
    } else {
      bottomName.textContent = 'Bạn (Đen)';
      topName.textContent = `Máy (${curGame.aiLevel === 'easy' ? 'Dễ' : curGame.aiLevel === 'medium' ? 'Vừa' : 'Khó'})`;
      bottomAvatar.className = 'player-avatar black';
      bottomAvatar.textContent = '♚';
      topAvatar.className = 'player-avatar white';
      topAvatar.textContent = '♔';
    }
  } else {
    bottomName.textContent = isFlipped ? 'Đen' : 'Trắng';
    topName.textContent = isFlipped ? 'Trắng' : 'Đen';
    bottomAvatar.className = isFlipped ? 'player-avatar black' : 'player-avatar white';
    bottomAvatar.textContent = isFlipped ? '♚' : '♔';
    topAvatar.className = isFlipped ? 'player-avatar white' : 'player-avatar black';
    topAvatar.textContent = isFlipped ? '♔' : '♚';
  }
}

function updateCapturedTrays() {
  const topTray = document.getElementById('top-tray');
  const bottomTray = document.getElementById('bottom-tray');
  if (!topTray || !bottomTray) return;

  // Count captured pieces by comparing starting pieces to current board
  const counts = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1, '-1': 8, '-2': 2, '-3': 2, '-4': 2, '-5': 1 };
  for (let sq = 0; sq < 64; sq++) {
    const p = curGame.state.board[sq];
    if (p !== 0 && Math.abs(p) !== 6) {
      if (counts[p] > 0) counts[p]--;
    }
  }

  let wCaptured = ''; // White captured pieces (lost by Black)
  let bCaptured = ''; // Black captured pieces (lost by White)
  const symbols = { 1: '♙', 2: '♘', 3: '♗', 4: '♖', 5: '♕' };

  for (let t = 5; t >= 1; t--) {
    for (let i = 0; i < counts[-t]; i++) wCaptured += symbols[t];
    for (let i = 0; i < counts[t]; i++) bCaptured += symbols[t];
  }

  const isWhiteBottom = (curGame.mode === 'pve' && curGame.humanSide === 'w') || (!isFlipped && curGame.mode === 'pvp');
  bottomTray.textContent = isWhiteBottom ? wCaptured : bCaptured;
  topTray.textContent = isWhiteBottom ? bCaptured : wCaptured;
}

function updateMoveLists() {
  const sideList = document.getElementById('side-move-list');
  if (!sideList) return;
  sideList.innerHTML = '';

  const moves = curGame.moves;
  for (let i = 0; i < moves.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = Math.floor(i / 2) + 1;
    const wMove = moves[i] ? moves[i].san : '';
    const bMove = moves[i + 1] ? moves[i + 1].san : '';

    row.innerHTML = `
      <span class="num">${num}.</span>
      <span class="move-cell ${i === moves.length - 1 ? 'current' : ''}">${wMove}</span>
      <span class="move-cell ${i + 1 === moves.length - 1 ? 'current' : ''}">${bMove}</span>
    `;
    sideList.appendChild(row);
  }
  sideList.scrollTop = sideList.scrollHeight;
}

// Promotion Dialog
function showPromoDialog(move, onPick) {
  const dialog = document.getElementById('dialog-promo');
  const container = document.getElementById('promo-options');
  container.innerHTML = '';

  const pieces = [
    { type: ChessRules.Q, name: 'Hậu / Queen', key: 'queen' },
    { type: ChessRules.R, name: 'Xe / Rook', key: 'rook' },
    { type: ChessRules.B, name: 'Tượng / Bishop', key: 'bishop' },
    { type: ChessRules.N, name: 'Mã / Knight', key: 'knight' },
  ];

  pieces.forEach((p) => {
    const btn = document.createElement('div');
    btn.className = 'promo-item';
    btn.innerHTML = `
      <svg viewBox="0 0 32 32">${GLYPHS[p.key]}</svg>
      <span style="font-size:var(--fs-xs); font-weight:600;">${p.name}</span>
    `;
    btn.onclick = () => {
      dialog.close();
      onPick(p.type);
    };
    container.appendChild(btn);
  });

  dialog.showModal();
}

function showGameOverDialog(result, reason) {
  const dialog = document.getElementById('dialog-game-over');
  const title = document.getElementById('game-over-title');
  const desc = document.getElementById('game-over-desc');
  const link = document.getElementById('link-game-over-rule');

  title.textContent = result === '1-0' ? 'Trắng thắng!' : result === '0-1' ? 'Đen thắng!' : 'Hoà cờ!';
  const reasonMap = {
    checkmate: 'Chiếu hết',
    stalemate: 'Hết nước đi hợp lệ (Pat)',
    threefold: 'Lặp lại thế cờ 3 lần',
    fifty: 'Luật 50 nước',
    insufficient: 'Không đủ quân chiếu hết',
    timeout: 'Hết thời gian',
    resign: 'Đối phương đầu hàng',
  };
  desc.textContent = `Lý do: ${reasonMap[reason] || reason}`;

  // Link to relevant rule section
  const ruleSectionMap = {
    stalemate: '#rules/stalemate',
    threefold: '#rules/draws',
    fifty: '#rules/draws',
    insufficient: '#rules/draws',
    timeout: '#rules/endings',
    checkmate: '#rules/checkmate',
  };
  if (ruleSectionMap[reason]) {
    link.href = ruleSectionMap[reason];
    link.style.display = 'inline';
  } else {
    link.style.display = 'none';
  }

  dialog.showModal();
}

// Persistence: autosave & history
function saveAutosave() {
  if (!curGame || curGame.isOver) return;
  store.set('current', {
    v: 1,
    session: {
      id: curGame.id,
      mode: curGame.mode,
      aiLevel: curGame.aiLevel,
      humanSide: curGame.humanSide,
      timerConfig: curGame.timerConfig,
      allowUndo: curGame.allowUndo,
      startFEN: curGame.startFEN,
      moves: curGame.moves,
    },
  });
}

function saveRecord() {
  if (!curGame) return;
  const records = store.get('records', { v: 1, games: [] });
  const rec = {
    v: 1,
    id: curGame.id,
    startedAt: curGame.id,
    endedAt: Date.now().toString(),
    mode: curGame.mode,
    aiLevel: curGame.aiLevel,
    humanSide: curGame.humanSide,
    timer: curGame.timerConfig,
    startFEN: curGame.startFEN || ChessRules.toFEN(ChessRules.initial()),
    moves: curGame.moves,
    status: curGame.result === '1/2-1/2' ? 'draw' : 'win',
    winner: curGame.result === '1-0' ? 'w' : curGame.result === '0-1' ? 'b' : null,
    loser: curGame.result === '1-0' ? 'b' : curGame.result === '0-1' ? 'w' : null,
    reason: curGame.reason,
    pgn: ChessRules.toPGN({ moves: curGame.moves.map((m) => m.san) }),
  };
  records.games.unshift(rec);
  if (records.games.length > 200) records.games.pop(); // Cap 200
  store.set('records', records);
}

// Rules Page Renderer (15 sections + Mini boards + Try-it)
function renderRulesPage() {
  const toc = document.getElementById('rules-toc');
  const content = document.getElementById('rules-content');
  if (!toc || !content || !window.RULES_SECTIONS) return;

  toc.innerHTML = '';
  content.innerHTML = '';
  const lang = (window.House && window.House.i18n) ? window.House.i18n.lang : 'vi';

  window.RULES_SECTIONS.forEach((sec, idx) => {
    // TOC Chip
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = sec.title[lang] || sec.title.vi;
    chip.onclick = () => {
      document.querySelectorAll('.rules-toc-chips .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const el = document.getElementById('sec-' + sec.id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
    toc.appendChild(chip);

    // Section Card
    const card = document.createElement('div');
    card.id = 'sec-' + sec.id;
    card.className = 'panel rule-card';
    card.innerHTML = `<h3>${sec.title[lang] || sec.title.vi}</h3><p style="font-weight:600; color:var(--muted);">${sec.summary[lang] || sec.summary.vi}</p>`;

    sec.blocks.forEach((block) => {
      if (block.type === 'p') {
        const p = document.createElement('p');
        p.textContent = block.text[lang] || block.text.vi;
        card.appendChild(p);
      } else if (block.type === 'board') {
        const boardEl = createMiniBoard(block.fen, block.highlights || [], block.crosses || []);
        card.appendChild(boardEl);
        if (block.caption) {
          const cap = document.createElement('div');
          cap.style.cssText = 'font-size:var(--fs-xs); color:var(--muted); text-align:center; margin-top:4px;';
          cap.textContent = block.caption[lang] || block.caption.vi;
          card.appendChild(cap);
        }
      } else if (block.type === 'tryit') {
        const tryBox = document.createElement('div');
        tryBox.className = 'tryit-box';
        tryBox.innerHTML = `<strong>Thử ngay / Try it:</strong><div style="font-size:var(--fs-xs); color:var(--muted); margin:4px 0 8px;">${block.caption[lang] || block.caption.vi}</div>`;

        let tryState = ChessRules.fromFEN(block.fen);
        let miniSelected = -1;
        const feedback = document.createElement('div');
        feedback.className = 'tryit-feedback';

        const updateMini = () => {
          const oldBoard = tryBox.querySelector('.mini-board-wrap');
          if (oldBoard) oldBoard.remove();

          const bEl = createInteractiveMiniBoard(tryState, miniSelected, (clickedSq) => {
            initAudio();
            if (miniSelected >= 0) {
              const uci = ChessRules.toCoord(miniSelected) + ChessRules.toCoord(clickedSq);
              const legals = ChessRules.legalMoves(tryState);
              const target = legals.find((m) => ChessRules.toUCI(m).startsWith(uci));

              if (target && block.solution.includes(ChessRules.toUCI(target))) {
                tryState = ChessRules.make(tryState, target);
                miniSelected = -1;
                updateMini();
                playSound('place', 1);
                feedback.className = 'tryit-feedback success';
                feedback.textContent = 'Chính xác! Nước đi rất hay.';
                // Mark try-it done
                markRuleDone(sec.id);
              } else {
                playSound('invalid');
                feedback.className = 'tryit-feedback wrong';
                feedback.textContent = block.whyWrong[lang] || block.whyWrong.vi;
                miniSelected = -1;
                updateMini();
              }
            } else {
              const p = tryState.board[clickedSq];
              if (p !== 0 && p * tryState.turn > 0) {
                miniSelected = clickedSq;
                updateMini();
              }
            }
          });
          tryBox.insertBefore(bEl, feedback);
        };

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn';
        retryBtn.style.cssText = 'margin-top:8px; font-size:var(--fs-xs); min-height:36px;';
        retryBtn.textContent = 'Làm lại';
        retryBtn.onclick = () => {
          tryState = ChessRules.fromFEN(block.fen);
          miniSelected = -1;
          feedback.textContent = '';
          updateMini();
        };

        tryBox.appendChild(feedback);
        tryBox.appendChild(retryBtn);
        card.appendChild(tryBox);
        updateMini();
      } else if (block.type === 'glossary') {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; font-size:var(--fs-sm); margin-top:8px;';
        table.innerHTML = '<tr style="border-bottom:1px solid var(--line); text-align:left;"><th>Tiếng Việt</th><th>English</th><th>Mô tả</th></tr>';
        block.terms.forEach((t) => {
          const row = document.createElement('tr');
          row.style.borderBottom = '1px solid var(--line)';
          row.innerHTML = `<td style="padding:6px 4px; font-weight:600;">${t.vi}</td><td style="padding:6px 4px;">${t.en}</td><td style="padding:6px 4px; color:var(--muted);">${t.desc}</td>`;
          table.appendChild(row);
        });
        card.appendChild(table);
      }
    });

    content.appendChild(card);
  });
}

function createMiniBoard(fen, highlights = [], crosses = []) {
  const wrap = document.createElement('div');
  wrap.className = 'mini-board-wrap';
  const state = ChessRules.fromFEN(fen);
  const cs = getComputedStyle(document.documentElement);

  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = (r << 3) | f;
      const coord = ChessRules.toCoord(sq);
      const isLight = ((r + f) % 2) === 1;

      const sqEl = document.createElement('div');
      sqEl.className = `mini-sq ${isLight ? 'light' : 'dark'}`;
      if (highlights.includes(coord)) sqEl.classList.add('highlight');
      if (crosses.includes(coord)) sqEl.classList.add('cross');

      const piece = state.board[sq];
      if (piece !== 0) {
        const type = PIECE_TYPE_MAP[Math.abs(piece)];
        const isWhite = piece > 0;
        const ink = cs.getPropertyValue(isWhite ? '--piece-light-ink' : '--piece-dark-ink').trim() || (isWhite ? '#2B2622' : '#F3EDE2');
        const disc = cs.getPropertyValue(isWhite ? '--piece-light' : '--piece-dark').trim() || (isWhite ? '#FBF8F2' : '#2B2622');
        sqEl.innerHTML = `<svg class="mini-glyph" viewBox="0 0 32 32" style="background:${disc}; border-radius:50%; border:1.5px solid ${ink}; color:${ink};">${GLYPHS[type]}</svg>`;
      }
      wrap.appendChild(sqEl);
    }
  }
  return wrap;
}

function createInteractiveMiniBoard(state, selectedSq, onSquareClick) {
  const wrap = document.createElement('div');
  wrap.className = 'mini-board-wrap';
  const legals = selectedSq >= 0 ? ChessRules.legalMovesFrom(state, selectedSq) : [];
  const cs = getComputedStyle(document.documentElement);

  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = (r << 3) | f;
      const isLight = ((r + f) % 2) === 1;

      const sqEl = document.createElement('button');
      sqEl.className = `mini-sq ${isLight ? 'light' : 'dark'}`;
      if (sq === selectedSq) sqEl.classList.add('highlight');
      if (legals.some((m) => m.to === sq)) sqEl.classList.add('dot');

      const piece = state.board[sq];
      if (piece !== 0) {
        const type = PIECE_TYPE_MAP[Math.abs(piece)];
        const isWhite = piece > 0;
        const ink = cs.getPropertyValue(isWhite ? '--piece-light-ink' : '--piece-dark-ink').trim();
        const disc = cs.getPropertyValue(isWhite ? '--piece-light' : '--piece-dark').trim();
        sqEl.innerHTML = `<svg class="mini-glyph" viewBox="0 0 32 32" style="background:${disc}; border-radius:50%; border:1.5px solid ${ink}; color:${ink};">${GLYPHS[type]}</svg>`;
      }

      sqEl.onclick = () => onSquareClick(sq);
      wrap.appendChild(sqEl);
    }
  }
  return wrap;
}

function markRuleDone(secId) {
  const seen = store.get('hintsSeen', { rulesDone: [] });
  if (!seen.rulesDone) seen.rulesDone = [];
  if (!seen.rulesDone.includes(secId)) {
    seen.rulesDone.push(secId);
    store.set('hintsSeen', seen);
  }
}

// Router and Navigation
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('hidden', el.id !== screenId);
  });
  if (screenId === 'rules-screen') {
    renderRulesPage();
  }
}

function handleRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#rules')) {
    if (curGame && curGame.clock) curGame.clock.pause();
    showScreen('rules-screen');
    const part = hash.replace('#rules/', '');
    if (part && part !== '#rules') {
      setTimeout(() => {
        const target = document.getElementById('sec-' + part);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  } else {
    if (curGame && !curGame.isOver) {
      showScreen('game-screen');
      if (curGame.clock) curGame.clock.resume();
    } else {
      showScreen('start-screen');
    }
  }
}

// Settings Dialog Controls
function openSettingsDialog() {
  syncSettingsUI();
  document.getElementById('dialog-settings').showModal();
}

function syncSettingsUI() {
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setChk('chk-countdown-fx', settings.countdownFx);
  setChk('chk-vibrate', settings.vibrate);
  setChk('chk-legal-dots', settings.legalDots);
  setChk('chk-coords', settings.coords);
  setChk('chk-auto-queen', settings.autoQueen);
  const undoVal = curGame ? (curGame.allowUndo !== false) : (settings.allowUndo !== false);
  setChk('chk-undo', undoVal);
  setChk('chk-pvp-undo', undoVal);
  setChk('chk-rotate-pvp', settings.rotatePvp);
  setChk('chk-rule-hints', settings.ruleHints);
  setChk('chk-sfx', settings.sfx);
  setChk('chk-music', settings.music);

  const timerKind = settings.timer ? settings.timer.kind : 'off';
  const segTimer = document.getElementById('seg-settings-timer');
  if (segTimer) {
    segTimer.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === timerKind);
    });
  }

  const prefs = window.House ? window.House.prefs.load() : { theme: 'giay', lang: 'vi' };
  const segTheme = document.getElementById('seg-theme');
  if (segTheme) {
    segTheme.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === prefs.theme);
    });
  }
  const segLang = document.getElementById('seg-lang');
  if (segLang) {
    segLang.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === prefs.lang);
    });
  }
}

function bindSettingsEvents() {
  const bindChk = (id, key, onToggle) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = () => {
      settings[key] = el.checked;
      store.set('settings', settings);
      if (onToggle) onToggle(el.checked);
    };
  };

  bindChk('chk-countdown-fx', 'countdownFx');
  bindChk('chk-vibrate', 'vibrate');
  bindChk('chk-legal-dots', 'legalDots', () => updateOverlays());
  bindChk('chk-coords', 'coords', () => buildBoard());
  bindChk('chk-auto-queen', 'autoQueen');
  const onUndoToggle = (v) => {
    settings.allowUndo = v;
    settings.pvpUndo = v;
    store.set('settings', settings);
    if (curGame) {
      curGame.allowUndo = v;
      updateUI();
    }
  };
  bindChk('chk-undo', 'allowUndo', onUndoToggle);
  bindChk('chk-pvp-undo', 'pvpUndo', onUndoToggle);
  bindChk('chk-rotate-pvp', 'rotatePvp');
  bindChk('chk-rule-hints', 'ruleHints');
  bindChk('chk-sfx', 'sfx', (v) => {
    if (sfxGain) sfxGain.gain.value = v ? 0.7 : 0;
  });
  bindChk('chk-music', 'music', (v) => {
    if (musicGain) musicGain.gain.value = v ? 0.5 : 0;
    if (v) startBgm(); else stopBgm();
  });

  const segTimer = document.getElementById('seg-settings-timer');
  if (segTimer) {
    segTimer.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      segTimer.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.val;
      settings.timer = settings.timer || {};
      settings.timer.kind = val;
      if (val === 'move') settings.timer.perMoveMs = 30000;
      else if (val === 'game') settings.timer.baseMs = 600000;
      store.set('settings', settings);
    };
  }

  const btnCopyPgn = document.getElementById('btn-copy-pgn');
  if (btnCopyPgn) {
    btnCopyPgn.onclick = () => {
      if (!curGame) {
        alert('Chưa có ván cờ nào!');
        return;
      }
      const pgn = ChessRules.toPGN({ moves: curGame.moves.map((m) => m.san) });
      if (navigator.clipboard) {
        navigator.clipboard.writeText(pgn).then(() => {
          alert('Đã sao chép PGN vào bộ nhớ tạm!');
        }).catch(() => {
          prompt('PGN:', pgn);
        });
      } else {
        prompt('PGN:', pgn);
      }
    };
  }
}

// App Initialization
function initApp() {
  const prefs = window.House ? window.House.prefs.load() : { theme: 'giay', lang: 'vi' };
  if (window.House) {
    window.House.applyTheme(prefs.theme);
    window.House.i18n.setLang(prefs.lang);
  }

  initThree();

  // Check autosave
  const autosave = store.get('current');
  const resumeBtn = document.getElementById('btn-resume');
  if (autosave && autosave.session) {
    resumeBtn.style.display = 'inline-flex';
  }

  // Event Listeners
  const openNewGame = () => {
    initAudio();
    const segUndo = document.getElementById('seg-new-undo');
    if (segUndo) {
      const isUndoOn = curGame ? (curGame.allowUndo !== false) : (settings.allowUndo !== false);
      segUndo.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', (b.dataset.val === 'on') === isUndoOn);
      });
    }
    document.getElementById('dialog-new-game').showModal();
  };
  document.getElementById('btn-play').onclick = openNewGame;

  resumeBtn.onclick = () => {
    initAudio();
    const save = store.get('current');
    if (save && save.session) {
      startNewGame(save.session);
      // Replay moves
      for (const m of save.session.moves) {
        const realMove = ChessRules.fromUCI(curGame.state, m.uci);
        if (realMove) curGame.state = ChessRules.make(curGame.state, realMove);
      }
      curGame.moves = save.session.moves;
      syncBoard3D();
      updateUI();
    }
  };

  document.getElementById('btn-rules').onclick = () => {
    window.location.hash = '#rules';
  };
  document.getElementById('btn-game-rules').onclick = () => {
    window.location.hash = '#rules';
  };
  document.getElementById('btn-rules-back').onclick = () => {
    window.location.hash = '';
    handleRoute();
  };

  // Settings handlers
  bindSettingsEvents();

  const openSettings = () => {
    const dMenu = document.getElementById('dialog-menu');
    if (dMenu && dMenu.open) dMenu.close();
    openSettingsDialog();
  };
  ['btn-start-settings', 'btn-desktop-settings', 'btn-menu-settings'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onclick = openSettings;
  });
  document.getElementById('btn-close-settings').onclick = () => {
    document.getElementById('dialog-settings').close();
  };

  // History handlers
  const openHistory = () => {
    const dMenu = document.getElementById('dialog-menu');
    if (dMenu && dMenu.open) dMenu.close();
    const dOver = document.getElementById('dialog-game-over');
    if (dOver && dOver.open) dOver.close();
    showHistoryDialog();
  };
  ['btn-history', 'btn-menu-history', 'btn-side-history', 'btn-over-history'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onclick = openHistory;
  });
  document.getElementById('btn-close-history').onclick = () => {
    document.getElementById('dialog-history').close();
  };

  const segHist = document.getElementById('seg-history-filter');
  if (segHist) {
    segHist.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      segHist.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      showHistoryDialog(btn.dataset.filter || 'all');
    };
  }

  // Menu handlers
  const openMenu = () => {
    document.getElementById('dialog-menu').showModal();
  };
  ['btn-menu', 'btn-side-menu'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onclick = openMenu;
  });
  document.getElementById('btn-menu-close').onclick = () => {
    document.getElementById('dialog-menu').close();
  };

  const handleResign = () => {
    const dMenu = document.getElementById('dialog-menu');
    if (dMenu && dMenu.open) dMenu.close();
    if (!curGame || curGame.isOver) return;
    if (confirm('Bạn có chắc muốn đầu hàng?')) {
      endGame(curGame.humanSide === 'w' ? '0-1' : '1-0', 'resign');
    }
  };
  ['btn-menu-resign', 'btn-side-resign'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onclick = handleResign;
  });

  document.getElementById('btn-menu-new').onclick = () => {
    document.getElementById('dialog-menu').close();
    openNewGame();
  };

  // Mobile side panel drawer toggle
  const sidePanel = document.getElementById('side-panel');
  const btnShowMoves = document.getElementById('btn-show-moves');
  if (btnShowMoves && sidePanel) {
    btnShowMoves.onclick = () => {
      sidePanel.classList.toggle('open');
    };
  }
  const btnCloseSide = document.getElementById('btn-close-side-panel');
  if (btnCloseSide && sidePanel) {
    btnCloseSide.onclick = () => {
      sidePanel.classList.remove('open');
    };
  }

  function handleUndo() {
    if (!canUndoGame()) return;
    if (curGame.isOver) {
      const dOver = document.getElementById('dialog-game-over');
      if (dOver && dOver.open) dOver.close();
      curGame.isOver = false;
      curGame.result = null;
      curGame.reason = null;
    }

    animList = [];
    if (curGame.mode === 'pve') {
      if (isAIThinking) {
        currentSearchId++;
        isAIThinking = false;
        curGame.moves.pop();
      } else {
        curGame.moves.pop(); // bot move
        if (curGame.moves.length > 0) {
          curGame.moves.pop(); // my move
        }
      }
    } else {
      curGame.moves.pop();
    }

    selectedSq = -1;
    legalMovesForSelected = [];
    curGame.state = ChessRules.fromFEN(curGame.startFEN);
    for (const m of curGame.moves) {
      const realM = ChessRules.fromUCI(curGame.state, m.uci);
      if (realM) curGame.state = ChessRules.make(curGame.state, realM);
    }

    if (curGame.clock) {
      if (curGame.moves.length > 0) {
        const lastM = curGame.moves[curGame.moves.length - 1];
        if (lastM && lastM.clock) {
          curGame.clock.wMs = lastM.clock[0];
          curGame.clock.bMs = lastM.clock[1];
        }
      } else {
        curGame.clock.wMs = curGame.timerConfig.kind === 'move' ? curGame.timerConfig.perMoveMs : curGame.timerConfig.baseMs;
        curGame.clock.bMs = curGame.timerConfig.kind === 'move' ? curGame.timerConfig.perMoveMs : curGame.timerConfig.baseMs;
        curGame.clock.started = false;
      }
      curGame.clock.activeSide = curGame.state.turn;
      if (curGame.timerConfig.kind !== 'off' && curGame.clock.started) {
        curGame.clock.resume();
      }
    }

    playSound('place', 1);
    syncBoard3D();
    updateUI();
    saveAutosave();
  }

  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) btnUndo.onclick = handleUndo;
  const btnSideUndo = document.getElementById('btn-side-undo');
  if (btnSideUndo) btnSideUndo.onclick = handleUndo;

  // Start Game button inside Dialog New Game
  document.getElementById('btn-cancel-new-game').onclick = () => {
    document.getElementById('dialog-new-game').close();
  };
  document.getElementById('btn-start-game').onclick = () => {
    const mode = document.querySelector('#seg-mode button.active').dataset.val;
    const aiLevel = document.querySelector('#seg-ai button.active').dataset.val;
    const humanSide = document.querySelector('#seg-side button.active').dataset.val;
    const timerKind = document.querySelector('#seg-timer-kind button.active').dataset.val;
    const undoBtn = document.querySelector('#seg-new-undo button.active');
    const allowUndo = undoBtn ? (undoBtn.dataset.val === 'on') : (settings.allowUndo !== false);

    let timer = { kind: timerKind, perMoveMs: 30000, baseMs: 600000, incMs: 0 };
    if (timerKind === 'move') timer.perMoveMs = 30000;
    else if (timerKind === 'game') timer.baseMs = 600000;

    document.getElementById('dialog-new-game').close();
    startNewGame({ mode, aiLevel, humanSide, timer, allowUndo });
  };

  // Segmented controls handler
  document.querySelectorAll('.segmented').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (seg.id === 'seg-theme') {
        window.House.prefs.save({ theme: btn.dataset.val });
        window.House.applyTheme(btn.dataset.val);
      } else if (seg.id === 'seg-lang') {
        window.House.prefs.save({ lang: btn.dataset.val });
        window.House.i18n.setLang(btn.dataset.val);
        renderRulesPage();
      }
    });
  });

  // Settings resets
  document.getElementById('btn-reset-data').onclick = () => {
    if (confirm('Khôi phục toàn bộ cài đặt cờ vua về mặc định?')) {
      store.removeAll();
      location.reload();
    }
  };

  document.getElementById('btn-clear-history').onclick = () => {
    if (confirm('Xoá toàn bộ lịch sử đấu?')) {
      store.set('records', { v: 1, games: [] });
      showHistoryDialog();
    }
  };

  document.getElementById('btn-rematch').onclick = () => {
    document.getElementById('dialog-game-over').close();
    startNewGame(curGame);
  };
  document.getElementById('btn-over-new').onclick = () => {
    document.getElementById('dialog-game-over').close();
    openNewGame();
  };
  document.getElementById('btn-over-replay').onclick = () => {
    document.getElementById('dialog-game-over').close();
    enterReplayMode(curGame.moves, curGame.startFEN);
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Run in-page self-test if ?test is present
  if (window.location.search.includes('test')) {
    runInPageTests();
  }
}

let currentHistoryFilter = 'all';

function showHistoryDialog(filter = currentHistoryFilter) {
  currentHistoryFilter = filter;
  const dialog = document.getElementById('dialog-history');
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const records = store.get('records', { v: 1, games: [] });
  const allGames = records.games || [];
  const games = allGames.filter(g => filter === 'all' || g.mode === filter);

  if (games.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--muted); padding:20px;">Chưa có ván đấu nào.</div>';
  } else {
    games.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'panel';
      row.style.cssText = 'padding:10px 14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;';
      const outcome = g.status === 'draw' ? 'Hoà' : g.winner === g.humanSide ? 'Thắng' : 'Thua';
      row.innerHTML = `
        <div>
          <div style="font-weight:700;">${g.mode === 'pve' ? 'Vs Máy (' + (g.aiLevel || 'vừa') + ')' : 'Hai người'}</div>
          <div style="font-size:var(--fs-xs); color:var(--muted);">${g.reason || ''} • ${(g.moves || []).length} nước</div>
        </div>
        <div class="chip" style="font-weight:700; ${outcome === 'Thắng' ? 'background:var(--ok); color:#fff;' : outcome === 'Thua' ? 'background:var(--danger); color:#fff;' : ''}">${outcome}</div>
      `;
      row.onclick = () => {
        dialog.close();
        enterReplayMode(g.moves || [], g.startFEN);
      };
      list.appendChild(row);
    });
  }
  dialog.showModal();
}

function enterReplayMode(moves, startFEN = null) {
  const fen = startFEN || (curGame && curGame.startFEN) || ChessRules.toFEN(ChessRules.initial());
  const wasOver = !curGame || curGame.isOver;

  if (!curGame) {
    curGame = {
      id: Date.now().toString(),
      mode: 'pvp',
      aiLevel: 'medium',
      humanSide: 'w',
      timerConfig: { kind: 'off' },
      state: ChessRules.fromFEN(fen),
      startFEN: fen,
      moves: moves || [],
      isOver: true,
      result: null,
      reason: null,
      isReplay: true,
      clock: new ClockController({ kind: 'off' }, () => {}, () => {}, () => {}),
    };
  } else {
    curGame.isReplay = true;
    if (curGame.clock) curGame.clock.pause();
  }

  showScreen('game-screen');
  buildBoard();

  let ply = 0;
  const bar = document.getElementById('replay-bar');
  const slider = document.getElementById('replay-slider');
  const bPlay = document.getElementById('btn-replay-play');
  let playTimer = null;

  if (bar) bar.style.display = 'flex';
  if (slider) {
    slider.max = moves ? moves.length : 0;
    slider.value = 0;
  }

  const stopPlay = () => {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    if (bPlay) bPlay.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  };

  const stepTo = (targetPly) => {
    if (!moves) return;
    ply = Math.max(0, Math.min(moves.length, targetPly));
    if (slider) slider.value = ply;
    curGame.state = ChessRules.fromFEN(fen);
    for (let i = 0; i < ply; i++) {
      const m = ChessRules.fromUCI(curGame.state, moves[i].uci);
      if (m) curGame.state = ChessRules.make(curGame.state, m);
    }
    syncBoard3D();
    updateUI();
  };

  document.getElementById('btn-replay-start').onclick = () => { stopPlay(); stepTo(0); };
  document.getElementById('btn-replay-prev').onclick = () => { stopPlay(); stepTo(ply - 1); };
  document.getElementById('btn-replay-next').onclick = () => { stopPlay(); stepTo(ply + 1); };
  document.getElementById('btn-replay-end').onclick = () => { stopPlay(); stepTo(moves ? moves.length : 0); };
  if (slider) {
    slider.oninput = (e) => {
      stopPlay();
      stepTo(parseInt(e.target.value, 10));
    };
  }

  if (bPlay) {
    bPlay.onclick = () => {
      if (playTimer) {
        stopPlay();
      } else {
        bPlay.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        playTimer = setInterval(() => {
          if (ply < (moves ? moves.length : 0)) {
            stepTo(ply + 1);
          } else {
            stopPlay();
          }
        }, 750);
      }
    };
  }

  document.getElementById('btn-replay-exit').onclick = () => {
    stopPlay();
    if (bar) bar.style.display = 'none';
    curGame.isReplay = false;
    if (wasOver) {
      showScreen('start-screen');
    } else {
      stepTo(curGame.moves.length);
      if (curGame.clock) curGame.clock.resume();
    }
  };

  stepTo(0);
}

// In-Page Self Test Runner (?test)
function runInPageTests() {
  console.log('--- STARTING IN-PAGE TESTS ---');
  let pass = 0, fail = 0;
  const assertTest = (desc, cond) => {
    if (cond) {
      console.log('✓ PASS:', desc);
      pass++;
    } else {
      console.error('✗ FAIL:', desc);
      fail++;
    }
  };

  // 1. Perft checks
  const s0 = ChessRules.initial();
  assertTest('Initial perft depth 1 == 20', ChessRules.perft(s0, 1) === 20);
  assertTest('Initial perft depth 2 == 400', ChessRules.perft(s0, 2) === 400);

  // 2. Rulesdocs try-it validation
  window.RULES_SECTIONS.forEach((sec) => {
    sec.blocks.forEach((blk) => {
      if (blk.type === 'tryit') {
        const s = ChessRules.fromFEN(blk.fen);
        const legals = ChessRules.legalMoves(s).map((m) => ChessRules.toUCI(m));
        const hasSol = blk.solution.some((sol) => legals.includes(sol));
        assertTest(`Try-it task in "${sec.id}" has valid legal solution`, hasSol);
      }
    });
  });

  // 3. Storage isolation test
  store.set('test_key', 123);
  assertTest('Storage set works', store.get('test_key') === 123);
  store.remove('test_key');
  assertTest('Storage remove works', store.get('test_key') === null);

  console.log(`\nTests finished: ${pass} passed, ${fail} failed`);
}

// Kickoff
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
