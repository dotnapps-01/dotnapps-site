/* LEVIT hero: a dress on a hanger, hung from a rail.
 *
 * The dress is the real product photo (cut out), drawn together with a hanger and hook into one texture and
 * mapped on a finely divided mesh. Physics runs per frame: the whole thing swings as a damped pendulum from
 * the hook, the skirt lags behind the shoulders (bend), ripples in a breeze, and turns slightly (yaw).
 * Pointer sweeps push it, dragging grabs it, a click flicks it. Plain WebGL, no libraries.
 */

const VERT = `
attribute vec2 aPos; attribute vec2 aUv;
uniform vec2 uRes, uPivotScr, uPivot;
uniform float uScale, uTheta, uBend, uYaw, uTime, uFlut, uShoulder, uH, uCx;
varying vec2 vUv; varying float vShade;
void main() {
  vec2 p = aPos;
  float d = clamp((p.y - uShoulder) / (uH - uShoulder), 0.0, 1.0);
  /* skirt lags the shoulders: rotate about the shoulder line, more the further down */
  vec2 S = vec2(uCx, uShoulder);
  float ang = uBend * pow(d, 1.35);
  float c = cos(ang), s = sin(ang);
  vec2 v = p - S;
  p = S + vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  /* breeze ripples, strongest at the hem */
  float w = sin(aPos.y * 0.021 + uTime * 2.4 + aPos.x * 0.012) + 0.6 * sin(aPos.y * 0.047 - uTime * 3.1 + aPos.x * 0.02);
  p.x += w * uFlut * d * d * 15.0;
  p.y -= abs(w) * uFlut * d * d * 5.0;
  /* turn about the centre line */
  float k = cos(uYaw);
  p.x = uCx + (p.x - uCx) * k;
  p.y += (p.x - uCx) * sin(uYaw) * 0.07 * d;
  /* rigid swing from the hook */
  vec2 q = p - uPivot;
  float ct = cos(uTheta), st = sin(uTheta);
  q = vec2(ct * q.x - st * q.y, st * q.x + ct * q.y);
  vec2 scr = uPivotScr + q * uScale;
  gl_Position = vec4(scr.x / uRes.x * 2.0 - 1.0, 1.0 - scr.y / uRes.y * 2.0, 0.0, 1.0);
  vUv = aUv;
  vShade = 1.0 + 0.5 * w * uFlut * d * 0.16 + uYaw * 0.1 * (aPos.x - uCx) / 300.0;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv; varying float vShade;
uniform sampler2D uTex;
uniform vec3 uTint; uniform float uTintMix;
void main() {
  vec4 t = texture2D(uTex, vUv);
  if (t.a < 0.002) discard;
  vec3 c = t.rgb / t.a;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 re = uTint * (lum / 0.5);
  c = mix(c, re, uTintMix) * vShade;
  gl_FragColor = vec4(c * t.a, t.a);
}`;

class Osc {
  constructor(w, z) { this.w = w; this.z = z; this.x = 0; this.v = 0; this.a = 0; }
  step(dt, f = 0) { this.a = f - this.w * this.w * this.x - 2 * this.z * this.w * this.v; this.v += this.a * dt; this.x += this.v * dt; if (Math.abs(this.x) > 1.2) { this.x = Math.sign(this.x) * 1.2; this.v *= -0.3; } }
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

const PAD = 230;                    // room above the dress for the hook
const CX = 380;                     // centre line of the dress in the cut-out
const PIVOT = [CX, 52];             // where the hook meets the rail
const SHOULDER = PAD + 110;

export async function initHang({ canvas, hero, src, hotspot, reduced = false }) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;

  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight + PAD;

  /* hanger + hook, then the dress over it, baked into one texture */
  const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
  const g = comp.getContext('2d');
  const black = '#15120f';
  g.lineCap = 'round'; g.lineJoin = 'round';
  // shoulder arms (mostly hidden behind the dress)
  g.strokeStyle = black; g.lineWidth = 11;
  g.beginPath(); g.moveTo(CX, PAD + 70); g.quadraticCurveTo(CX - 120, PAD + 82, CX - 255, PAD + 150); g.moveTo(CX, PAD + 70); g.quadraticCurveTo(CX + 120, PAD + 82, CX + 255, PAD + 150); g.stroke();
  // neck + hook, scaled from the 3D hook path
  const hookPts = [[0, -0.2], [0, -0.13], [0.002, -0.085], [0.03, -0.052], [0.068, -0.022], [0.078, 0.025], [0.052, 0.072], [0, 0.088], [-0.05, 0.066], [-0.074, 0.02], [-0.066, -0.026]];
  const K = 400;
  const P = hookPts.map(([x, y]) => [PIVOT[0] + x * K, PIVOT[1] - y * K]);
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(CX, PAD + 80); g.lineTo(P[0][0], P[0][1] + 150); g.lineTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; g.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2;                  // highlight along the hook
  g.beginPath(); g.moveTo(P[0][0] - 2, P[0][1] + 140); g.lineTo(P[0][0] - 2, P[0][1] + 6); g.stroke();
  g.drawImage(img, 0, PAD);

