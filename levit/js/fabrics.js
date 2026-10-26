/* Procedural fabric: colour + normal maps painted in pattern space, so cuffs, plackets, pockets and
 * buttons sit exactly where the sewing pattern puts them and follow the cloth as it moves. */
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** nearest point on the tagged edges: distance and running coordinate along the edge */
function edgeField(poly, tags) {
  const segs = [];
  poly.pts.forEach((p, i) => {
    if (!tags.includes(poly.tags[i])) return;
    const q = poly.pts[(i + 1) % poly.pts.length];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    segs.push({ ax: p[0], ay: p[1], dx: dx / l, dy: dy / l, l, tag: poly.tags[i] });
  });
  return (x, y) => {
    let best = 1e9, s = 0, tag = null;
    for (const g of segs) {
      const t = Math.max(0, Math.min(g.l, (x - g.ax) * g.dx + (y - g.ay) * g.dy));
      const d = Math.hypot(x - (g.ax + g.dx * t), y - (g.ay + g.dy * t));
      if (d < best) { best = d; s = t; tag = g.tag; }
    }
    return { d: best, s, tag };
  };
}

/* --------------------------------------------------------------- weave kernels (return height 0..1) */
const waffle = (x, y, c = 0.017) => {
  const fx = fract(x / c), fy = fract(y / c);
  const e = Math.min(fx, 1 - fx, fy, 1 - fy);
  const plate = smooth(0.02, 0.44, e);
  return Math.min(1, plate * (0.9 + 0.1 * Math.sin((y / c) * Math.PI * 8)) + 0.05 * Math.sin((x / c) * Math.PI * 6));
};
const ribbing = (s, w = 0.017) => 0.5 + 0.5 * Math.cos((s / w) * Math.PI * 2);
const plainWeave = (x, y, c = 0.0065) => 0.5 + 0.5 * Math.sin((x / c) * Math.PI * 2) * Math.sin((y / c) * Math.PI * 2);
const twill = (x, y, c = 0.0085) => 0.5 + 0.5 * Math.sin(((x + y) / c) * Math.PI * 2);
const crepe = (x, y) => 0.55 * vnoise(x * 260, y * 260) + 0.3 * vnoise(x * 620, y * 620) + 0.15 * vnoise(x * 1500, y * 1500);

