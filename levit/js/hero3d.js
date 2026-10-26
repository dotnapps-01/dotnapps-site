/* LEVIT hero — a rail of real cloth.
 *
 * Every garment is simulated: two sewing-pattern sheets stitched at the seams, pinned to a hanger that swings
 * as a damped pendulum on the rail. Gravity, wind and the hanger's own motion deform the cloth, so folds, drag,
 * overshoot and settle come out of the physics instead of an animation. Pointer sweeps brush the fabric,
 * dragging grabs a hanger, scrolling and a faint breeze push everything.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { Cloth } from './cloth.js';
import { paintFabric, fiberTexture } from './fabrics.js';
import { PATTERNS } from './patterns.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

class Osc {
  constructor(w, z) { this.w = w; this.z = z; this.x = 0; this.v = 0; this.a = 0; }
  step(dt, f = 0) {
    this.a = f - this.w * this.w * this.x - 2 * this.z * this.w * this.v;
    this.v += this.a * dt; this.x += this.v * dt;
    if (Math.abs(this.x) > 1.15) { this.x = Math.sign(this.x) * 1.15; this.v *= -0.25; }
  }
}

/* ------------------------------------------------------------------ the rack */
const RAIL_ANGLE = 0.40;                      // the rail runs away from the camera to the right
const RAIL_DIR = new THREE.Vector3(Math.cos(RAIL_ANGLE), 0, -Math.sin(RAIL_ANGLE));

const RACK = [
  { key: 'knit', pattern: 'knit', color: '#b8561f', s: 0, rotY: 0.0, hanger: 'black', size: 1024,
    mat: { roughness: 0.94, sheen: 1, sheenRoughness: 0.5, sheenColor: 0xffc690, envMapIntensity: 0.55 }, normalK: 1.1, bump: 0.9, hot: [0.3, -0.5, 0.12] },
  { key: 'dress', pattern: 'dress', color: '#15100d', s: 1.35, rotY: 0.2, hanger: 'pale', size: 1024,
    mat: { roughness: 0.4, sheen: 0.8, sheenRoughness: 0.3, sheenColor: 0xffffff, envMapIntensity: 1.3 }, normalK: 1.4, hot: [0.1, -0.7, 0.1] },
  { key: 'shacket', pattern: 'shacket', color: '#6b6a3c', s: 2.7, rotY: 0.24, hanger: 'wood', size: 768,
    mat: { roughness: 0.92, sheen: 0.5, sheenRoughness: 0.6, sheenColor: 0xd8d6a0, envMapIntensity: 0.5 }, normalK: 2.2, bump: 0.7, hot: [-0.3, -0.5, 0.1] },
  { key: 'trouser', pattern: 'trouser', color: '#a58f78', s: 4.05, rotY: 0.28, hanger: 'clip', size: 640,
    mat: { roughness: 0.86, sheen: 0.6, sheenRoughness: 0.55, sheenColor: 0xf0e2cc, envMapIntensity: 0.5 }, normalK: 1.6, bump: 0.6, hot: [0.2, -0.7, 0.1] },
];

