/* Position-based cloth for garments.
 *
 * A garment is two sewing-pattern sheets (front, back) cut from the same outline. Each outline edge carries a tag:
 *   hang   – pinned to the hanger          seam   – front and back are stitched together
 *   open   – free edge (hem, neckline)     gather – elasticated edge (cuffs); the edge is cinched
 * The sheets are meshed on a regular grid clipped to the outline, so the silhouette is exact while the
 * topology stays a clean quad grid that the solver (stretch, shear, bend, thickness) can drive.
 */

/* ---------------------------------------------------------------- geometry helpers */
export function polyBounds(pts) {
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const [x, y] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  return { minx, maxx, miny, maxy };
}

function inside(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function closest(x, y, P) {
  let best = { d: 1e9, x: 0, y: 0, e: 0 };
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + dx * t, py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { d, x: px, y: py, e: i };
  }
  return best;
}

/** Build a right-hand half outline into a full symmetric loop. Half runs from top-centre to bottom-centre. */
export function mirrorOutline(half, tags) {
  const pts = half.map((p) => [p[0], p[1]]);
  const tg = [...tags];
  for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
  // edges around the mirrored side, traversed in reverse
  for (let i = half.length - 1; i >= 1; i--) tg.push(tags[i - 1]);
  tg.length = pts.length;                // closing edge back to the start
  return { pts, tags: tg };
}

/* ------------------------------------------------------------------- sheet meshing */
function meshSheet(poly, h, b) {
  const P = poly.pts, T = poly.tags;
  const nx = Math.ceil((b.maxx - b.minx) / h) + 3, ny = Math.ceil((b.maxy - b.miny) / h) + 3;
  const x0 = b.minx - h, y0 = b.maxy + h;
  const id = new Int32Array(nx * ny).fill(-1);
  const verts = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let x = x0 + i * h, y = y0 - j * h;
      const ins = inside(x, y, P);
      const c = closest(x, y, P);
      if (!ins && c.d > 1.0 * h) continue;
      let tag = null;
      if (!ins || c.d < 0.5 * h) { x = c.x; y = c.y; tag = T[c.e]; }
      id[j * nx + i] = verts.length;
      verts.push({ x, y, i, j, tag });
    }
  }
  const tris = [];
  const ok = (x, y) => inside(x, y, P) || closest(x, y, P).d < 0.45 * h;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = id[j * nx + i], bq = id[j * nx + i + 1], c = id[(j + 1) * nx + i], d = id[(j + 1) * nx + i + 1];
      if (a < 0 || bq < 0 || c < 0 || d < 0) continue;
      const cand = (i + j) % 2 === 0 ? [[a, c, bq], [bq, c, d]] : [[a, c, d], [a, d, bq]];
      for (const t of cand) {
        const cx = (verts[t[0]].x + verts[t[1]].x + verts[t[2]].x) / 3, cy = (verts[t[0]].y + verts[t[1]].y + verts[t[2]].y) / 3;
        if (!ok(cx, cy)) continue;
        const A = verts[t[0]], B = verts[t[1]], C = verts[t[2]];
        if (!ok((A.x + B.x) / 2, (A.y + B.y) / 2) || !ok((B.x + C.x) / 2, (B.y + C.y) / 2) || !ok((A.x + C.x) / 2, (A.y + C.y) / 2)) continue;
        const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
        if (area < h * h * 0.03) continue;
        tris.push(t);
      }
    }
  }
  return { verts, tris, id, nx, ny };
}