/** per-garment pixel painters: (x, y, field) -> {r,g,b,h}   colours in 0..255, h in 0..1 */
const PAINT = {
  knit: (tint, poly) => {
    const bands = edgeField(poly, ['gather', 'neck']);
    const hem = edgeField(poly, ['hemg']);
    return (x, y) => {
      let h = waffle(x, y), f = 0.7 + 0.3 * h + (hash((x * 900) | 0, (y * 900) | 0) - 0.5) * 0.07;
      const b = bands(x, y), o = hem(x, y);
      const isNeck = b.tag === 'neck';
      const w = isNeck ? 0.036 : 0.085;
      if (b.d < w) {
        const rib = ribbing(b.s, 0.019); h = 0.25 + 0.75 * rib; f = (0.6 + 0.32 * rib) * 0.94;
        if (b.d > w - 0.004) f *= 0.8;
      } else if (o.d < 0.095 && y < -0.7) {
        const rib = ribbing(o.s, 0.019); h = 0.25 + 0.75 * rib; f = (0.6 + 0.32 * rib) * 0.94;
        if (o.d > 0.091) f *= 0.8;
      }
      return { r: tint[0] * f, g: tint[1] * f, b: tint[2] * f, h };
    };
  },
  dress: (tint) => (x, y) => {
    let h = 0.5 + 0.08 * plainWeave(x, y, 0.005), f = 0.92 + 0.08 * h;
    /* ruching: soft diagonal gathers running in from both side seams */
    const ax = Math.abs(x);
    const zone = smooth(0.14, 0.3, ax) * smooth(-0.32, -0.5, y) * (1 - smooth(-1.05, -1.2, y));
    if (zone > 0) {
      const wave = 0.5 + 0.5 * Math.sin(((y - 0.5 * (ax - 0.14)) / 0.058) * Math.PI * 2);
      h += zone * (wave - 0.5) * 0.55; f *= 1 - zone * (0.22 * (1 - wave));
    }
    /* sparkle: scattered micro-sequins that catch the light */
    const gx = Math.floor(x / 0.017), gy = Math.floor(y / 0.017);
    const r = hash(gx, gy);
    let spark = 0;
    if (r > 0.82) {
      const cx = (gx + 0.5) * 0.017 + (hash(gx + 7, gy) - 0.5) * 0.008, cy = (gy + 0.5) * 0.017 + (hash(gx, gy + 7) - 0.5) * 0.008;
      const d = Math.hypot(x - cx, y - cy) / 0.0034;
      if (d < 1) { spark = (1 - d * d) * (0.5 + 0.5 * hash(gx + 3, gy + 5)); h += spark * 0.5; }
    }
    return { r: tint[0] * f + spark * 230, g: tint[1] * f + spark * 230, b: tint[2] * f + spark * 235, h: Math.min(1, h) };
  },
  blouse: (tint, poly) => {
    const bands = edgeField(poly, ['gather', 'neck']);
    return (x, y) => {
      let h = plainWeave(x, y), f = 0.86 + 0.14 * h + (vnoise(x * 90, y * 90) - 0.5) * 0.05;
      let r = tint[0], g = tint[1], b = tint[2];
      const bd = bands(x, y);
      if (bd.d < (bd.tag === 'neck' ? 0.04 : 0.06)) { f *= 1.04; if (Math.abs(bd.d - (bd.tag === 'neck' ? 0.04 : 0.06)) < 0.003) f *= 0.82; }
      /* placket + buttons */
      if (y < -0.12 && Math.abs(x) < 0.04) {
        f *= 1.05;
        if (Math.abs(Math.abs(x) - 0.04) < 0.0016) f *= 0.8;
        if (Math.abs(Math.abs(x) - 0.026) < 0.0013 && fract(y / 0.014) < 0.6) f *= 0.84;
      }
      const by = (y + 0.32) / 0.17, bi = Math.round(by), cy = -0.32 + bi * 0.17;
      if (bi >= 0 && bi < 6) {
        const d = Math.hypot(x, y - cy);
        if (d < 0.0175) { const e = d / 0.0175; f = 1.18 - 0.3 * e * e; r = 245; g = 238; b = 226; h = 0.95 - e * 0.5; if (Math.hypot(Math.abs(x) - 0.0045, Math.abs(y - cy) - 0.0045) < 0.0017) { r = g = b = 70; f = 1; h = 0.1; } }
      }
      return { r: r * f, g: g * f, b: b * f, h };
    };
  },
  shacket: (tint, poly) => {
    const cuff = edgeField(poly, ['gather']);
    const neck = edgeField(poly, ['neck']);
    const stitch = (d, s, w = 0.0016, dash = 0.012) => d < w && fract(s / dash) < 0.62;
    return (x, y) => {
      let h = twill(x, y), f = 0.84 + 0.16 * h + (vnoise(x * 120, y * 120) - 0.5) * 0.08;
      let r = tint[0], g = tint[1], b = tint[2];
      const lit = (k) => { r += k; g += k; b += k; };
      /* chest pockets with flap and stitching */
      for (const sx of [-1, 1]) {
        const px = sx * 0.27, py = -0.52, hw = 0.1, hh = 0.115;
        const dx = Math.abs(x - px) - hw, dy = Math.abs(y - py) - hh;
        const d = Math.max(dx, dy);
        if (d < 0 && Math.abs(d) < 0.002) f *= 0.6;
        if (Math.abs(d + 0.012) < 0.0012 && fract((x + y) / 0.011) < 0.6) { lit(34); f *= 1.04; }
        if (Math.abs(y - (py + hh - 0.05)) < 0.0012 && dx < -0.004) f *= 0.65;
      }
      /* front placket and buttons */
      if (y < -0.1 && Math.abs(x) < 0.042) {
        f *= 1.04; if (Math.abs(Math.abs(x) - 0.042) < 0.0016) f *= 0.7;
        const bi = Math.round((y + 0.3) / 0.205), cy = -0.3 + bi * 0.205;
        if (bi >= 0 && bi < 5 && Math.hypot(x, y - cy) < 0.016) { const e = Math.hypot(x, y - cy) / 0.016; r = 214; g = 190; b = 150; f = 1.1 - 0.4 * e; h = 0.9 - e * 0.5; }
      }
      const c = cuff(x, y); if (c.d < 0.075) { f *= 0.94; if (Math.abs(c.d - 0.075) < 0.0025) f *= 0.72; if (stitch(Math.abs(c.d - 0.065), c.s)) lit(30); }
      const n = neck(x, y); if (n.d < 0.055) { f *= 1.07; if (Math.abs(n.d - 0.055) < 0.0025) f *= 0.7; }
      return { r: r * f, g: g * f, b: b * f, h };
    };
  },
  trouser: (tint) => (x, y) => {
    let h = crepe(x, y), f = 0.9 + 0.12 * h;
    /* waistband, fly, pressed creases */
    if (y > -0.4) { f *= 1.06; if (Math.abs(y + 0.4) < 0.0022) f *= 0.7; if (Math.abs(y + 0.285) < 0.0016 && fract(x / 0.012) < 0.6) f *= 0.8; }
    if (Math.abs(x) < 0.0016 && y < -0.4 && y > -0.85) f *= 0.8;
    if (y < -0.5) for (const cx of [-0.205, 0.205]) { const d = Math.abs(x - cx); if (d < 0.003) f *= 1.0 + 0.1 * (1 - d / 0.003) * (x > 0 ? 1 : 1) * 0.6 - 0.07; }
    if (y > -0.4 && Math.abs(Math.abs(x) - 0.22) < 0.0015 && y < -0.3) f *= 0.8;
    if (y > -0.4 && Math.hypot(x, y + 0.34) < 0.012) { return { r: 214 * 1.0, g: 184 * 1.0, b: 112 * 1.0, h: 0.9 }; }
    return { r: tint[0] * f, g: tint[1] * f, b: tint[2] * f, h: h * 0.6 };
  },
};

