/* LEVIT hero — a knit top on a black hanger, hung from a rail.
 *
 * Motion is simulated, not keyframed:
 *   • the hanger is a damped 3-axis pendulum pivoting on the rail
 *   • the body of the knit and each sleeve are their own pendulums whose pivots
 *     are accelerated by the hanger, so they lag, overshoot and settle
 *   • pointer sweeps, drags, scrolling and a faint breeze all feed forces into
 *     that system rather than playing animations
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ------------------------------------------------------------------ physics */
class Osc {
  constructor(w, z) { this.w = w; this.z = z; this.x = 0; this.v = 0; this.a = 0; }
  step(dt, f = 0) {
    this.a = f - this.w * this.w * this.x - 2 * this.z * this.w * this.v;
    this.v += this.a * dt;
    this.x += this.v * dt;
    if (Math.abs(this.x) > 1.15) { this.x = Math.sign(this.x) * 1.15; this.v *= -0.25; }
    return this.a;
  }
}

/* ----------------------------------------------------------------- textures */
function knitTextures(renderer) {
  const N = 512, cell = 16;
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fx = ((x % cell) + 0.5) / cell, fy = ((y % cell) + 0.5) / cell;
      const e = Math.min(fx, 1 - fx, fy, 1 - fy);
      const plate = smooth(0.05, 0.27, e);
      let v = plate;
      v += plate * 0.10 * Math.sin((y / cell) * Math.PI * 8);   // yarn courses
      v += (Math.random() - 0.5) * 0.14;                        // fibre noise
      h[y * N + x] = v;
    }
  }
  const col = document.createElement('canvas');
  const nor = document.createElement('canvas');
  col.width = col.height = nor.width = nor.height = N;
  const cc = col.getContext('2d'), nc = nor.getContext('2d');
  const ci = cc.createImageData(N, N), ni = nc.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const v = clamp(h[y * N + x], 0, 1.1);
      const g = 0.60 + 0.40 * v;
      ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = Math.min(255, g * 255);
      ci.data[i + 3] = 255;
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const k = 2.4;
      let nx = -dx * k, ny = dy * k, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      ni.data[i] = (nx * 0.5 + 0.5) * 255;
      ni.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      ni.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      ni.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); nc.putImageData(ni, 0, 0);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const map = new THREE.CanvasTexture(col);
  const normalMap = new THREE.CanvasTexture(nor);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap };
}

/* ------------------------------------------------------------ garment shape */
const HW = 0.56, BODY_H = 0.95, SLOPE = 0.27;

function bodyPoint(s, v, out) {
  const t = Math.abs(v);
  const bump = Math.sin(Math.PI * smooth(0.35, 0.95, t));
  const hem = smooth(0.86, 1, t);
  const hw = HW * (1 + 0.05 * bump - 0.10 * hem);
  const x = s * hw;
  const yTop = -SLOPE * Math.abs(x);
  let y = (1 - t) * yTop - t * BODY_H;
  const dp = 0.05 + 0.115 * smooth(0, 0.3, t) + 0.04 * bump - 0.03 * hem;
  const ss = clamp(v / 0.045, -1, 1);
  const sq = Math.pow(Math.max(0, 1 - s * s), 0.55);
  const edge = Math.abs(s);
  const extra = 0.034 * smooth(1.0, 0.8, edge) * (1 - smooth(0.1, 0.35, t));   // keep the hanger arm inside the shoulder
  let z = (dp * sq + extra) * ss;
  y += 0.045 * Math.sqrt(Math.max(0, 1 - ss * ss));
  y -= 0.07 * Math.pow(smooth(0.8, 1, edge), 2) * (1 - t);                     // round off the drop shoulder
  const fold = 0.016 * Math.sin(s * 10 + 1.3 * Math.sin(t * 5)) * smooth(0.1, 0.7, t)
             + 0.010 * Math.sin(s * 19) * smooth(0.7, 1, t);
  z += (v >= 0 ? 1 : -1) * fold * sq;
  out.set(x, y, z);
  return t;
}