/* ----------------------------------------------------------------------- cloth */
export class Cloth {
  /**
   * @param {object} o
   * @param {{pts:number[][],tags:string[]}} o.front  outline of the front sheet
   * @param {{pts:number[][],tags:string[]}} o.back   outline of the back sheet
   * @param {number} o.h            grid spacing
   * @param {(x:number,y:number)=>number} o.thick   minimum front/back separation at a layout point
   * @param {(x:number,y:number)=>number} o.hangY   y of the hanger line for a pinned x
   * @param {number} o.pinZ         half-thickness of the hanger at the pin line
   * @param {{gather?:number,neck?:number}} [o.shrink]  rest-length scale for elasticated / bound edges
   * @param {number} o.iterations
   */
  constructor(o) {
    this.o = o;
    const bounds = polyBounds([...o.front.pts, ...o.back.pts]);
    this.bounds = bounds;
    const F = meshSheet(o.front, o.h, bounds), B = meshSheet(o.back, o.h, bounds);
    const shrink = { gather: 0.55, neck: 0.9, hemg: 0.85, ...(o.shrink || {}) };

    /* particles: front vertices, then back vertices (seam vertices are shared with the front) */
    const lay = [];          // layout x,y per particle
    const sheetOf = [];      // 0 front / 1 back (welded keep 0)
    const tagOf = [];
    const fmap = new Int32Array(F.verts.length), bmap = new Int32Array(B.verts.length);
    const byKey = new Map();
    F.verts.forEach((v, k) => { fmap[k] = lay.length; lay.push([v.x, v.y]); sheetOf.push(0); tagOf.push(v.tag); byKey.set(v.j * F.nx + v.i, k); });
    B.verts.forEach((v, k) => {
      const fk = byKey.get(v.j * B.nx + v.i);
      if (fk !== undefined && v.tag === 'seam' && F.verts[fk].tag === 'seam') { bmap[k] = fmap[fk]; return; }
      bmap[k] = lay.length; lay.push([v.x, v.y]); sheetOf.push(1); tagOf.push(v.tag);
    });
    const N = lay.length;
    this.N = N;
    this.lay = lay;

    /* index buffer: front as built, back wound the other way */
    const idx = [];
    for (const t of F.tris) idx.push(fmap[t[0]], fmap[t[1]], fmap[t[2]]);
    for (const t of B.tris) idx.push(bmap[t[0]], bmap[t[2]], bmap[t[1]]);
    this.index = Uint32Array.from(idx);

    /* uv from the pattern layout (square atlas around the pattern) */
    const S = Math.max(bounds.maxx - bounds.minx, bounds.maxy - bounds.miny);
    this.atlas = { S, x0: bounds.minx, y0: bounds.maxy - S };
    this.uv = new Float32Array(N * 2);
    for (let p = 0; p < N; p++) { this.uv[p * 2] = (lay[p][0] - this.atlas.x0) / S; this.uv[p * 2 + 1] = (lay[p][1] - this.atlas.y0) / S; }

    /* state */
    this.pos = new Float64Array(N * 3);
    this.prev = new Float64Array(N * 3);
    this.normals = new Float32Array(N * 3);
    this.ao = new Float32Array(N * 3).fill(1);
    this.inv = new Float32Array(N).fill(1);
    this.anchor = [];                       // pinned particle -> [id, ax, ay, az] in garment space
    const zf = o.pinZ;
    for (let p = 0; p < N; p++) {
      if (tagOf[p] === 'hang') {
        this.inv[p] = 0;
        this.anchor.push([p, lay[p][0], o.hangY(lay[p][0]), sheetOf[p] === 0 ? zf : -zf]);
      }
    }
    this.sheetOf = sheetOf;

    /* constraints */
    const ca = [], cb = [], cr = [], ck = [], ct = [];
    const add = (a, b, rest, k, type = 0) => { ca.push(a); cb.push(b); cr.push(rest); ck.push(k); ct.push(type); };
    const seen = new Set();
    const d2 = (a, b) => Math.hypot(lay[a][0] - lay[b][0], lay[a][1] - lay[b][1]);
    const edge = (a, b) => {
      if (a === b) return;
      const key = a < b ? a * N + b : b * N + a;
      if (seen.has(key)) return; seen.add(key);
      let rest = d2(a, b);
      if (tagOf[a] === 'gather' && tagOf[b] === 'gather') rest *= shrink.gather;
      else if (tagOf[a] === 'neck' && tagOf[b] === 'neck') rest *= shrink.neck;
      else if (tagOf[a] === 'hemg' && tagOf[b] === 'hemg') rest *= shrink.hemg;
      if (rest < 1e-5) return;
      add(a, b, rest, 1.0);
    };
    for (let k = 0; k < idx.length; k += 3) { edge(idx[k], idx[k + 1]); edge(idx[k + 1], idx[k + 2]); edge(idx[k + 2], idx[k]); }
    /* bend: skip-one links along both grid axes, per sheet */
    const bend = (M, map, nx, ids) => {
      const g = (i, j) => (i < 0 || j < 0 || i >= nx || j >= M.ny ? -1 : ids[j * nx + i]);
      for (let j = 0; j < M.ny; j++) for (let i = 0; i < nx; i++) {
        const a = g(i, j); if (a < 0) continue;
        for (const [di, dj] of [[2, 0], [0, 2]]) {
          const m = g(i + di / 2, j + dj / 2), b = g(i + di, j + dj);
          if (m < 0 || b < 0) continue;
          const pa = map[a], pb = map[b];
          if (pa === pb) continue;
          const rest = d2(pa, pb);
          if (rest < 1e-4) continue;
          const key = (pa < pb ? pa * N + pb : pb * N + pa) + N * N;
          if (seen.has(key)) continue; seen.add(key);
          add(pa, pb, rest, o.bend ?? 0.12);
        }
      }
    };
    bend(F, fmap, F.nx, F.id); bend(B, bmap, B.nx, B.id);
    /* thickness: front and back may not collapse; gathered edges are pulled together */
    const bpart = new Map();
    B.verts.forEach((v, k) => bpart.set(v.j * B.nx + v.i, bmap[k]));
    F.verts.forEach((v, k) => {
      const q = bpart.get(v.j * F.nx + v.i);
      const p = fmap[k];
      if (q === undefined || q === p) return;
      if (tagOf[p] === 'hang') return;
      add(p, q, o.thick(v.x, v.y), 0.6, 1);
      if (v.tag === 'gather') add(p, q, o.cuffMax ?? 0.07, 0.5, 2);
    });
    const order = ca.map((_, i) => i).sort((a, b) => (ct[a] === 0 ? 0 : 1) - (ct[b] === 0 ? 0 : 1));
    this.ca = Int32Array.from(order.map((i) => ca[i] * 3)); this.cb = Int32Array.from(order.map((i) => cb[i] * 3));
    this.cr = Float64Array.from(order.map((i) => cr[i])); this.ck = Float64Array.from(order.map((i) => ck[i]));
    this.ct = Uint8Array.from(order.map((i) => ct[i]));
    this.nC = ca.length;
    this.nEq = order.filter((i) => ct[i] === 0).length;
    this.cwa = Float64Array.from(order.map((i) => (this.inv[ca[i]] === 0 ? 0 : 1)));
    this.cwb = Float64Array.from(order.map((i) => (this.inv[cb[i]] === 0 ? 0 : 1)));

    /* long-range attachment: nothing may stretch further than its pattern distance from a pin */
    const pins = this.anchor.map((a) => a[0]);
    this.lra = new Int32Array(N).fill(-1); this.lraMax = new Float32Array(N);
    for (let p = 0; p < N; p++) {
      if (this.inv[p] === 0) continue;
      let best = 1e9, bi = -1;
      for (const q of pins) { const d = d2(p, q); if (d < best) { best = d; bi = q; } }
      if (bi >= 0) { this.lra[p] = bi; this.lraMax[p] = best * 1.03 + 0.01; }
    }

    /* neighbour lists (CSR) for ambient-occlusion from curvature */
    const nb = Array.from({ length: N }, () => []);
    for (let c = 0; c < this.nC; c++) if (this.ct[c] === 0) { const a = this.ca[c] / 3, b = this.cb[c] / 3; nb[a].push(b); nb[b].push(a); }
    this.nbStart = new Int32Array(N + 1); const flat = [];
    for (let p = 0; p < N; p++) { this.nbStart[p] = flat.length; flat.push(...nb[p]); }
    this.nbStart[N] = flat.length; this.nb = Int32Array.from(flat);

    this.buildRender();
    this.iterations = o.iterations ?? 6;
    this.damp = o.damp ?? 0.992;
    this.time = 0;
  }