/**
 * @returns {{map:THREE.CanvasTexture, normalMap:THREE.CanvasTexture}}
 */
export function paintFabric({ kind, color, poly, atlas, size = 768, normalK = 2.2, anisotropy = 8 }) {
  const paint = PAINT[kind](hex(color), poly);
  const N = size;
  const col = document.createElement('canvas'), nor = document.createElement('canvas');
  col.width = col.height = nor.width = nor.height = N;
  const cc = col.getContext('2d'), nc = nor.getContext('2d');
  const ci = cc.createImageData(N, N), ni = nc.createImageData(N, N);
  const H = new Float32Array(N * N);
  const px = (i) => atlas.x0 + ((i + 0.5) / N) * atlas.S;
  const py = (j) => atlas.y0 + atlas.S - ((j + 0.5) / N) * atlas.S;
  for (let j = 0; j < N; j++) {
    const y = py(j);
    for (let i = 0; i < N; i++) {
      const o = paint(px(i), y);
      const k = (j * N + i) * 4;
      ci.data[k] = Math.min(255, o.r); ci.data[k + 1] = Math.min(255, o.g); ci.data[k + 2] = Math.min(255, o.b); ci.data[k + 3] = 255;
      H[j * N + i] = o.h;
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = (j * N + i) * 4;
      const dx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)];
      const dy = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
      let nx = -dx * normalK, ny = dy * normalK, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      ni.data[k] = (nx * 0.5 + 0.5) * 255; ni.data[k + 1] = (ny * 0.5 + 0.5) * 255; ni.data[k + 2] = (nz * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); nc.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(col), normalMap = new THREE.CanvasTexture(nor);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; }
  return { map, normalMap };
}