  const compile = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  /* mesh */
  const NX = 20, NY = 70, pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { pos.push((i / NX) * W, (j / NY) * H); uv.push(i / NX, j / NY); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const attr = (name, data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); };
  attr('aPos', pos); attr('aUv', uv);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  /* power-of-two copy so the texture can be mip-mapped (the dress is drawn smaller than its source) */
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 2048;
  const tg = tc.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(comp, 0, 0, 1024, 2048);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const U = {}; ['uRes', 'uPivotScr', 'uPivot', 'uScale', 'uTheta', 'uBend', 'uYaw', 'uTime', 'uFlut', 'uShoulder', 'uH', 'uCx', 'uTint', 'uTintMix'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  /* coarse alpha mask for hit tests */
  const MS = 8, mw = Math.ceil(W / MS), mh = Math.ceil(H / MS);
  const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
  const mg = mc.getContext('2d'); mg.drawImage(comp, 0, 0, mw, mh);
  const mask = mg.getImageData(0, 0, mw, mh).data;
  const solid = (x, y) => { const i = Math.floor(x / MS), j = Math.floor(y / MS); return i >= 0 && j >= 0 && i < mw && j < mh && mask[(j * mw + i) * 4 + 3] > 40; };

  /* ---- layout ---- */
  const L = { dpr: 1, w: 1, h: 1, scale: 1, px: 0, py: 0, portrait: false };
  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    L.dpr = dpr; L.w = Math.round(r.width * dpr); L.h = Math.round(r.height * dpr);
    canvas.width = L.w; canvas.height = L.h; gl.viewport(0, 0, L.w, L.h);
    L.portrait = r.width / r.height < 0.85;
    const rail = (L.portrait ? 40 : 64) * dpr;
    if (L.portrait) {
      L.scale = Math.min((L.h * 0.68) / (H - PIVOT[1]), (L.w * 0.78) / W);
      L.px = L.w * 0.5;
    } else {
      L.scale = Math.min((L.h - rail - 34 * dpr) / (H - PIVOT[1]), (L.w * 0.34) / W);
      L.px = L.w * 0.66;
    }
    L.py = rail;
    hero.style.setProperty('--sc', (L.scale / dpr).toFixed(4)); hero.style.setProperty('--px', (L.px / dpr).toFixed(1) + 'px'); hero.style.setProperty('--py', (L.py / dpr).toFixed(1) + 'px');
  }
  size();
  new ResizeObserver(size).observe(canvas);

