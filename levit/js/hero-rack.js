/* LEVIT hero: the clothing rack (models/rack.glb).
 *
 * The glTF holds five garments on wooden hangers on a rail, with a baked "breeze" animation (hanger sway and
 * garment morph targets). This module renders it with Three.js and adds a physical layer on top: each hanger
 * sits in a wrapper that swings as a damped pendulum, so pointer sweeps, dragging, scrolling and clicks move
 * the real hangers while the baked breeze keeps the fabric alive. Shadows are contact-hardening.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

class Osc {
  constructor(w, z) { this.w = w; this.z = z; this.x = 0; this.v = 0; this.a = 0; }
  step(dt, f = 0) { this.a = f - this.w * this.w * this.x - 2 * this.z * this.w * this.v; this.v += this.a * dt; this.x += this.v * dt; if (Math.abs(this.x) > 1) { this.x = Math.sign(this.x); this.v *= -0.25; } }
}

/* contact-hardening shadows: swaps the PCF lookup in three's directional shadows for PCSS */
function installPCSS() {
  const helpers = `
float lvRand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 lvDisk(int i, int n, float rot) { float r = sqrt((float(i) + 0.5) / float(n)); float a = float(i) * 2.39996323 + rot; return r * vec2(cos(a), sin(a)); }
float lvPCSS(sampler2D map, vec2 uv, float zr, vec2 size) {
  float rot = lvRand(uv * size) * 6.2831853;
  float sum = 0.0, cnt = 0.0;
  for (int i = 0; i < 14; i++) {
    float d = unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 14, rot) * 0.012));
    if (d < zr - 0.0004) { sum += d; cnt += 1.0; }
  }
  if (cnt < 0.5) return 1.0;
  float pen = clamp((zr - sum / cnt) * 0.22, 1.2 / size.x, 0.02);
  float lit = 0.0;
  for (int i = 0; i < 28; i++) lit += step(zr, unpackRGBAToDepth(texture2D(map, uv + lvDisk(i, 28, rot + 1.7) * pen)));
  return lit / 28.0;
}
float getShadow(`;
  let chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes('lvPCSS')) return;
  chunk = chunk.replace('float getShadow(', helpers)
    .replace('#if defined( SHADOWMAP_TYPE_PCF )', '#if defined( SHADOWMAP_TYPE_PCF )\n shadow = lvPCSS(shadowMap, shadowCoord.xy, shadowCoord.z, shadowMapSize);\n#elif defined( LV_UNUSED_PCF )');
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk;
}

/* a photo-studio environment: a neutral room lit by softboxes, so brass, chrome and fabric sheen reflect like they do on set */
function studioEnv(renderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.SphereGeometry(12, 48, 24), new THREE.MeshBasicMaterial({ color: 0xcfc9c2, side: THREE.BackSide })));
  const floorBounce = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshBasicMaterial({ color: 0xf3ede6, side: THREE.DoubleSide }));
  floorBounce.rotation.x = -Math.PI / 2; floorBounce.position.y = -4; room.add(floorBounce);
  const panel = (w, h, pos, power, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos); m.lookAt(0, -0.5, 0); room.add(m);
  };
  panel(7, 4.5, [0, 9, 2], 14, 0xffffff);          // overhead softbox
  panel(2.6, 8, [-9, 2, 5], 10, 0xfff0dc);         // warm key strip, front left
  panel(4, 6, [9, 3, 3], 4.5, 0xe2ecff);           // cool fill, front right
  panel(11, 2, [0, 1.5, -10], 7, 0xffffff);        // back strip for edge light on the rail
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(room, 0.015).texture;
  pm.dispose();
  return tex;
}