  /** the visible mesh is the simulation mesh subdivided once; new vertices sit on a curved (PN-style) edge */
  buildRender() {
    const { index, N } = this;
    const map = new Map(), ea = [], eb = [], idx = [];
    const mid = (a, b) => {
      const lo = a < b ? a : b, hi = a < b ? b : a, k = lo * N + hi;
      let m = map.get(k);
      if (m === undefined) { m = N + ea.length; map.set(k, m); ea.push(lo); eb.push(hi); }
      return m;
    };
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    const E = ea.length, RN = N + E;
    this.E = E; this.ea = Int32Array.from(ea); this.eb = Int32Array.from(eb);
    this.rindex = Uint32Array.from(idx);
    this.rpos = new Float32Array(RN * 3); this.rnorm = new Float32Array(RN * 3);
    this.rcol = new Float32Array(RN * 3).fill(1); this.ruv = new Float32Array(RN * 2);
    this.ruv.set(this.uv);
    for (let e = 0; e < E; e++) {
      this.ruv[(N + e) * 2] = (this.uv[ea[e] * 2] + this.uv[eb[e] * 2]) / 2;
      this.ruv[(N + e) * 2 + 1] = (this.uv[ea[e] * 2 + 1] + this.uv[eb[e] * 2 + 1]) / 2;
    }
  }

