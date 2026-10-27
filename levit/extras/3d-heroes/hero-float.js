/* LEVIT hero: weightless.
 *
 * Four garments hang in the air with no hanger, each held in shape by an invisible form (a "ghost mannequin"):
 * every cloth particle is gently pulled towards where a body would put it, while hems, cuffs and sleeves stay
 * loose and flutter. The garments drift on slow springs, the cursor pushes them like a breath of wind, a click
 * tosses one into the air, and scrolling lifts the whole group. Shadows on the floor are contact-hardening, so
 * they sharpen as a garment sinks and blur as it rises.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { Cloth } from './cloth.js';
import { paintFabric, fiberTexture } from './fabrics.js';
import { PATTERNS } from './patterns.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const GARMENTS = [
  { key: 'knit', pattern: 'knit', color: '#b8561f', home: [1.2, 0.4, 0.9], homeP: [-0.3, 0.45, 0.8], pivot: 0.55, depth: 0.1, size: 1024,
    mat: { roughness: 0.94, sheen: 1, sheenRoughness: 0.5, sheenColor: 0xffc690, envMapIntensity: 0.55 }, normalK: 1.1, bump: 0.9, hot: [0.3, -0.05, 0.16], seed: 0.0 },
  { key: 'hoodie', pattern: 'hoodie', color: '#4f4844', home: [2.55, -0.35, -0.6], homeP: [0.55, -0.5, -0.3], pivot: 0.6, depth: 0.15, size: 768,
    mat: { roughness: 0.97, sheen: 0.7, sheenRoughness: 0.7, sheenColor: 0xbfb3aa, envMapIntensity: 0.45 }, normalK: 1.3, bump: 0.8, hot: [0.28, -0.1, 0.17], seed: 1.7 },
  { key: 'puffer', pattern: 'puffer', color: '#69643f', home: [-0.4, -0.5, -0.4], homeP: [-0.5, -1.5, -0.5], pivot: 0.5, depth: 0.12, size: 1024,
    mat: { roughness: 0.38, sheen: 0.35, sheenRoughness: 0.5, sheenColor: 0xb9b48a, envMapIntensity: 0.8 }, normalK: 1.0, bump: 0.3, hot: [0.26, -0.05, 0.24], seed: 3.1 },
  { key: 'jeans', pattern: 'jeans', color: '#6a8fbd', home: [0.75, 0.75, -1.5], homeP: [0.7, 0.55, -1.3], pivot: 0.9, depth: 0.085, size: 1024,
    mat: { roughness: 0.82, sheen: 0.25, sheenRoughness: 0.6, sheenColor: 0xd3e3f2, envMapIntensity: 0.6 }, normalK: 2.0, bump: 0.7, hot: [0.2, 0.3, 0.12], seed: 4.4 },
];

/* contact-hardening shadows: the PCF lookup in three's directional shadows is replaced by PCSS */
function installPCSS() {
  const helpers = `
float lvRand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 lvDisk(int i, int n, float rot) { float r = sqrt((float(i) + 0.5) / float(n)); float a = float(i) * 2.39996323 + rot; return r * vec2(cos(a), sin(a)); }
float lvPCSS(sampler2D map, vec2 uv, float zr, vec2 size) {
  float rot = lvRand(uv * size) * 6.2831853;
  float sum = 0.0, cnt = 0.0;
  for (int i = 0; i < 14; i++) {
    float d = unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 14, rot) * 0.02));
    if (d < zr - 0.0004) { sum += d; cnt += 1.0; }
  }
  if (cnt < 0.5) return 1.0;
  float pen = clamp((zr - sum / cnt) * 0.34, 1.2 / size.x, 0.034);
  float lit = 0.0;
  for (int i = 0; i < 32; i++) lit += step(zr, unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 32, rot + 1.7) * pen)));
  return lit / 32.0;
}
float getShadow(`;
  let chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes('lvPCSS')) return;
  chunk = chunk.replace('float getShadow(', helpers)
    .replace('#if defined( SHADOWMAP_TYPE_PCF )', '#if defined( SHADOWMAP_TYPE_PCF )\n shadow = lvPCSS(shadowMap, shadowCoord.xy, shadowCoord.z, shadowMapSize);\n#elif defined( LV_UNUSED_PCF )');
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk;
}