/* ------------------------------------------------------------- hangers & hook */
function arms(y0 = -0.19, half = 0.62, th = 0.044, depth = 0.03) {
  const top = (x) => y0 - 0.27 * Math.sqrt(x * x + 0.0009) + 0.27 * 0.03;
  const sh = new THREE.Shape();
  const N = 28;
  sh.moveTo(-half, top(-half));
  for (let i = 1; i <= N; i++) { const x = -half + (2 * half * i) / N; sh.lineTo(x, top(x)); }
  sh.absarc(half, top(half) - th / 2, th / 2, Math.PI / 2, -Math.PI / 2, true);
  for (let i = N; i >= 0; i--) { const x = -half + (2 * half * i) / N; sh.lineTo(x, top(x) - th); }
  sh.absarc(-half, top(-half) - th / 2, th / 2, -Math.PI / 2, -Math.PI * 1.5, true);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function hookGeometry() {
  const pts = [
    [0, -0.20], [0, -0.13], [0.002, -0.085], [0.03, -0.052], [0.068, -0.022], [0.078, 0.025],
    [0.052, 0.072], [0.0, 0.088], [-0.05, 0.066], [-0.074, 0.02], [-0.066, -0.026],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 80, 0.0105, 12, false);
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b98d5b'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 256, w = 0.6 + Math.random() * 2.4, a = 0.05 + Math.random() * 0.22;
    g.strokeStyle = Math.random() < 0.7 ? `rgba(70,40,15,${a})` : `rgba(235,200,150,${a * 0.8})`;
    g.lineWidth = w; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 64) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.2 + (Math.random() - 0.5) * 0.8);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const matBrass = () => new THREE.MeshStandardMaterial({ color: 0xd9b46c, roughness: 0.26, metalness: 1, envMapIntensity: 1.3 });

function buildHanger(type) {
  const g = new THREE.Group();
  const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; f?.(m); g.add(m); return m; };
  if (type === 'clip') {
    const black = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.4, metalness: 0.2 });
    add(new THREE.BoxGeometry(0.72, 0.026, 0.026), black, (m) => m.position.set(0, -0.215, 0));
    add(new THREE.BoxGeometry(0.1, 0.04, 0.018), black, (m) => m.position.set(0, -0.2, 0));
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.075, 0.07, 0.056), black, (m) => m.position.set(sx * 0.27, -0.255, 0));
      add(new THREE.BoxGeometry(0.075, 0.012, 0.062), new THREE.MeshStandardMaterial({ color: 0xbfb9b0, metalness: 1, roughness: 0.3 }), (m) => m.position.set(sx * 0.27, -0.29, 0));
    }
  } else {
    const cfg = {
      black: { color: 0x15110e, rough: 0.36, depth: 0.03, half: 0.62, th: 0.044 },
      pale: { color: 0xe6e0d6, rough: 0.5, depth: 0.026, half: 0.56, th: 0.036 },
      wood: { color: 0xb98d5b, rough: 0.5, depth: 0.04, half: 0.66, th: 0.054 },
    }[type];
    const mat = type === 'wood'
      ? new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 })
      : type === 'pale'
        ? new THREE.MeshPhysicalMaterial({ color: cfg.color, roughness: 0.95, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffffff) })   // flocked velvet
        : new THREE.MeshPhysicalMaterial({ color: cfg.color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.1 });  // black lacquer
    add(arms(-0.19, cfg.half, cfg.th, cfg.depth), mat);
  }
  add(hookGeometry(), matBrass());
  return g;
}

/* ------------------------------------------------- contact-hardening shadows (PCSS)
 * Shadows are sharp where the cloth is close to the wall or to itself and soften with distance, like a real
 * soft light. Replaces the PCF branch of three's directional shadow lookup. */
const PCSS_HELPERS = `
float lvRand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 lvDisk(int i, int n, float rot) { float r = sqrt((float(i) + 0.5) / float(n)); float a = float(i) * 2.39996323 + rot; return r * vec2(cos(a), sin(a)); }
float lvPCSS(sampler2D map, vec2 uv, float zr, vec2 size) {
  float rot = lvRand(uv * size) * 6.2831853;
  float sum = 0.0, cnt = 0.0;
  for (int i = 0; i < 14; i++) {
    float d = unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 14, rot) * 0.0075));
    if (d < zr - 0.0004) { sum += d; cnt += 1.0; }
  }
  if (cnt < 0.5) return 1.0;
  float pen = clamp((zr - sum / cnt) * 0.1, 1.2 / size.x, 0.0062);
  float lit = 0.0;
  for (int i = 0; i < 20; i++) lit += step(zr, unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 20, rot + 1.7) * pen)));
  return lit / 20.0;
}
float getShadow(`;
let shadowChunk = THREE.ShaderChunk.shadowmap_pars_fragment;
if (!shadowChunk.includes('lvPCSS')) {
  shadowChunk = shadowChunk.replace('float getShadow(', PCSS_HELPERS)
    .replace('#if defined( SHADOWMAP_TYPE_PCF )', '#if defined( SHADOWMAP_TYPE_PCF )\n shadow = lvPCSS(shadowMap, shadowCoord.xy, shadowCoord.z, shadowMapSize);\n#elif defined( LV_UNUSED_PCF )');
  THREE.ShaderChunk.shadowmap_pars_fragment = shadowChunk;
}

