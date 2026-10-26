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
      let h = waffle(x, y);
      const cell = hash(Math.floor(x / 0.017), Math.floor(y / 0.017));
      let f = 0.7 + 0.3 * h + (hash((x * 900) | 0, (y * 900) | 0) - 0.5) * 0.07 + (cell - 0.5) * 0.07 + (vnoise(x * 14, y * 14) - 0.5) * 0.09;
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
    /* sequins: tiny discs, each tilted differently so they glint as the cloth moves */
    const gx = Math.floor(x / 0.02), gy = Math.floor(y / 0.02);
    const r = hash(gx, gy);
    let spark = 0, rough = 0.4, metal = 0, nx = 0, ny = 0;
    if (r > 0.4) {
      const cx = (gx + 0.5 + (hash(gx + 7, gy) - 0.5) * 0.4) * 0.02, cy = (gy + 0.5 + (hash(gx, gy + 7) - 0.5) * 0.4) * 0.02;
      const d = Math.hypot(x - cx, y - cy) / 0.0072;
      if (d < 1) {
        spark = 1 - smooth(0.82, 1, d); rough = 0.14; metal = 0.9;
        nx = (hash(gx + 3, gy + 5) - 0.5) * 1.5; ny = (hash(gx + 9, gy + 1) - 0.5) * 1.5;
        h += 0.35;
      }
    }
    const lum = 0.55 + 0.45 * hash(gx + 11, gy + 13);
    return { r: tint[0] * f * (1 - spark) + spark * 205 * lum, g: tint[1] * f * (1 - spark) + spark * 200 * lum, b: tint[2] * f * (1 - spark) + spark * 195 * lum, h: Math.min(1, h), rough, metal, nx, ny };
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
export function paintFabric({ kind, color, poly, atlas, size = 768, normalK = 2.2, anisotropy = 8, rough = 0.9 }) {
  const paint = PAINT[kind](hex(color), poly);
  const seams = kind === 'knit' ? null : edgeField(poly, ['seam', 'hang']);
  const N = size;
  const col = document.createElement('canvas'), nor = document.createElement('canvas'), orm = document.createElement('canvas');
  col.width = col.height = nor.width = nor.height = orm.width = orm.height = N;
  const cc = col.getContext('2d'), nc = nor.getContext('2d'), oc = orm.getContext('2d');
  const ci = cc.createImageData(N, N), ni = nc.createImageData(N, N), oi = oc.createImageData(N, N);
  const H = new Float32Array(N * N), NX = new Float32Array(N * N), NY = new Float32Array(N * N);
  const px = (i) => atlas.x0 + ((i + 0.5) / N) * atlas.S;
  const py = (j) => atlas.y0 + atlas.S - ((j + 0.5) / N) * atlas.S;
  for (let j = 0; j < N; j++) {
    const y = py(j);
    for (let i = 0; i < N; i++) {
      const x = px(i);
      const o = paint(x, y);
      let f = 1, hh = o.h;
      if (seams) {
        const sd = seams(x, y);
        if (sd.d < 0.02) {
          const e = Math.abs(sd.d - 0.011);
          if (e < 0.0013 && fract(sd.s / 0.0095) < 0.62) { f = 0.8; hh -= 0.25; }       // topstitch
          if (sd.d < 0.0035) { f *= 0.9; hh -= 0.12; }                                    // seam allowance ridge
        }
      }
      const k = (j * N + i) * 4;
      ci.data[k] = Math.min(255, o.r * f); ci.data[k + 1] = Math.min(255, o.g * f); ci.data[k + 2] = Math.min(255, o.b * f); ci.data[k + 3] = 255;
      oi.data[k] = 255; oi.data[k + 1] = (o.rough ?? rough) * 255; oi.data[k + 2] = (o.metal ?? 0) * 255; oi.data[k + 3] = 255;
      H[j * N + i] = hh; NX[j * N + i] = o.nx || 0; NY[j * N + i] = o.ny || 0;
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = (j * N + i) * 4, q = j * N + i;
      const dx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)];
      const dy = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
      let nx = -dx * normalK + NX[q], ny = dy * normalK + NY[q], nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      ni.data[k] = (nx * 0.5 + 0.5) * 255; ni.data[k + 1] = (ny * 0.5 + 0.5) * 255; ni.data[k + 2] = (nz * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); nc.putImageData(ni, 0, 0); oc.putImageData(oi, 0, 0);
  const map = new THREE.CanvasTexture(col), normalMap = new THREE.CanvasTexture(nor), ormMap = new THREE.CanvasTexture(orm);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, ormMap]) { t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; }
  return { map, normalMap, ormMap };
}

/** a tiling fibre texture: fine strands and fuzz, layered over the weave as a bump map */
export function fiberTexture(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wrap = (n, f) => { const fx = u * f, fy = v * f; const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const h = (a, b) => hash((a % f + f) % f + n * 31, (b % f + f) % f); return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy; };
    let val = 0.45 * wrap(1, 16) + 0.3 * wrap(2, 48) + 0.25 * wrap(3, 128);
    val += 0.1 * Math.sin((u * 64 + 3 * wrap(4, 8)) * Math.PI * 2);            // strand direction
    const k = (y * size + x) * 4; const b = Math.max(0, Math.min(255, val * 200));
    im.data[k] = im.data[k + 1] = im.data[k + 2] = b; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