function patchFabric(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb *= 0.66;`);
  };
  mat.customProgramCacheKey = () => 'fabric-inside';
}

export function initHero({ canvas, hotspots = [], hero, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;           // lookup replaced by PCSS
  installPCSS();

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);

  /* light from above and slightly left, so shadows drop to the floor below each garment */
  const key = new THREE.DirectionalLight(0xfff1dc, 2.8);
  key.position.set(-1.6, 7, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(3072, 3072);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 0.5, far: 14 });
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffd79a, 1.4); rim.position.set(3.5, 1.5, -3.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd8c2aa, 0.55));

  const FLOOR_Y = -2.45;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x3a2210, opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true;
  scene.add(floor);

  /* ---- garments ---- */
  const fiber = fiberTexture(256);
  const G = [];
  const tmpM = new THREE.Matrix4(), pivotM = new THREE.Matrix4();
  GARMENTS.forEach((spec, k) => {
    const pat = PATTERNS[spec.pattern];
    const group = new THREE.Group(); scene.add(group);
    const cloth = new Cloth({
      front: pat.outline(true), back: pat.outline(false), h: pat.h, thick: pat.thick, hangY: pat.hangY, pinZ: 0.024,
      shrink: pat.shrink, iterations: pat.iterations, bend: pat.bend, puff: pat.puff, floating: true,
      form: { depth: () => spec.depth, soft: spec.key === 'jeans' ? 0.16 : 0.2, stiff: spec.key === 'puffer' ? 0.08 : 0.06, loose: 0.016 },
    });
    const geo = new THREE.BufferGeometry();
    const dyn = (a) => a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(new THREE.BufferAttribute(cloth.rpos, 3)));
    geo.setAttribute('normal', dyn(new THREE.BufferAttribute(cloth.rnorm, 3)));
    geo.setAttribute('color', dyn(new THREE.BufferAttribute(cloth.rcol, 3)));
    geo.setAttribute('uv', new THREE.BufferAttribute(cloth.ruv, 2));
    geo.setIndex(new THREE.BufferAttribute(cloth.rindex, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, side: THREE.DoubleSide, vertexColors: true, ...spec.mat, roughness: 1, metalness: 1, sheenColor: new THREE.Color(spec.mat.sheenColor),
    });
    material.bumpMap = fiber; material.bumpScale = spec.bump;
    patchFabric(material);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
    scene.add(mesh);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(spec.key === 'jeans' ? 1.2 : 1.7, spec.key === 'jeans' ? 1.9 : 1.6, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.g = k; group.add(hit);
    const anchor = new THREE.Object3D(); anchor.position.set(spec.hot[0], spec.hot[1], spec.hot[2]); group.add(anchor);

    G.push({
      spec, group, cloth, mesh, hit, anchor, material, ready: false, settle: 0, home: spec.home.slice(),
      p: new THREE.Vector3(spec.home[0], FLOOR_Y + 0.95, spec.home[2]), v: new THREE.Vector3(),
      ang: new THREE.Vector3(), av: new THREE.Vector3(),         // pitch, yaw, roll
      phase: spec.seed, hot: hotspots.find((h) => h.dataset.g === spec.key),
    });
  });

  /* fabrics are painted a garment at a time so the page never stalls */
  function paint(g, color) {
    const spec = g.spec, pat = PATTERNS[spec.pattern];
    const tex = paintFabric({
      kind: spec.key, color: color || spec.color, poly: pat.outline(true), atlas: g.cloth.atlas, size: spec.size, normalK: spec.normalK,
      rough: spec.mat.roughness, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    });
    g.material.map?.dispose(); g.material.normalMap?.dispose(); g.material.roughnessMap?.dispose();
    g.material.map = tex.map; g.material.normalMap = tex.normalMap; g.material.roughnessMap = g.material.metalnessMap = tex.ormMap;
    g.material.normalScale = new THREE.Vector2(1, 1);
    g.material.needsUpdate = true;
  }
  const queue = [...G];
  function frameMatrix(g) {
    g.group.updateMatrixWorld(true);
    tmpM.copy(g.group.matrixWorld).multiply(pivotM.makeTranslation(0, g.spec.pivot, 0));
    return tmpM.elements;
  }
  function prepare(g) {
    paint(g); g.cloth.reset(frameMatrix(g)); g.ready = true; g.settle = 50; g.mesh.visible = true;
  }
  function prepareNext() { const g = queue.shift(); if (g) { prepare(g); setTimeout(prepareNext, 30); } }

  /* ---- state ---- */
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, has: false, t: 0, over: -1, dist: 6 };
  let scrollP = 0, running = true, last = performance.now(), time = 0, acc = 0, frameNo = 0, quality = 2, slow = 0, dprCap = matchMedia('(pointer: coarse)').matches ? 1.5 : 2;
  let portrait = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmpV = new THREE.Vector3();
  const hits = G.map((g) => g.hit);
  const view = { w: 1, h: 1, tan: Math.tan(THREE.MathUtils.degToRad(14)) };

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    const aspect = w / h, tan = view.tan;
    camera.aspect = aspect;
    portrait = aspect < 0.8;
    const needH = portrait ? 5.0 : 4.5, needW = portrait ? 2.7 : 7.0;
    const dist = Math.max(needH / (2 * tan), needW / (2 * tan * aspect));
    camera.position.set(0, 1.0, dist);
    camera.lookAt(0, portrait ? -0.45 : -0.55, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    view.w = w; view.h = h;
    for (const g of G) g.home = (portrait ? g.spec.homeP : g.spec.home).slice();
  }
  size();
  new ResizeObserver(size).observe(canvas);

  const setNdc = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]; };
  const pick = () => { ndc.set(ptr.x, ptr.y); ray.setFromCamera(ndc, camera); return ray.intersectObjects(hits, false)[0]; };
  const planePoint = (z) => { ndc.set(ptr.x, ptr.y); ray.setFromCamera(ndc, camera); const t = (z - ray.ray.origin.z) / ray.ray.direction.z; return ray.ray.at(t, tmpV); };

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = setNdc(e), now = performance.now();
    if (ptr.has) {
      const dt = Math.max(0.008, (now - ptr.t) / 1000);
      ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5; ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5;
    }
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.has = true;
    const h = pick();
    ptr.over = h ? h.object.userData.g : -1; ptr.dist = h?.distance ?? 8;
    canvas.style.cursor = h ? 'pointer' : '';
    hero?.classList.toggle('is-over', !!h);
  });
  canvas.addEventListener('pointerleave', () => { ptr.has = false; ptr.over = -1; ptr.vx = ptr.vy = 0; hero?.classList.remove('is-over'); });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = setNdc(e); ptr.x = x; ptr.y = y; ptr.has = true;
    const h = pick();
    if (h) {                                                  // toss it
      const g = G[h.object.userData.g];
      g.v.y += 2.9; g.v.x += (Math.random() - 0.5) * 1.4; g.av.y += (Math.random() < 0.5 ? -1 : 1) * 5.5; g.av.z += (Math.random() - 0.5) * 3;
      g.cloth.brush(g.p.x, g.p.y, g.p.z, 0, -0.06, 0, 1.3, 1.2);
    }
  });

  new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; if (running) last = performance.now(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });
  addEventListener('scroll', () => { scrollP = reduced ? 0 : clamp(scrollY / innerHeight, 0, 1); }, { passive: true });

  const STEP = 1 / 60, wind = [0, 0, 0];

  function stepOnce() {
    time += STEP;
    const br = reduced ? 0 : 1;
    const gust = 0.5 + 0.35 * Math.sin(time * 0.31) + 0.2 * Math.sin(time * 0.83 + 1);
    for (let k = 0; k < G.length; k++) {
      const g = G[k], t = time + g.phase;
      /* rigid motion: springs to a drifting home position */
      const tx = g.home[0] + (Math.sin(t * 0.55) * 0.09 + Math.sin(t * 1.1) * 0.025) * br;
      const ty = g.home[1] + (Math.sin(t * 0.4 + 1.7) * 0.12) * br + scrollP * (1.1 + k * 0.25);
      const tz = g.home[2] + Math.sin(t * 0.31) * 0.05 * br;
      const a = new THREE.Vector3((tx - g.p.x) * 2.4, (ty - g.p.y) * 2.4, (tz - g.p.z) * 2.4).addScaledVector(g.v, -1.6);
      const aa = new THREE.Vector3(
        (0.05 * Math.sin(t * 0.37) * br - g.ang.x) * 3 - g.av.x * 1.6,
        ((0.0 + 0.3 * Math.sin(t * 0.33 + 0.6) * br + scrollP * (k % 2 ? -0.9 : 0.9)) - g.ang.y) * 3 - g.av.y * 1.5,
        (0.07 * Math.sin(t * 0.45) * br - g.ang.z) * 3 - g.av.z * 1.6);

      /* the cursor is a gust: garments near it are pushed away and spun */
      if (ptr.has) {
        const pt = planePoint(g.p.z);
        const dx = g.p.x - pt.x, dy = g.p.y - pt.y, d = Math.hypot(dx, dy) || 1e-3, R = 1.35;
        if (d < R) {
          const f = Math.pow(1 - d / R, 2);
          a.x += (dx / d) * f * 24; a.y += (dy / d) * f * 24; a.z -= f * 6;
          const sx = ptr.dist * view.tan * camera.aspect;
          aa.y += -ptr.vx * sx * f * 0.45; aa.z += ptr.vx * sx * f * 0.25; aa.x += ptr.vy * sx * f * 0.2;
          if (g.ready) g.cloth.brush(pt.x, pt.y, pt.z, ptr.vx * sx * STEP * 0.6, ptr.vy * sx * STEP * 0.6, -f * 0.03, 0.6, 0.7);
        }
      }
      g.v.addScaledVector(a, STEP); g.p.addScaledVector(g.v, STEP);
      g.av.addScaledVector(aa, STEP); g.ang.addScaledVector(g.av, STEP);
      g.p.y = Math.max(g.p.y, FLOOR_Y + 0.9);
      g.group.position.copy(g.p);
      g.group.rotation.set(clamp(g.ang.x, -0.6, 0.6), g.ang.y, clamp(g.ang.z, -0.6, 0.6));
    }
    ptr.vx *= 0.92; ptr.vy *= 0.92;

    for (let k = 0; k < G.length; k++) {
      const g = G[k];
      if (!g.ready) continue;
      if (quality === 0 && k % 2) continue;
      if (quality < 2 && k % 2 && frameNo % 2) continue;
      const m = frameMatrix(g);
      wind[0] = (gust * 0.5 + 0.1 * Math.sin(time * 0.7 + k)) * br; wind[1] = 0.18 * Math.sin(time * 0.5 + k * 2) * br; wind[2] = gust * br;
      if (g.settle > 0) { g.settle--; g.cloth.damp = 0.95; } else g.cloth.damp = 0.99;
      g.cloth.iterations = quality === 2 ? g.cloth.o.iterations : Math.max(3, g.cloth.o.iterations - 2);
      g.cloth.step(quality < 2 && k % 2 ? STEP * 2 : STEP, m, wind, 1.2);
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
    let n = 0;
    while (acc >= STEP && n < 3) { stepOnce(); acc -= STEP; n++; frameNo++; }
    if (n === 3) acc = 0;
    render();
    if (dt > 0.024) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 50) { slow = 0; if (quality > 0) quality--; else if (dprCap > 1) { dprCap = 1; size(); } }
  }

  prepareNext();
  render();
  requestAnimationFrame(frame);

  return {
    setColor(hex) { const g = G.find((q) => q.spec.key === 'knit'); if (g?.ready) { paint(g, hex); g.material.sheenColor.set(hex).lerp(new THREE.Color(0xffffff), 0.45); } },
    nudge(amount = 1) { for (const g of G) { g.v.y += 1.6 * amount; g.av.y += 3 * amount * (g.spec.seed % 2 ? 1 : -1); } },
    /* test helper */
    settle(seconds = 10) {
      while (queue.length) prepare(queue.shift());
      const t0 = performance.now(); let n = 0;
      for (let t = 0; t < seconds; t += STEP) { stepOnce(); n++; frameNo++; }
      const ms = (performance.now() - t0) / n;
      render();
      return ms;
    },
    dispose() { renderer.dispose(); },
  };
}