  fillRender() {
    const { pos, normals, ao, N, E, ea, eb, rpos, rnorm, rcol } = this;
    for (let i = 0; i < N * 3; i++) { rpos[i] = pos[i]; rnorm[i] = normals[i]; rcol[i] = ao[i]; }
    for (let e = 0; e < E; e++) {
      const a = ea[e] * 3, b = eb[e] * 3, o = (N + e) * 3;
      const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
      const da = (dx * normals[a] + dy * normals[a + 1] + dz * normals[a + 2]) / 3;
      const db = (dx * normals[b] + dy * normals[b + 1] + dz * normals[b + 2]) / 3;
      for (let k = 0; k < 3; k++) {
        const d = k === 0 ? dx : k === 1 ? dy : dz;
        const p1 = pos[a + k] + d / 3 - da * normals[a + k];
        const p2 = pos[b + k] - d / 3 + db * normals[b + k];
        rpos[o + k] = (pos[a + k] + 3 * p1 + 3 * p2 + pos[b + k]) / 8;
        rnorm[o + k] = normals[a + k] + normals[b + k];
        rcol[o + k] = (ao[a + k] + ao[b + k]) / 2;
      }
      const l = Math.hypot(rnorm[o], rnorm[o + 1], rnorm[o + 2]) || 1;
      rnorm[o] /= l; rnorm[o + 1] /= l; rnorm[o + 2] /= l;
    }
  }