/* ---------------------------------------------------------------- rendering */
function patchFabric(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb *= 0.66;`);
  };
  mat.customProgramCacheKey = () => 'fabric-inside';
}

function buildSlip() {
  const NS = 22, NT = 14, pos = [], idx = [];
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    const s = -1 + (2 * i) / NS, t = j / NT;
    pos.push(s * (0.27 + 0.04 * t), -0.22 - t * 0.5, 0.012 + 0.012 * (1 - s * s) + 0.008 * Math.sin(s * 6 + t * 3));
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) { const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------- init */
export function initHero({ canvas, hotspots = [], hero, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // the lookup is replaced by PCSS above

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  /* lighting: warm key from the upper left, gold rim from behind (the boutique-sign glow), soft sky fill */
  const key = new THREE.DirectionalLight(0xfff0dc, 2.7);
  key.position.set(-3.2, 3.4, 4.4);
  key.castShadow = true;
  key.shadow.mapSize.set(3072, 3072);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 3.4, bottom: -3.4, near: 1, far: 16 });
  key.shadow.bias = -0.0009; key.shadow.normalBias = 0.03; key.shadow.radius = 6;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffd79a, 1.6); rim.position.set(3.5, 1.4, -3.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd8c2aa, 0.5));

  /* wall (shadow catcher) parallel to the rail */
  const nrm = new THREE.Vector3(Math.sin(RAIL_ANGLE), 0, Math.cos(RAIL_ANGLE));
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.ShadowMaterial({ color: 0x3a2210, opacity: 0.38 }));
  wall.position.copy(nrm).multiplyScalar(-0.95).setY(-0.9);
  wall.rotation.y = RAIL_ANGLE;
  wall.receiveShadow = true;
  scene.add(wall);

  /* rail */
  const railG = new THREE.Group(); railG.rotation.y = RAIL_ANGLE; scene.add(railG);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 30, 28), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.32, metalness: 0.7 }));
  rail.rotation.z = Math.PI / 2; railG.add(rail);

  /* ---- garments ---- */
  const G = [];
  const fiber = fiberTexture(256);
  const slipMat = new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: 0.38, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, envMapIntensity: 0.8 });
  RACK.forEach((spec, k) => {
    const pat = PATTERNS[spec.pattern];
    const swing = new THREE.Group();
    swing.position.copy(RAIL_DIR).multiplyScalar(spec.s);
    scene.add(swing);
    swing.add(buildHanger(spec.hanger));
    const garment = new THREE.Group(); garment.position.set(0, -0.19, 0); swing.add(garment);

    const cloth = new Cloth({
      front: pat.outline(true), back: pat.outline(false), h: pat.h, thick: pat.thick, hangY: pat.hangY, pinZ: 0.024,
      shrink: pat.shrink, iterations: pat.iterations, bend: pat.bend,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cloth.rpos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(cloth.rnorm, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(cloth.rcol, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(cloth.ruv, 2));
    geo.setIndex(new THREE.BufferAttribute(cloth.rindex, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1, 0), 8);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, side: THREE.DoubleSide, vertexColors: true,
      ...spec.mat, roughness: 1, metalness: 1, sheenColor: new THREE.Color(spec.mat.sheenColor),
    });
    if (spec.bump) { material.bumpMap = fiber; material.bumpScale = spec.bump; }
    patchFabric(material);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.visible = false;                         // shown once the cloth has settled
    scene.add(mesh);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, spec.pattern === 'dress' || spec.pattern === 'trouser' ? -0.95 : -0.7, 0);
    hit.userData.g = k; swing.add(hit);

    const anchor = new THREE.Object3D(); anchor.position.set(...spec.hot); garment.add(anchor);
    if (spec.key === 'knit') { const slip = new THREE.Mesh(buildSlip(), slipMat); slip.receiveShadow = true; garment.add(slip); }

    G.push({
      spec, swing, garment, cloth, mesh, hit, anchor, material, ready: false, settle: 0,
      osc: { z: new Osc(3.3 + k * 0.07, 0.045), x: new Osc(3.6 + k * 0.06, 0.06), y: new Osc(2.3, 0.1) },
      phase: k * 2.1, hot: hotspots.find((h) => h.dataset.g === spec.key),
    });
    if (!reduced) { const g = G[k]; g.osc.z.x = (k === 0 ? 0.42 : 0.16) * (k % 2 ? -1 : 1); g.osc.x.x = -0.1; g.osc.y.x = 0.2; }
  });

  /* textures are painted in the background so the page never stalls */
  const painted = new Map();
  function paint(g, color) {
    const spec = g.spec, pat = PATTERNS[spec.pattern];
    const tex = paintFabric({
      kind: spec.key === 'trouser' ? 'trouser' : spec.key, color: color || spec.color,
      poly: pat.outline(true), atlas: g.cloth.atlas, size: spec.size, normalK: spec.normalK, rough: spec.mat.roughness,
      anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    });
    g.material.map?.dispose(); g.material.normalMap?.dispose(); g.material.roughnessMap?.dispose();
    g.material.map = tex.map; g.material.normalMap = tex.normalMap;
    g.material.roughnessMap = g.material.metalnessMap = tex.ormMap;
    g.material.normalScale = new THREE.Vector2(1, 1);
    g.material.needsUpdate = true;
  }
  const queue = [...G];
  function prepareNext() {
    const g = queue.shift();
    if (!g) return;
    paint(g);
    g.swing.updateMatrixWorld(true);
    g.cloth.reset(g.garment.matrixWorld.elements);
    g.ready = true; g.settle = 90;
    g.mesh.visible = true;
    setTimeout(prepareNext, 30);
  }

  /* ---- simulation state ---- */
  const Lh = 0.9;
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, over: -1, has: false, t: 0 };
  const drag = { on: false, g: -1, gy: 0 };
  let spinTarget = 0, spin = 0, scrollVel = 0, lastScroll = scrollY;
  let running = true, last = performance.now(), time = 0, acc = 0, frameNo = 0;
  let quality = 2;                                  // 2 = full, 1 = reduced solver, 0 = far garments frozen
  let slow = 0, simMs = 0;
  let dprCap = matchMedia('(pointer: coarse)').matches ? 1.5 : 2;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmpV = new THREE.Vector3();
  const hits = G.map((g) => g.hit);
  const view = { w: 1, h: 1, tan: Math.tan(THREE.MathUtils.degToRad(14)) };

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = w / h, tan = view.tan;
    const dist = Math.max(2.55 / (2 * tan), 2.0 / (2 * tan * aspect));
    const visH = 2 * dist * tan;
    const railFrac = aspect < 0.8 ? 0.2 : 0.07;
    const lookY = railFrac * visH - visH / 2;
    camera.position.set(0, lookY, dist);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    view.w = w; view.h = h;
  }
  size();
  new ResizeObserver(size).observe(canvas);

  const setNdc = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]; };
  function pick() { ndc.set(ptr.x, ptr.y); ray.setFromCamera(ndc, camera); return ray.intersectObjects(hits, false)[0]; }
  function planePoint(z = 0) { ndc.set(ptr.x, ptr.y); ray.setFromCamera(ndc, camera); const t = (z - ray.ray.origin.z) / ray.ray.direction.z; return ray.ray.at(t, tmpV); }

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = setNdc(e); const now = performance.now();
    if (ptr.has) {
      const dt = Math.max(0.008, (now - ptr.t) / 1000);
      ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5; ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5;
    }
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.has = true;
    const h = pick();
    ptr.over = h ? h.object.userData.g : -1;
    ptr.hitDist = h?.distance ?? 6;
    canvas.style.cursor = drag.on ? 'grabbing' : h ? 'grab' : '';
    hero?.classList.toggle('is-over', !!h);
  });
  canvas.addEventListener('pointerleave', () => { ptr.over = -1; ptr.has = false; ptr.vx = ptr.vy = 0; hero?.classList.remove('is-over'); });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = setNdc(e); ptr.x = x; ptr.y = y; ptr.t = performance.now(); ptr.has = true;
    const h = pick();
    if (h) {
      drag.on = true; drag.g = h.object.userData.g;
      drag.gy = planePoint(G[drag.g].swing.position.z).y;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; hero?.classList.add('is-dragging');
    }
  });
  const release = () => { if (!drag.on) return; drag.on = false; canvas.style.cursor = ptr.over >= 0 ? 'grab' : ''; hero?.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);

  new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; if (running) last = performance.now(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

  const breeze = (t) => Math.sin(t * 0.9) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.3 + Math.sin(t * 0.37 + 2) * 0.4;
  const wind = [0, 0, 0];
  const STEP = 1 / 60;

  function stepOnce() {
    time += STEP;
    const br = reduced ? 0 : 1;
    /* a slow gust that rolls along the rail */
    for (let k = 0; k < G.length; k++) {
      const g = G[k], o = g.osc;
      let fz = 0, fx = 0, fy = 0;
      if (ptr.over === k && !drag.on && ptr.has) {
        o.z.v += ptr.vx * 1.35 * STEP; o.x.v += -ptr.vy * 0.9 * STEP; o.y.v += ptr.vx * 0.55 * STEP;
      }
      if (drag.on && drag.g === k) {
        const p = planePoint(g.swing.position.z);
        const target = clamp(Math.asin(clamp((p.x - g.swing.position.x) / Lh, -0.95, 0.95)), -0.85, 0.85);
        const targetX = clamp((drag.gy - p.y) * 0.9, -0.5, 0.5);
        fz += 95 * (target - o.z.x) - 15 * o.z.v; fx += 55 * (targetX - o.x.x) - 10 * o.x.v; fy += -6 * o.y.v + 40 * (target * 0.5 - o.y.x);
      }
      fz += breeze(time + g.phase) * 0.2 * br; fx += breeze(time * 0.8 + 4 + g.phase) * 0.11 * br; fy += breeze(time * 0.6 + 9 + g.phase) * 0.09 * br;
      fx += scrollVel * 5;
      o.z.step(STEP, fz); o.x.step(STEP, fx); o.y.step(STEP, fy);
      g.swing.rotation.set(o.x.x, g.spec.rotY + o.y.x + spin * (k === 0 ? 1 : 0.3), o.z.x);
    }
    if (ptr.over >= 0 && !drag.on) { ptr.vx *= 0.9; ptr.vy *= 0.9; }
    scrollVel *= 0.9;
    spin += (spinTarget - spin) * Math.min(1, STEP * 4);

    const gust = 0.25 + 0.3 * Math.sin(time * 0.31) + 0.2 * Math.sin(time * 0.83 + 1);
    for (let k = 0; k < G.length; k++) {
      const g = G[k];
      if (!g.ready) continue;
      if (quality === 0 && k > 1) continue;
      if (k > 1 && frameNo % 2) continue;               // far garments run at half rate
      g.swing.updateMatrixWorld(true);
      wind[0] = (gust * 0.4 + 0.12) * br; wind[1] = 0; wind[2] = (gust * 0.9 + 0.2 * Math.sin(time * 0.6 + k)) * br;
      /* brush: the pointer moving through the fabric pushes it */
      if (ptr.over === k && ptr.has && !drag.on) {
        const pt = planePoint(g.swing.position.z);
        const sx = ptr.hitDist * view.tan * camera.aspect, sy = ptr.hitDist * view.tan;
        g.cloth.brush(pt.x, pt.y, pt.z, ptr.vx * sx * STEP, ptr.vy * sy * STEP, -Math.hypot(ptr.vx * sx, ptr.vy * sy) * STEP * 0.6, 0.38, 0.7);
      }
      if (g.settle > 0) { g.settle--; g.cloth.damp = 0.96; } else g.cloth.damp = 0.992;
      g.cloth.iterations = quality === 2 ? g.cloth.o.iterations : Math.max(3, g.cloth.o.iterations - 2);
      g.cloth.step(k > 1 ? STEP * 2 : STEP, g.garment.matrixWorld.elements, wind);
      if (g.hot === undefined) continue;
    }
  }

  const proj = new THREE.Vector3();
  function placeHotspots() {
    for (const g of G) {
      if (!g.hot) continue;
      g.anchor.getWorldPosition(proj); proj.project(camera);
      const x = ((proj.x + 1) / 2) * view.w, y = ((1 - proj.y) / 2) * view.h;
      const on = g.ready && x > 24 && x < view.w - 24 && y > 24 && y < view.h - 24;
      g.hot.style.visibility = on ? 'visible' : 'hidden';
      g.hot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  function render() {
    for (const g of G) if (g.ready) {
      g.cloth.refresh();
      const a = g.mesh.geometry.attributes;
      a.position.needsUpdate = a.normal.needsUpdate = a.color.needsUpdate = true;
    }
    placeHotspots();
    renderer.render(scene, camera);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    const t0 = performance.now();
    let n = 0;
    while (acc >= STEP && n < 3) { stepOnce(); acc -= STEP; n++; frameNo++; }
    if (n === 3) acc = 0;
    simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
    render();
    /* adapt: if the page can't hold ~45fps, lighten the solver, then stop animating the far garments */
    if (dt > 0.024) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 50) { slow = 0; if (quality > 0) quality--; else if (dprCap > 1) { dprCap = 1; size(); } }
  }

  prepareNext();
  size();
  render();
  requestAnimationFrame(frame);

  addEventListener('scroll', () => {
    const y = scrollY, vh = innerHeight;
    spinTarget = reduced ? 0 : clamp(y / vh, 0, 1) * 0.9;
    scrollVel = clamp(scrollVel + (y - lastScroll) * 0.0009, -0.8, 0.8);
    lastScroll = y;
  }, { passive: true });

  return {
    setColor(hex) { const g = G[0]; if (g.ready) { paint(g, hex); g.material.sheenColor.set(hex).lerp(new THREE.Color(0xffffff), 0.45); } },
    nudge(amount = 1) { for (const g of G) { g.osc.z.v += 1.4 * amount * (g === G[0] ? 1 : 0.5); g.osc.x.v -= 0.4 * amount; g.osc.y.v += 0.8 * amount; } },
    /* test helper: run the simulation ahead without drawing every step */
    settle(seconds = 10) {
      while (queue.length) prepareNext0();
      const t0 = performance.now(); let n = 0;
      for (let t = 0; t < seconds; t += STEP) { stepOnce(); n++; frameNo++; }
      const ms = (performance.now() - t0) / n;
      render();
      return ms;
    },
    stats: () => ({ simMs, quality, particles: G.map((g) => g.cloth.N), constraints: G.map((g) => g.cloth.nC) }),
    dispose() { renderer.dispose(); },
  };

  function prepareNext0() {
    const g = queue.shift(); if (!g) return;
    paint(g); g.swing.updateMatrixWorld(true); g.cloth.reset(g.garment.matrixWorld.elements); g.ready = true; g.settle = 90; g.mesh.visible = true;
  }
}