  /* ---- physics ---- */
  const phi = new Osc(2.9, 0.045), bend = new Osc(4.6, 0.09), yaw = new Osc(2.0, 0.08);
  if (!reduced) { phi.x = 0.34; yaw.x = 0.4; }
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, has: false, over: false };
  let drag = false, running = true, tint = [0, 0, 0], tintMix = 0, time = 0, last = performance.now(), flutter = 0.3, acc = 0;
  let theta = 0, bendA = 0, yawA = 0;

  const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * L.dpr, (e.clientY - r.top) * L.dpr]; };
  /* screen → composite coordinates, undoing the rigid swing only (good enough for hit tests) */
  function toComp(sx, sy) {
    const qx = (sx - L.px) / L.scale, qy = (sy - L.py) / L.scale;
    const c = Math.cos(-theta), s = Math.sin(-theta);
    return [PIVOT[0] + c * qx - s * qy, PIVOT[1] + s * qx + c * qy];
  }
  function hit(e) { const [sx, sy] = toLocal(e); const [cx, cy] = toComp(sx, sy); return solid(cx, cy); }

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toLocal(e), now = performance.now();
    if (ptr.has) { const dt = Math.max(0.008, (now - ptr.t) / 1000); ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5; ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5; }
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.has = true;
    ptr.over = hit(e);
    canvas.style.cursor = drag ? 'grabbing' : ptr.over ? 'grab' : '';
    hero.classList.toggle('is-over', ptr.over);
  });
  canvas.addEventListener('pointerleave', () => { ptr.has = false; ptr.over = false; ptr.vx = ptr.vy = 0; hero.classList.remove('is-over'); });
  canvas.addEventListener('pointerdown', (e) => {
    if (hit(e)) { drag = true; canvas.setPointerCapture(e.pointerId); const [x, y] = toLocal(e); ptr.x = x; ptr.y = y; ptr.has = true; canvas.style.cursor = 'grabbing'; }
  });
  const release = () => { if (drag) { drag = false; canvas.style.cursor = ptr.over ? 'grab' : ''; } };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  let scrollVel = 0, lastY = scrollY;
  addEventListener('scroll', () => { scrollVel = clamp(scrollVel + (scrollY - lastY) * 0.0012, -0.8, 0.8); lastY = scrollY; }, { passive: true });
  new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });

  const breeze = (t) => Math.sin(t * 0.9) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.3 + Math.sin(t * 0.37 + 2) * 0.4;
  const STEP = 1 / 120;
  const Lpx = () => (H - PIVOT[1]) * 0.55 * L.scale;                   // distance used to turn a pointer offset into an angle

  function stepOnce() {
    time += STEP;
    const br = reduced ? 0 : 1;
    let fz = breeze(time) * 0.16 * br, fy = breeze(time * 0.6 + 9) * 0.1 * br;
    if (ptr.over && !drag && ptr.has) {
      phi.v += (ptr.vx / L.dpr) * 0.0011 * STEP * 60 * 0.6; yaw.v += (ptr.vx / L.dpr) * 0.0006 * STEP * 60 * 0.5;
      ptr.vx *= 0.985; ptr.vy *= 0.985;
    }
    if (drag) {
      const target = clamp(Math.asin(clamp((ptr.x - L.px) / Lpx(), -0.95, 0.95)), -0.9, 0.9);
      fz += 90 * (target - phi.x) - 13 * phi.v; fy += -5 * yaw.v + 30 * (target * 0.6 - yaw.x);
    }
    fz += scrollVel * 6; scrollVel *= 0.99;
    phi.step(STEP, fz); yaw.step(STEP, fy);
    bend.step(STEP, -phi.a * 0.55 - yaw.v * 0.05);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    while (acc >= STEP) { stepOnce(); acc -= STEP; }
    theta = -phi.x; bendA = clamp(-(bend.x - phi.x * 0) * 1.0, -0.6, 0.6); yawA = yaw.x;
    flutter = 0.35 + Math.min(1.6, Math.hypot(phi.v, bend.v) * 0.9);
    draw();
  }

  function draw() {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, L.w, L.h); gl.uniform2f(U.uPivotScr, L.px, L.py); gl.uniform2f(U.uPivot, PIVOT[0], PIVOT[1]);
    gl.uniform1f(U.uScale, L.scale); gl.uniform1f(U.uTheta, theta); gl.uniform1f(U.uBend, bendA); gl.uniform1f(U.uYaw, yawA);
    gl.uniform1f(U.uTime, time); gl.uniform1f(U.uFlut, reduced ? 0 : flutter);
    gl.uniform1f(U.uShoulder, SHOULDER); gl.uniform1f(U.uH, H); gl.uniform1f(U.uCx, CX);
    gl.uniform3fv(U.uTint, tint); gl.uniform1f(U.uTintMix, tintMix);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    placeHotspot();
  }

  /* the same transform on the CPU, to pin a hotspot to the waist buttons */
  function project(cx, cy) {
    let x = cx, y = cy;
    const d = clamp((y - SHOULDER) / (H - SHOULDER), 0, 1);
    const ang = bendA * Math.pow(d, 1.35), c = Math.cos(ang), s = Math.sin(ang);
    const vx = x - CX, vy = y - SHOULDER;
    x = CX + c * vx - s * vy; y = SHOULDER + s * vx + c * vy;
    const k = Math.cos(yawA); x = CX + (x - CX) * k;
    const qx0 = x - PIVOT[0], qy0 = y - PIVOT[1], ct = Math.cos(theta), st = Math.sin(theta);
    const qx = ct * qx0 - st * qy0, qy = st * qx0 + ct * qy0;
    return [(L.px + qx * L.scale) / L.dpr, (L.py + qy * L.scale) / L.dpr];
  }
  function placeHotspot() {
    if (!hotspot) return;
    const [x, y] = project(CX + 60, PAD + 430);
    hotspot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  requestAnimationFrame((n) => { last = n; frame(n); });

  return {
    setTint(h, mix = 1) { tint = h ? hex(h) : [0, 0, 0]; tintMix = h ? mix : 0; },
    nudge(a = 1) { phi.v += 1.5 * a; yaw.v += 0.8 * a; },
  };
}