  /** place particles from the pattern, in the frame given by the 4x4 matrix `m` (column-major, three.js order) */
  reset(m) {
    const { lay, pos, prev, N, o } = this;
    for (let p = 0; p < N; p++) {
      const z = this.sheetOf[p] === 0 ? o.pinZ + 0.012 : -o.pinZ - 0.012;
      const x = lay[p][0], y = lay[p][1];
      pos[p * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
      pos[p * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      pos[p * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    prev.set(pos);
  }

  /** one fixed step. m = garment frame in world space; wind = [x,y,z] */
  step(dt, m, wind, g = 19.6) {
    const { pos, prev, inv, N, normals } = this;
    this.time += dt;
    const t = this.time;
    /* pins follow the hanger */
    for (const [p, ax, ay, az] of this.anchor) {
      const k = p * 3;
      const x = m[0] * ax + m[4] * ay + m[8] * az + m[12];
      const y = m[1] * ax + m[5] * ay + m[9] * az + m[13];
      const z = m[2] * ax + m[6] * ay + m[10] * az + m[14];
      prev[k] = pos[k] = x; prev[k + 1] = pos[k + 1] = y; prev[k + 2] = pos[k + 2] = z;
    }
    const dt2 = dt * dt, damp = this.damp;
    for (let p = 0; p < N; p++) {
      if (inv[p] === 0) continue;
      const k = p * 3;
      const x = pos[k], y = pos[k + 1], z = pos[k + 2];
      let ax = 0, ay = -g, az = 0;
      /* aerodynamic force: wind acts along the surface normal, with turbulence that varies over the cloth */
      const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
      const wx = wind[0] + 0.35 * Math.sin(x * 3.1 + t * 1.7 + y * 1.3);
      const wz = wind[2] + 0.35 * Math.sin(y * 2.7 + t * 1.3 - x * 1.1);
      const wy = wind[1] + 0.12 * Math.sin(x * 2.3 + t * 2.1);
      const f = (nx * wx + ny * wy + nz * wz) * 2.2;
      ax += nx * f; ay += ny * f; az += nz * f;
      const vx = (x - prev[k]) * damp, vy = (y - prev[k + 1]) * damp, vz = (z - prev[k + 2]) * damp;
      prev[k] = x; prev[k + 1] = y; prev[k + 2] = z;
      pos[k] = x + vx + ax * dt2; pos[k + 1] = y + vy + ay * dt2; pos[k + 2] = z + vz + az * dt2;
    }
    this.solve();
  }

  solve() {
    const { pos, ca, cb, cr, ck, ct, cwa, cwb, nC, nEq, lra, lraMax, N } = this;
    for (let it = 0; it < this.iterations; it++) {
      for (let c = 0; c < nEq; c++) {
        const a = ca[c], b = cb[c];
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
        const wa = cwa[c], wb = cwb[c];
        const s = (wa + wb) === 0 ? 0 : ((d - cr[c]) / d) * ck[c] / (wa + wb);
        const sa = s * wa, sb = s * wb;
        pos[a] += dx * sa; pos[a + 1] += dy * sa; pos[a + 2] += dz * sa;
        pos[b] -= dx * sb; pos[b + 1] -= dy * sb; pos[b + 2] -= dz * sb;
      }
      for (let c = nEq; c < nC; c++) {
        const a = ca[c], b = cb[c];
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
        const rest = cr[c];
        if (ct[c] === 1 ? d >= rest : d <= rest) continue;
        const wa = cwa[c], wb = cwb[c];
        const s = (wa + wb) === 0 ? 0 : ((d - rest) / d) * ck[c] / (wa + wb);
        const sa = s * wa, sb = s * wb;
        pos[a] += dx * sa; pos[a + 1] += dy * sa; pos[a + 2] += dz * sa;
        pos[b] -= dx * sb; pos[b + 1] -= dy * sb; pos[b + 2] -= dz * sb;
      }
      for (let p = 0; p < N; p++) {
        const q = lra[p]; if (q < 0) continue;
        const a = p * 3, b = q * 3;
        const dx = pos[a] - pos[b], dy = pos[a + 1] - pos[b + 1], dz = pos[a + 2] - pos[b + 2];
        const d2 = dx * dx + dy * dy + dz * dz, mx = lraMax[p];
        if (d2 > mx * mx) { const s = mx / Math.sqrt(d2); pos[a] = pos[b] + dx * s; pos[a + 1] = pos[b + 1] + dy * s; pos[a + 2] = pos[b + 2] + dz * s; }
      }
    }
  }

  /** a moving object brushes the cloth: add velocity to everything within `radius` of point c */
  brush(cx, cy, cz, vx, vy, vz, radius, strength = 1) {
    const { pos, prev, inv, N } = this;
    const r2 = radius * radius;
    for (let p = 0; p < N; p++) {
      if (inv[p] === 0) continue;
      const k = p * 3;
      const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = (pos[k + 2] - cz) * 0.6;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const f = (1 - d2 / r2) * strength;
      prev[k] -= vx * f; prev[k + 1] -= vy * f; prev[k + 2] -= vz * f;
    }
  }

  /** normals + curvature occlusion, once per rendered frame */
  refresh() {
    const { pos, normals, index, N, nb, nbStart, ao } = this;
    normals.fill(0);
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
    }
    for (let p = 0; p < N; p++) {
      const k = p * 3;
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]) || 1;
      normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l;
      /* occlusion: neighbours sitting in front of the vertex's outward normal means a fold */
      const s = nbStart[p], e = nbStart[p + 1];
      if (e > s) {
        let mx = 0, my = 0, mz = 0;
        for (let q = s; q < e; q++) { const j = nb[q] * 3; mx += pos[j]; my += pos[j + 1]; mz += pos[j + 2]; }
        const n = e - s;
        const dot = ((mx / n - pos[k]) * normals[k] + (my / n - pos[k + 1]) * normals[k + 1] + (mz / n - pos[k + 2]) * normals[k + 2]);
        const a = 1 - Math.max(0, Math.min(0.55, dot * 14));        // concave = neighbours on the normal's side
        const cur = ao[k];
        ao[k] = ao[k + 1] = ao[k + 2] = cur + (a - cur) * 0.5;
      }
    }
    this.fillRender();
  }
}