/* a fine plain-weave normal map, tiled over fabrics that ship without one */
function weaveNormal(anisotropy) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), im = g.createImageData(N, N), H = new Float32Array(N * N);
  const cell = 8;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x % (cell * 2)) < cell, v = (y % (cell * 2)) < cell;
    const over = u !== v;                                            // checker of over/under threads
    const fx = (x % cell) / cell, fy = (y % cell) / cell;
    H[y * N + x] = (over ? Math.sin(Math.PI * fx) * 0.8 + 0.2 : Math.sin(Math.PI * fy) * 0.8 + 0.2) + (Math.random() - 0.5) * 0.08;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = (xx, yy) => H[((yy + N) % N) * N + ((xx + N) % N)];
    let nx = -(h(x + 1, y) - h(x - 1, y)) * 1.6, ny = (h(x, y + 1) - h(x, y - 1)) * 1.6, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * N + x) * 4; im.data[k] = (nx * 0.5 + 0.5) * 255; im.data[k + 1] = (ny * 0.5 + 0.5) * 255; im.data[k + 2] = (nz * 0.5 + 0.5) * 255; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26); t.anisotropy = anisotropy; t.needsUpdate = true;
  return t;
}

export async function initRack({ canvas, hero, hotspots = [], src, onProgress, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  installPCSS();

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xfff1de, 3.0);
  key.position.set(-2.6, 5, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 11 });
  key.shadow.bias = -0.0007; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffe6c8, 1.0); rim.position.set(3, 1.5, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xece4da, 0.22));

  const FLOOR_Y = -1.495;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x2f2318, opacity: 0.34 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true;
  scene.add(floor);
  /* soft contact shadow where the feet and the hanging clothes meet the floor */
  const cc = document.createElement('canvas'); cc.width = 256; cc.height = 256;
  const cg = cc.getContext('2d'), grad = cg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(40,28,18,.55)'); grad.addColorStop(0.55, 'rgba(40,28,18,.22)'); grad.addColorStop(1, 'rgba(40,28,18,0)');
  cg.fillStyle = grad; cg.fillRect(0, 0, 256, 256);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, FLOOR_Y + 0.002, 0); contact.scale.set(4.6, 1.3, 1); scene.add(contact);

  /* ---- load the rack ---- */
  const loader = new GLTFLoader();
  const gltf = await new Promise(async (res, rej) => {
    if (src.endsWith('.json')) {                                   // hosts that don't serve .glb can ship it as {"b64": "..."}
      try { const { b64 } = await (await fetch(src)).json(); const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); loader.parse(buf.buffer, '', res, rej); } catch (e) { rej(e); }
    } else loader.load(src, res, (e) => e.total && onProgress?.(e.loaded / e.total), rej);
  });
  const root = gltf.scene;
  scene.add(root);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const weave = weaveNormal(maxAniso);
  const fixed = new Map();
  const upgrade = (m, hasUv) => {
    if (fixed.has(m)) return fixed.get(m);
    let out = m;
    if (/hanger/i.test(m.name) || /Brass/i.test(m.name) || /Rack/i.test(m.name)) {
      /* wood, brass and steel become physical materials so they can carry a varnish / polish layer */
      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness, side: m.side, name: m.name });
      if (/hanger/i.test(m.name)) { out.clearcoat = 0.55; out.clearcoatRoughness = 0.32; }
      if (/Brass/i.test(m.name)) { out.roughness = 0.2; out.envMapIntensity = 1.4; }
      if (/Rack/i.test(m.name)) { out.roughness = 0.3; out.clearcoat = 0.3; out.clearcoatRoughness = 0.4; out.envMapIntensity = 1.3; }
    } else if (hasUv) {
      /* fabric: fine weave relief, heavier sheen, a touch more roughness variation */
      if (!m.normalMap) { m.normalMap = weave; m.normalScale = new THREE.Vector2(0.55, 0.55); }
      m.sheen = Math.max(m.sheen ?? 0, 0.7); m.sheenRoughness = 0.55;
      if (m.sheenColor && m.sheenColor.getHex() === 0) m.sheenColor.setRGB(0.2, 0.18, 0.16);
      m.envMapIntensity = 0.75;
    }
    for (const k of ['map', 'normalMap']) if (out[k]) out[k].anisotropy = maxAniso;
    fixed.set(m, out);
    return out;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    if (o.material) o.material = upgrade(o.material, !!o.geometry.attributes.uv);
  });

  /* baked breeze */
  const mixer = new THREE.AnimationMixer(root);
  for (const clip of gltf.animations) mixer.clipAction(clip).play();

  /* wrap each hanger pivot so it can swing as a pendulum on top of the baked motion */
  const PRODUCTS = {
    'black-shirt': 'black-oxford-shirt', 'taupe-wrap-dress': 'wrap-collar-midi-dress', 'burgundy-tunic': 'burgundy-tunic',
    'navy-floral-dress': 'navy-floral-dress', 'blush-floral-shirt': 'blush-floral-shirt',
  };
  const pivots = [];
  root.children.filter((c) => /hanger[ _]pivot$/.test(c.name)).forEach((pivot, k) => {
    const wrap = new THREE.Group();
    wrap.position.copy(pivot.position); pivot.position.set(0, 0, 0);
    root.add(wrap); wrap.add(pivot);
    const key = pivot.name.replace(/[ _]hanger[ _]pivot$/, '');
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.1, 0.36), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(0, -0.58, 0); proxy.userData.k = k; wrap.add(proxy);
    const anchor = new THREE.Object3D(); anchor.position.set(0.1, -0.5, 0.16); pivot.add(anchor);
    pivots.push({
      key, wrap, pivot, proxy, anchor, product: PRODUCTS[key], hot: hotspots.find((h) => h.dataset.g === key),
      z: new Osc(3.4 + k * 0.08, 0.05), x: new Osc(3.7 + k * 0.06, 0.07), phase: k * 1.9,
    });
  });
  if (!reduced) pivots.forEach((p, k) => { p.z.x = 0.1 * (k % 2 ? -1 : 1); p.x.x = 0.05; });

  /* ---- view ---- */
  const view = { w: 1, h: 1, portrait: false, tan: Math.tan(THREE.MathUtils.degToRad(11)) };
  const cam = { az: 0, el: 0.1, dist: 10, tx: 0, ty: -0.74, intro: 0 };
  const ps = { x: 0, y: 0 };                                          // smoothed pointer for the parallax
  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    const aspect = w / h, portrait = aspect < 0.85;
    view.w = w; view.h = h; view.portrait = portrait;
    camera.aspect = aspect;
    cam.az = THREE.MathUtils.degToRad(portrait ? 26 : 33);
    const needH = portrait ? 3.1 : 2.55, needW = portrait ? 1.7 : 3.95;
    cam.dist = Math.max(needH / (2 * view.tan), needW / (2 * view.tan * aspect));
    cam.ty = portrait ? -0.58 : -0.72;
    camera.updateProjectionMatrix();
  }
  let dprCap = 2;
  size();
  new ResizeObserver(size).observe(canvas);
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function placeCamera(dt) {
    if (!reduced) cam.intro = Math.min(1, cam.intro + dt / 2.4); else cam.intro = 1;
    ps.x += ((ptr.has ? ptr.x : 0) - ps.x) * Math.min(1, dt * 2.5); ps.y += ((ptr.has ? ptr.y : 0) - ps.y) * Math.min(1, dt * 2.5);
    const az = cam.az + ps.x * 0.07, el = cam.el + 0.05 * (1 - ease(cam.intro)) + ps.y * 0.025;
    const d = cam.dist * (1 + 0.16 * (1 - ease(cam.intro)));
    /* on phones the camera drifts along the rail so every garment gets its turn */
    const tx = view.portrait ? -0.5 + (reduced ? 0 : 1.0 * Math.sin(time * 0.16)) : 0;
    camera.position.set(tx + Math.sin(az) * d * Math.cos(el), cam.ty + Math.sin(el) * d, Math.cos(az) * d * Math.cos(el));
    camera.lookAt(tx, cam.ty, 0);
    camera.updateMatrixWorld();
  }

  /* ---- interaction ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, has: false, over: -1 };
  const drag = { on: false, k: -1, x0: 0, a0: 0 };
  const proxies = pivots.map((p) => p.proxy);
  const toNdc = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]; };
  const pick = () => { ndc.set(ptr.x, ptr.y); ray.setFromCamera(ndc, camera); return ray.intersectObjects(proxies, false)[0]; };
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toNdc(e), now = performance.now();
    if (ptr.has) { const dt = Math.max(0.008, (now - ptr.t) / 1000); ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5; ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5; }
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.has = true;
    const h = pick(); ptr.over = h ? h.object.userData.k : -1;
    canvas.style.cursor = drag.on ? 'grabbing' : h ? 'grab' : '';
    hero.classList.toggle('is-over', !!h);
  });
  canvas.addEventListener('pointerleave', () => { ptr.has = false; ptr.over = -1; ptr.vx = ptr.vy = 0; hero.classList.remove('is-over'); });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toNdc(e); ptr.x = x; ptr.y = y; ptr.has = true;
    const h = pick();
    if (h) { drag.on = true; drag.k = h.object.userData.k; drag.x0 = x; drag.a0 = pivots[drag.k].z.x; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
  });
  const release = () => { if (drag.on) { drag.on = false; canvas.style.cursor = ptr.over >= 0 ? 'grab' : ''; } };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  let scrollVel = 0, lastY = scrollY;
  addEventListener('scroll', () => { scrollVel = clamp(scrollVel + (scrollY - lastY) * 0.001, -0.8, 0.8); lastY = scrollY; }, { passive: true });

  let running = true, last = performance.now(), time = 0, acc = 0, slow = 0;
  new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });

  const breeze = (t) => Math.sin(t * 0.9) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.3 + Math.sin(t * 0.37 + 2) * 0.4;
  const STEP = 1 / 120;
  function stepOnce() {
    time += STEP;
    const br = reduced ? 0 : 1;
    pivots.forEach((p, k) => {
      let fz = breeze(time + p.phase) * 0.05 * br, fx = breeze(time * 0.8 + p.phase + 3) * 0.035 * br;
      fx += scrollVel * 1.4;
      if (p.k === undefined) p.k = k;
      if (ptr.over === k && !drag.on && ptr.has) { p.z.v += ptr.vx * 0.5 * STEP; p.x.v += -ptr.vy * 0.45 * STEP; }
      if (drag.on && drag.k === k) {
        const target = clamp((ptr.x - drag.x0) * 0.9 + drag.a0, -0.7, 0.7);
        fz += 80 * (target - p.z.x) - 13 * p.z.v;
      }
      p.z.step(STEP, fz); p.x.step(STEP, fx);
    });
    if (ptr.over >= 0) { ptr.vx *= 0.985; ptr.vy *= 0.985; }
    scrollVel *= 0.99;
  }

  const proj = new THREE.Vector3();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    while (acc >= STEP) { stepOnce(); acc -= STEP; }
    if (!reduced) mixer.update(dt * (1 + Math.min(1.5, pivots.reduce((s, p) => s + Math.abs(p.z.v), 0) * 1.2)));
    for (const p of pivots) p.wrap.rotation.set(p.x.x, 0, p.z.x);
    placeCamera(dt);
    scene.updateMatrixWorld(true);
    for (const p of pivots) {
      if (!p.hot) continue;
      p.anchor.getWorldPosition(proj); proj.project(camera);
      const x = ((proj.x + 1) / 2) * view.w, y = ((1 - proj.y) / 2) * view.h;
      const on = x > 24 && x < view.w - 24 && y > 24 && y < view.h - 24;
      p.hot.style.visibility = on ? 'visible' : 'hidden';
      p.hot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    renderer.render(scene, camera);
    if (dt > 0.03) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 60 && dprCap > 1) { dprCap = 1; slow = 0; size(); }
  }
  scene.updateMatrixWorld(true);
  requestAnimationFrame((n) => { last = n; frame(n); });

  return {
    nudge(a = 1) { pivots.forEach((p, k) => { p.z.v += 0.9 * a * (k % 2 ? -1 : 1); }); },
    /* PNG of the current frame with a transparent background (used to make the poster image) */
    snapshot() { scene.updateMatrixWorld(true); renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    stats: () => ({ meshes: renderer.info.memory.geometries, tris: renderer.info.render.triangles, calls: renderer.info.render.calls }),
    settle(seconds = 4) { cam.intro = 1; for (let t = 0; t < seconds; t += STEP) stepOnce(); mixer.update(seconds); frame(performance.now()); },
  };
}
