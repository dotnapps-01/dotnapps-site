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

/** per-garment pixel painters: (x, y) -> {r,g,b,h,rough?,metal?,nx?,ny?}   colours 0..255, h 0..1 */
const stitchDash = (d, s, off, w = 0.0013, dash = 0.0095) => Math.abs(d - off) < w && fract(s / dash) < 0.62;

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

  /* brushed-back cotton fleece, ribbed cuffs and hem, kangaroo pocket */
  hoodie: (tint, poly) => {
    const bands = edgeField(poly, ['gather', 'neck']);
    const hem = edgeField(poly, ['hemg']);
    return (x, y) => {
      const n1 = vnoise(x * 420, y * 420), n2 = vnoise(x * 1100, y * 1100);
      let h = 0.35 + 0.4 * n1 + 0.25 * n2, f = 0.93 + 0.07 * n1 + (vnoise(x * 12, y * 12) - 0.5) * 0.06;
      const b = bands(x, y), o = hem(x, y);
      const w = b.tag === 'neck' ? 0.04 : 0.1;
      let rib = false;
      if (b.d < w) { const r = ribbing(b.s, 0.02); h = 0.25 + 0.75 * r; f = (0.66 + 0.3 * r) * 0.95; if (b.d > w - 0.004) f *= 0.78; rib = true; }
      else if (o.d < 0.1 && y < -0.8) { const r = ribbing(o.s, 0.02); h = 0.25 + 0.75 * r; f = (0.66 + 0.3 * r) * 0.95; if (o.d > 0.096) f *= 0.78; rib = true; }
      if (!rib) {
        /* kangaroo pocket: a trapezoid with angled openings, topstitched */
        const top = -0.58, bot = -0.96, ax = Math.abs(x);
        const sideX = 0.25 + (top - y) * (0.07 / 0.38);
        if (y < top && y > bot && ax < sideX) {
          f *= 0.975;
          const dTop = Math.abs(y - top), dSide = Math.abs(ax - sideX), dBot = Math.abs(y - bot);
          if (dTop < 0.0022 || dSide < 0.0022 || dBot < 0.0022) { f *= 0.7; h -= 0.3; }
          if ((Math.abs(y - (top - 0.012)) < 0.0012 || Math.abs(ax - (sideX - 0.012)) < 0.0012) && fract((x + y) / 0.0095) < 0.62) f *= 0.86;
        }
        /* a heavy shoulder seam shadow */
      }
      return { r: tint[0] * f, g: tint[1] * f, b: tint[2] * f, h, rough: 0.97 };
    };
  },

  /* ripstop nylon shell, horizontal baffles, front zip and zipped pockets */
  puffer: (tint, poly) => {
    const bands = edgeField(poly, ['gather', 'hemg']);
    return (x, y) => {
      const rip = (Math.abs(fract(x / 0.011) - 0.5) < 0.04 || Math.abs(fract(y / 0.011) - 0.5) < 0.04) ? 1 : 0;
      let h = 0.5 + 0.12 * rip + 0.05 * vnoise(x * 600, y * 600);
      const sP = (y + 0.1) / 0.2, fr = sP - Math.floor(sP);
      let f = (0.78 + 0.22 * Math.sin(Math.PI * fr)) * (1 + 0.05 * rip) * (0.97 + (vnoise(x * 10, y * 10) - 0.5) * 0.08);
      /* stitch lines between baffles */
      const dl = Math.min(fr, 1 - fr) * 0.2;
      if (dl < 0.0034) { f *= 0.55; h -= 0.35; }
      if (dl < 0.0105 && dl > 0.006 && fract(x / 0.0095) < 0.55) f *= 0.9;
      /* elastic cuffs and hem */
      const b = bands(x, y);
      let r = tint[0], g = tint[1], bl = tint[2], rough = 0.34;
      if (b.d < 0.07 && y < 0.1) { const rr = ribbing(b.s, 0.016); f = 0.5 + 0.28 * rr; h = 0.3 + 0.7 * rr; rough = 0.85; if (b.d > 0.066) f *= 0.8; }
      /* zip + pockets */
      if (y < -0.07) {
        if (Math.abs(x) < 0.007) { f = 0.55 + 0.4 * (fract(y / 0.008) < 0.5 ? 1 : 0.4); r = 190; g = 184; bl = 170; h = 0.7; rough = 0.3; }
        else if (Math.abs(x) < 0.02) { f *= 0.82; h += 0.05; }
        if (y > -0.2 && y < -0.075 && Math.hypot(x, y + 0.18) < 0.017) { r = 198; g = 190; bl = 172; f = 1.1; h = 0.9; }
        const px = Math.abs(x);
        const pl = -0.46 - (px - 0.27) * 0.35;               // slanted pocket zip
        if (px > 0.2 && px < 0.42 && Math.abs(y - pl) < 0.0045) { f *= 0.45; h -= 0.3; }
      }
      return { r: r * f, g: g * f, b: bl * f, h, rough };
    };
  },

  /* light-wash straight denim with fades, topstitching, rivets and belt loops */
  jeans: (tint) => {
    const topstitch = [0xc9, 0xa3, 0x55];
    const outer = (y) => 0.315 + (0.40 - 0.315) * Math.min(1, (-0.05 - y) / 0.95);
    return (x, y) => {
      const ax = Math.abs(x);
      const warp = 0.5 + 0.5 * Math.sin((x / 0.0042) * Math.PI * 2), weft = 0.5 + 0.5 * Math.sin((y / 0.0042) * Math.PI * 2 + 1.2 * Math.sin(x * 40));
      let h = 0.3 + 0.35 * warp * weft + 0.25 * twill(x, y, 0.006) + 0.1 * vnoise(x * 700, y * 700);
      /* wash: hip + thigh whiskers, knee fade, lighter hem */
      let fade = 0.45 * vnoise(x * 9, y * 9) + 0.3 * vnoise(x * 24, y * 5);
      fade += 0.35 * Math.exp(-Math.pow((y + 1.08) / 0.16, 2)) * (0.6 + 0.4 * vnoise(x * 30, y * 30));        // knee
      fade += 0.4 * Math.exp(-Math.pow((y + 0.62) / 0.12, 2)) * smooth(0.1, 0.3, ax);                       // thigh
      fade += 0.5 * smooth(-1.5, -1.72, y);                                                                // hem
      const whisker = vnoise(x * 70 + y * 10, y * 2.5) > 0.74 && y < -0.42 && y > -0.8 && ax < 0.24 ? 0.07 : 0;
      let f = 0.7 + 0.12 * warp * weft + fade * 0.3 + whisker;
      let r = tint[0], g = tint[1], b = tint[2];
      let rough = 0.82;
      const stitch = (d, s, off) => stitchDash(d, s, off, 0.0014, 0.011);
      /* waistband */
      if (y > -0.19) {
        f *= 0.92; h += 0.08;
        if (Math.abs(y + 0.19) < 0.0022) { f *= 0.55; }
        if (Math.abs(y + 0.178) < 0.0012 && fract(x / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; }
        if (Math.abs(y + 0.058) < 0.0012 && fract(x / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; }
        for (const lx of [-0.235, -0.085, 0.085, 0.235]) if (Math.abs(x - lx) < 0.0095 && y > -0.205) { f *= 0.82; if (Math.abs(Math.abs(x - lx) - 0.0095) < 0.0012) f *= 0.8; }
        if (ax < 0.017 && Math.abs(y + 0.115) < 0.017 && Math.hypot(x, (y + 0.115) * 1.0) < 0.017) { r = 205; g = 168; b = 108; f = 1.05; h = 0.9; rough = 0.25; }
      } else {
        /* fly J-stitch */
        const fx = x - 0.0; const dFly = Math.abs(fx - (y > -0.5 ? 0.03 : 0.03 - (y + 0.5) * 0.0));
        if (y < -0.19 && y > -0.56 && fx > 0) { const t = Math.abs(x - 0.034); if (t < 0.0013 && fract(y / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; } }
        if (Math.abs(x) < 0.0017 && y < -0.19 && y > -0.77) f *= 0.7;
        /* front scoop pockets */
        const pk = Math.abs(ax - (0.13 + 0.19 * smooth(-0.19, -0.5, y))) ;
        if (ax > 0.1 && ax < 0.33 && y < -0.19 && y > -0.52 && pk < 0.0014) { f *= 0.55; }
        if (ax > 0.1 && ax < 0.33 && y < -0.19 && y > -0.52 && Math.abs(pk - 0.012) < 0.0012 && fract(y / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; }
        if (Math.hypot(ax - 0.315, y + 0.215) < 0.0075) { r = 205; g = 168; b = 108; f = 1.1; h = 0.9; rough = 0.25; }     // rivets
        /* outer-seam topstitching */
        const od = Math.abs(ax - outer(y)); const ox = outer(y) - ax;
        if (ox > 0 && ox < 0.03) { if (Math.abs(ox - 0.013) < 0.0013 && fract(y / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; } if (ox < 0.0035) { f *= 0.78; } }
        /* inseam */
        const ins = 0.095 - (0.095 - 0.036) * Math.min(1, (y + 1.72) / 0.92);
        if (y < -0.77 && Math.abs(ax - ins) < 0.003) f *= 0.82;
        /* hem stitch */
        if (y < -1.58 && Math.abs(y + 1.69) < 0.0013 && fract(x / 0.011) < 0.62) { r = topstitch[0]; g = topstitch[1]; b = topstitch[2]; f = 0.95; }
      }
      return { r: r * f, g: g * f, b: b * f, h: Math.min(1, h), rough };
    };
  },
};

/**
 * @returns {{map:THREE.CanvasTexture, normalMap:THREE.CanvasTexture}}
 */
export function paintFabric({ kind, color, poly, atlas, size = 768, normalK = 2.2, anisotropy = 8, rough = 0.9 }) {
  const paint = PAINT[kind](hex(color), poly);
  const seams = kind === 'knit' || kind === 'jeans' ? null : edgeField(poly, ['seam', 'hang']);
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