function buildBody() {
  const NS = 88, NT = 64, rows = NT * 2 + 1;
  const pos = [], uv = [], rib = [], idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    const v = -1 + (2 * j) / (rows - 1);
    for (let i = 0; i <= NS; i++) {
      const s = -1 + (2 * i) / NS;
      const t = bodyPoint(s, v, p);
      pos.push(p.x, p.y, p.z);
      uv.push(p.x * 2.6, p.y * 2.6);
      rib.push(smooth(0.90, 0.93, t));
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < NS; i++) {
      const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(rib, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make the front sheet face +z
  const front = (Math.floor(rows * 0.75)) * (NS + 1) + NS / 2;
  if (g.attributes.normal.getZ(front) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return g;
}

/* V-neck rib band: follows the cut edge on the front sheet */
const NECK_APEX = -0.40, NECK_HALF = 0.17;
const NECK_K = (-SLOPE * NECK_HALF - NECK_APEX) / NECK_HALF;   // slope of the V edge

function buildNeckBand() {
  const pts = [];
  const p = new THREE.Vector3();
  for (let k = -12; k <= 12; k++) {
    const x = (k / 12) * NECK_HALF;
    const yTop = -SLOPE * Math.abs(x);
    const y = NECK_APEX + NECK_K * Math.abs(x) - 0.013;
    const t = (yTop - y) / (yTop + BODY_H);
    bodyPoint(x / (HW * (1 + 0.05 * Math.sin(Math.PI * smooth(0.35, 0.95, t)))), t, p);
    pts.push(new THREE.Vector3(p.x, y, p.z + 0.004));
  }
  const geos = [];
  const half = (arr) => {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr, false, 'catmullrom', 0.2), 40, 0.0125, 8, false);
    const n = g.attributes.position.count;
    g.setAttribute('aRib', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
    const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 6, uvs.getY(i) * 2);
    geos.push(g);
  };
  half(pts.slice(0, 13)); half(pts.slice(12));
  return geos;
}

function buildSleeve(side) {
  const NL = 56, NR = 40, L = 1.0;
  const pos = [], uv = [], rib = [], idx = [];
  const centre = (t) => new THREE.Vector3(
    side * (0.02 + 0.07 * t),
    -(0.07 + L * t),
    0.02 * Math.sin(Math.PI * t) + 0.015 * t
  );
  const radius = (t) => {
    let r = 0.138 * (1 - 0.14 * t);
    r += 0.034 * Math.sin(Math.PI * smooth(0.5, 0.93, t));          // blouson puff above the cuff
    r *= 0.30 + 0.70 * Math.pow(smooth(0, 0.18, t), 0.6);           // taper into the shoulder
    r = r * (1 - smooth(0.935, 0.965, t)) + 0.088 * smooth(0.935, 0.965, t);
    return r;
  };
  const Z = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Vector3();
  for (let j = 0; j <= NL; j++) {
    const t = j / NL;
    const c = centre(t);
    const T = centre(Math.min(1, t + 0.01)).sub(centre(Math.max(0, t - 0.01))).normalize();
    const N = new THREE.Vector3().crossVectors(T, Z).normalize();
    const r = radius(t);
    for (let i = 0; i <= NR; i++) {
      const a = (i / NR) * Math.PI * 2;
      const wob = 1 + 0.045 * Math.sin(a * 3 + t * 6) * smooth(0.1, 0.6, t) * (1 - smooth(0.9, 0.95, t));
      tmp.copy(c).addScaledVector(N, Math.cos(a) * r * wob).addScaledVector(Z, Math.sin(a) * r * 0.80 * wob);
      pos.push(tmp.x, tmp.y, tmp.z);
      uv.push((i / NR) * 2.8, t * L * 2.6);
      rib.push(smooth(0.94, 0.965, t));
    }
  }
  for (let j = 0; j < NL; j++) {
    for (let i = 0; i < NR; i++) {
      const a = j * (NR + 1) + i, b = a + 1, c = a + NR + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(rib, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure outward normals: compare against the ring centre at mid-length
  const mid = Math.floor(NL / 2) * (NR + 1);
  const cm = centre(0.5);
  const px = pos[(mid) * 3] - cm.x, pz = pos[(mid) * 3 + 2] - cm.z, py = pos[(mid) * 3 + 1] - cm.y;
  const n = g.attributes.normal;
  if (px * n.getX(mid) + py * n.getY(mid) + pz * n.getZ(mid) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return g;
}

function buildSlip() {
  const NS = 24, NT = 16;
  const pos = [], idx = [];
  for (let j = 0; j <= NT; j++) {
    const t = j / NT;
    for (let i = 0; i <= NS; i++) {
      const s = -1 + (2 * i) / NS;
      const x = s * (0.30 + 0.04 * t);
      const y = -0.215 - t * 0.55;
      const z = 0.06 + 0.02 * (1 - s * s) + 0.012 * Math.sin(s * 7 + t * 3);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* -------------------------------------------------------------- the hanger */
function buildHanger() {
  const y0 = -0.19, half = 0.62, th = 0.044;
  const top = (x) => y0 - SLOPE * Math.sqrt(x * x + 0.0009) + SLOPE * 0.03;
  const sh = new THREE.Shape();
  const N = 28;
  sh.moveTo(-half, top(-half));
  for (let i = 1; i <= N; i++) { const x = -half + (2 * half * i) / N; sh.lineTo(x, top(x)); }
  sh.absarc(half, top(half) - th / 2, th / 2, Math.PI / 2, -Math.PI / 2, true);
  for (let i = N; i >= 0; i--) { const x = -half + (2 * half * i) / N; sh.lineTo(x, top(x) - th); }
  sh.absarc(-half, top(-half) - th / 2, th / 2, -Math.PI / 2, -Math.PI * 1.5, true);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 3, curveSegments: 10,
  });
  g.translate(0, 0, -0.015);
  return g;
}

function buildHook() {
  const pts = [
    [0, -0.20], [0, -0.13], [0.002, -0.085], [0.03, -0.052], [0.068, -0.022], [0.078, 0.025],
    [0.052, 0.072], [0.0, 0.088], [-0.05, 0.066], [-0.074, 0.02], [-0.066, -0.026],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 80, 0.0105, 12, false);
}

/* --------------------------------------------------- shader: drape + flutter */
const DEFORM_UNIFORMS = () => ({
  uBend: { value: new THREE.Vector2() },
  uFlut: { value: 0 },
  uTime: { value: 0 },
  uH: { value: 1.0 },
});

function patchDeform(material, uniforms, { neck = false, rib = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uBend; uniform float uFlut; uniform float uTime; uniform float uH;
        attribute float aRib; varying float vRib; varying vec3 vObj;
        mat3 bendMat(float dd){
          float k = pow(dd, 1.4);
          float az = uBend.x * k, ax = uBend.y * k;
          float cz = cos(az), sz = sin(az), cx = cos(ax), sx = sin(ax);
          mat3 Rz = mat3(cz, sz, 0., -sz, cz, 0., 0., 0., 1.);
          mat3 Rx = mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx);
          return Rz * Rx;
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { float ddn = clamp(-position.y / uH, 0., 1.); objectNormal = bendMat(ddn) * objectNormal; }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRib = aRib; vObj = position;
        float ddp = clamp(-position.y / uH, 0., 1.);
        transformed = bendMat(ddp) * transformed;
        transformed += normal * sin(position.y * 19. - uTime * 3.1 + position.x * 5.) * uFlut * ddp;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRib; varying vec3 vObj;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${neck ? `
        if (abs(vObj.x) < 0.24) {
          if (vObj.z > 0. && vObj.y > ${NECK_APEX.toFixed(3)} + ${NECK_K.toFixed(4)} * abs(vObj.x)) discard;
          if (vObj.z <= 0. && vObj.y > -0.10 + 2.6 * vObj.x * vObj.x) discard;
        }` : ''}`);
    if (rib) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.80, vRib);
        if (!gl_FrontFacing) diffuseColor.rgb *= 0.62;`);
    }
  };
  material.customProgramCacheKey = () => `deform${neck ? 'N' : ''}${rib ? 'R' : ''}`;
}

function depthMat(uniforms, neck) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  patchDeform(m, uniforms, { neck, rib: false });
  return m;
}

/* ------------------------------------------------------------------- init  */
export function initHero({ canvas, hotspot, hero, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  /* lights: warm key from upper left, gold rim from behind (the shop-sign glow) */
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(-2.4, 2.8, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -2.2;
  key.shadow.camera.near = 1; key.shadow.camera.far = 12;
  key.shadow.bias = -0.001; key.shadow.normalBias = 0.035; key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffd79a, 1.5);
  rim.position.set(3, 1.2, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd8c2aa, 0.55));

  /* wall that only receives the soft shadow */
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ color: 0x3a2210, opacity: 0.22 }));
  wall.position.set(0, -0.6, -0.95);
  wall.receiveShadow = true;
  scene.add(wall);

  /* rail */
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 16, 24),
    new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.35, metalness: 0.6 })
  );
  rail.rotation.z = Math.PI / 2;
  scene.add(rail);

  /* hanger assembly — pivots on the rail */
  const swing = new THREE.Group();
  scene.add(swing);
  const wood = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.36, metalness: 0.15 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9b46c, roughness: 0.28, metalness: 1, envMapIntensity: 1.3 });
  const hanger = new THREE.Mesh(buildHanger(), wood);
  const hook = new THREE.Mesh(buildHook(), brass);
  hanger.castShadow = hook.castShadow = true;
  swing.add(hanger, hook);

  /* garment */
  const garment = new THREE.Group();
  garment.position.set(0, -0.19, 0);
  swing.add(garment);

  const { map, normalMap } = knitTextures(renderer);
  const knit = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xb8561f), map, normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.94, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffc690),
    side: THREE.DoubleSide, envMapIntensity: 0.55,
  });
  const bodyU = DEFORM_UNIFORMS();
  const sleeveU = { L: DEFORM_UNIFORMS(), R: DEFORM_UNIFORMS() };
  bodyU.uH.value = 1.0;
  sleeveU.L.uH.value = sleeveU.R.uH.value = 1.15;

  const matBody = knit.clone(); patchDeform(matBody, bodyU, { neck: true, rib: true });
  const matL = knit.clone(); patchDeform(matL, sleeveU.L, { rib: true });
  const matR = knit.clone(); patchDeform(matR, sleeveU.R, { rib: true });
  const tintMats = [matBody, matL, matR];

  const body = new THREE.Mesh(buildBody(), matBody);
  body.castShadow = body.receiveShadow = true;
  body.customDepthMaterial = depthMat(bodyU, true);
  garment.add(body);
  for (const g of buildNeckBand()) {
    const m = new THREE.Mesh(g, matBody);
    m.castShadow = true;
    garment.add(m);
  }

  const slip = new THREE.Mesh(buildSlip(), new THREE.MeshPhysicalMaterial({
    color: 0xf4efe6, roughness: 0.38, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, envMapIntensity: 0.8,
  }));
  slip.receiveShadow = true;
  garment.add(slip);

  const sleeves = {};
  for (const side of [-1, 1]) {
    const grp = new THREE.Group();
    grp.position.set(side * 0.57, -SLOPE * 0.57 + 0.005, 0);
    const mesh = new THREE.Mesh(buildSleeve(side), side < 0 ? matL : matR);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.customDepthMaterial = depthMat(side < 0 ? sleeveU.L : sleeveU.R, false);
    grp.add(mesh);
    garment.add(grp);
    sleeves[side] = grp;
  }

  /* hit volume + hotspot anchor */
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.45, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, -0.62, 0);
  swing.add(hit);
  const anchor = new THREE.Object3D();
  anchor.position.set(0.3, -0.5, 0.2);
  garment.add(anchor);

  /* ---- simulation state ---- */
  const Lh = 0.9;                                    // lever used to couple hanger → garment pivots
  const H = { z: new Osc(3.3, 0.045), x: new Osc(3.6, 0.06), y: new Osc(2.3, 0.1) };
  const B = { z: new Osc(5.0, 0.10), x: new Osc(5.4, 0.12) };
  const S = {
    '-1': { z: new Osc(4.3, 0.09), x: new Osc(4.6, 0.11) },
    '1': { z: new Osc(4.3, 0.09), x: new Osc(4.6, 0.11) },
  };
  if (!reduced) { H.z.x = 0.52; H.x.x = -0.16; H.y.x = 0.3; }

  const ptr = { x: 0, y: 0, vx: 0, vy: 0, over: false, has: false, t: 0 };
  const drag = { on: false, id: -1, gy: 0 };
  let spinTarget = 0, spin = 0, scrollVel = 0, lastScroll = scrollY;
  let running = true, last = performance.now(), time = 0;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpV = new THREE.Vector3();

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = w / h, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needH = 2.5, needW = 2.0;
    const dist = Math.max(needH / (2 * tan), needW / (2 * tan * aspect));
    const visH = 2 * dist * tan;
    const railFrac = aspect < 0.8 ? 0.2 : 0.07;               // where the rail sits, as a fraction of the canvas height
    const lookY = railFrac * visH - visH / 2;
    const rep = aspect < 0.8 ? 0.55 : 1;                      // chunkier weave on phones so it doesn't shimmer
    map.repeat.set(rep, rep); normalMap.repeat.set(rep, rep);
    camera.position.set(0, lookY, dist);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  size();
  new ResizeObserver(size).observe(canvas);

  function setNdc(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  }
  function pick() {
    ndc.set(ptr.x, ptr.y);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(hit, false)[0];
  }
  function planePoint() {
    ndc.set(ptr.x, ptr.y);
    ray.setFromCamera(ndc, camera);
    const t = -ray.ray.origin.z / ray.ray.direction.z;
    return ray.ray.at(t, tmpV);
  }

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = setNdc(e);
    const now = performance.now();
    if (ptr.has) {
      const dt = Math.max(0.008, (now - ptr.t) / 1000);
      ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5;
      ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5;
    }
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.has = true;
    ptr.over = !!pick();
    canvas.style.cursor = drag.on ? 'grabbing' : ptr.over ? 'grab' : '';
    hero?.classList.toggle('is-over', ptr.over);
  });
  canvas.addEventListener('pointerleave', () => { ptr.over = false; ptr.has = false; ptr.vx = ptr.vy = 0; hero?.classList.remove('is-over'); });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = setNdc(e);
    ptr.x = x; ptr.y = y; ptr.t = performance.now(); ptr.has = true;
    if (pick()) {
      drag.on = true; drag.id = e.pointerId; drag.gy = planePoint().y;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      hero?.classList.add('is-dragging');
    }
  });
  const release = () => {
    if (!drag.on) return;
    drag.on = false;
    canvas.style.cursor = ptr.over ? 'grab' : '';
    hero?.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const io = new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; if (running) last = performance.now(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

  const breeze = (t) => Math.sin(t * 0.9) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.3 + Math.sin(t * 0.37 + 2) * 0.4;

  function stepPhysics(dt) {
    time += dt;
    const breezeK = reduced ? 0 : 1;

    /* pointer forcing */
    let fz = 0, fx = 0, fy = 0;
    if (ptr.over && !drag.on && ptr.has) {
      H.z.v += ptr.vx * 1.35 * dt;
      H.x.v += -ptr.vy * 0.9 * dt;
      H.y.v += ptr.vx * 0.55 * dt;
      ptr.vx *= 0.9; ptr.vy *= 0.9;
    }
    if (drag.on) {
      const p = planePoint();
      const target = clamp(Math.asin(clamp(p.x / Lh, -0.95, 0.95)), -0.85, 0.85);
      const targetX = clamp((drag.gy - p.y) * 0.9, -0.5, 0.5);
      fz += 95 * (target - H.z.x) - 15 * H.z.v;
      fx += 55 * (targetX - H.x.x) - 10 * H.x.v;
      fy += -6 * H.y.v + 40 * (target * 0.5 - H.y.x);
    }

    /* breeze + scroll */
    fz += breeze(time) * 0.22 * breezeK;
    fx += breeze(time * 0.8 + 4) * 0.12 * breezeK;
    fy += breeze(time * 0.6 + 9) * 0.10 * breezeK;
    scrollVel *= 0.9;
    fx += scrollVel * 5;

    H.z.step(dt, fz); H.x.step(dt, fx); H.y.step(dt, fy);

    /* garment pivots are pushed by the hanger's acceleration */
    const lb = 0.5;
    B.z.step(dt, -(Lh / lb) * H.z.a * 0.9);
    B.x.step(dt, -(Lh / lb) * H.x.a * 0.9);
    const ls = 0.55;
    for (const side of [-1, 1]) {
      const sc = S[side];
      sc.z.step(dt, -(Lh / ls) * H.z.a * 0.9 + side * 0.4 * H.y.v * 0.6);
      sc.x.step(dt, -(Lh / ls) * H.x.a * 0.9 - (side * 0.57 * H.y.a) / ls * 0.5);
    }
    spin += (spinTarget - spin) * Math.min(1, dt * 4);
  }

  function apply() {
    swing.rotation.set(H.x.x, H.y.x + spin, H.z.x);
    const rel = { z: B.z.x - H.z.x, x: B.x.x - H.x.x };
    bodyU.uBend.value.set(clamp(rel.z, -0.7, 0.7) * 0.85, clamp(rel.x, -0.7, 0.7) * 0.7);
    for (const side of [-1, 1]) {
      const g = sleeves[side], sc = S[side];
      g.rotation.z = clamp(sc.z.x - H.z.x, -0.9, 0.9);
      g.rotation.x = clamp(sc.x.x - H.x.x, -0.8, 0.8);
      const U = side < 0 ? sleeveU.L : sleeveU.R;
      U.uBend.value.set(clamp(sc.z.v * 0.05 + (sc.z.x - B.z.x) * 0.3, -0.4, 0.4), clamp(sc.x.v * 0.04, -0.4, 0.4));
    }
    const speed = Math.min(1, Math.hypot(H.z.v, H.x.v) / 1.6);
    const flutter = 0.0025 + 0.012 * speed;
    for (const U of [bodyU, sleeveU.L, sleeveU.R]) { U.uTime.value = time; U.uFlut.value = flutter; }
  }

  function placeHotspot() {
    if (!hotspot) return;
    anchor.getWorldPosition(tmpV);
    tmpV.project(camera);
    const r = canvas.getBoundingClientRect();
    hotspot.style.transform = `translate3d(${((tmpV.x + 1) / 2) * r.width}px, ${((1 - tmpV.y) / 2) * r.height}px, 0)`;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    let dt = Math.min(0.033, (now - last) / 1000); last = now;
    const sub = 3;
    for (let i = 0; i < sub; i++) stepPhysics(dt / sub);
    apply();
    placeHotspot();
    renderer.render(scene, camera);
  }
  apply(); placeHotspot(); renderer.render(scene, camera);
  requestAnimationFrame(frame);

  addEventListener('scroll', () => {
    const y = scrollY, vh = innerHeight;
    spinTarget = reduced ? 0 : clamp(y / vh, 0, 1) * 1.25;
    scrollVel = clamp(scrollVel + (y - lastScroll) * 0.0009, -0.8, 0.8);
    lastScroll = y;
  }, { passive: true });

  return {
    setColor(hex) { for (const m of tintMats) m.color.set(hex); },
    nudge(amount = 1) { H.z.v += 1.6 * amount; H.x.v -= 0.5 * amount; H.y.v += 0.9 * amount; },
    /* test helper: advance the simulation without rendering each step */
    settle(seconds = 10, step = 1 / 120) {
      for (let t = 0; t < seconds; t += step) stepPhysics(step);
      apply(); placeHotspot(); renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); },
  };
}
