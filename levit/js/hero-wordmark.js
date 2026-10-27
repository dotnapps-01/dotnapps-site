/* LEVIT hero: the wordmark, knitted.
 *
 * The letters are a waffle-knit surface lit by a point light that follows the cursor. One fragment shader draws
 * the weave, rounds the letters into soft cushions (from a blurred copy of the glyphs), adds a drop shadow, and
 * lets a press pinch the fabric under the pointer. On portrait screens the letters stack in a column.
 * Plain WebGL, no libraries.
 */

const VERT = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 uv;
uniform sampler2D uMask, uPuff;
uniform vec2 uRes, uMouse;
uniform float uTime, uPress, uCell, uPuffH, uIntro;
uniform vec3 uColor;

float waffle(vec2 p) {
  vec2 f = fract(p);
  vec2 e = min(f, 1.0 - f);
  return smoothstep(0.03, 0.44, min(e.x, e.y));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 px = 1.0 / uRes;
  vec2 frag = uv * uRes;

  float reveal = 1.0 - smoothstep(uIntro - 0.14, uIntro, uv.x);
  float m = texture2D(uMask, uv).a * reveal;
  float sh = texture2D(uPuff, uv + vec2(0.0, 24.0) * px).a * reveal;
  float shA = sh * 0.34 * (1.0 - m);
  if (m < 0.004) { gl_FragColor = vec4(vec3(0.06, 0.03, 0.02) * shA, shA); return; }

  /* the letters are cushions: slope comes from a blurred copy of the glyphs */
  float gx = texture2D(uPuff, uv + vec2(2.0 * px.x, 0.0)).a - texture2D(uPuff, uv - vec2(2.0 * px.x, 0.0)).a;
  float gy = texture2D(uPuff, uv + vec2(0.0, 2.0 * px.y)).a - texture2D(uPuff, uv - vec2(0.0, 2.0 * px.y)).a;
  vec2 gp = vec2(gx, gy) * 0.25 * uPuffH;
  float puff = texture2D(uPuff, uv).a;

  /* waffle weave, with its slope */
  vec2 p = frag / uCell;
  float e = 0.35;
  float h0 = waffle(p);
  vec2 gf = vec2(waffle(p + vec2(e, 0.0)) - h0, waffle(p + vec2(0.0, e)) - h0) / e * 0.42;

  /* press: the fabric dents around the pointer */
  vec2 d = frag - uMouse;
  float r = uRes.y * 0.2;
  float g = exp(-dot(d, d) / (r * r));
  vec2 gd = (d / r) * g * uPress * 1.1;

  vec3 N = normalize(vec3(-(gp + gf + gd), 1.0));
  vec3 L = normalize(vec3(uMouse - frag, uRes.y * 0.42));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 26.0);
  float rim = pow(1.0 - max(N.z, 0.0), 2.0);

  vec2 cid = floor(p);
  float yarn = 0.9 + 0.2 * hash(cid) + 0.04 * sin(p.y * 6.2831);
  vec3 base = uColor * yarn * (0.6 + 0.4 * h0);
  base *= 0.62 + 0.38 * smoothstep(0.05, 0.7, puff);                 // soft shade near the edges
  base *= 1.0 - 0.28 * g * uPress;                                    // pinched area is shaded

  vec3 col = base * (0.26 + 1.0 * diff) + vec3(1.0, 0.88, 0.72) * spec * 0.2 * (0.4 + 0.6 * h0) + uColor * rim * 0.16;
  col = col / (1.0 + col * 0.16);
  vec3 rgb = col * m + vec3(0.06, 0.03, 0.02) * shA * (1.0 - m);
  gl_FragColor = vec4(rgb, m + shA * (1.0 - m));
}`;

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export function initWordmark({ canvas, hero, reduced = false }) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uMask', 'uPuff', 'uRes', 'uMouse', 'uTime', 'uPress', 'uCell', 'uPuffH', 'uIntro', 'uColor'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const makeTex = (unit) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  makeTex(0); makeTex(1);
  gl.uniform1i(U.uMask, 0); gl.uniform1i(U.uPuff, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const LETTERS = ['L', 'E', 'V', 'I', 'T'];
  const state = { color: hex('#b8561f'), W: 1, H: 1, cell: 10, puffH: 12, cx: 0, cy: 0, tx: 0, ty: 0, hasPtr: false, press: 0, pressT: 0, intro: reduced ? 1.2 : 0, started: reduced, running: true, dirty: true };

  /* draw the glyph mask and a blurred copy at the current canvas size */
  function layout() {
    const W = state.W, H = state.H, portrait = W / H < 0.8;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const a = mk(), b = mk();
    const ca = a.getContext('2d'), cb = b.getContext('2d');
    const face = (px) => `900 ${px}px "Playfair Display", "Bodoni 72", Didot, serif`;
    const probe = mk().getContext('2d'); probe.font = face(100);
    const widths = LETTERS.map((l) => probe.measureText(l).width);
    const track = -0.03;
    let fs, pos;
    if (!portrait) {
      const total = widths.reduce((s, w) => s + w, 0) + 100 * track * 4;
      fs = (W * 0.9 / total) * 100;
      fs = Math.min(fs, H * 0.62 / 0.708);
      const tw = (total / 100) * fs;
      let x = (W - tw) / 2; const base = H / 2 + 0.354 * fs;
      pos = LETTERS.map((l, i) => { const p = [l, x, base]; x += (widths[i] / 100) * fs + track * fs; return p; });
    } else {
      const rowH = (H * 0.86) / 5;
      fs = Math.min(rowH / 0.78, (W * 0.8) / (Math.max(...widths) / 100));
      pos = LETTERS.map((l, i) => [l, (W - (widths[i] / 100) * fs) / 2, H * 0.07 + rowH * (i + 0.5) + 0.354 * fs]);
    }
    ca.font = face(fs); ca.fillStyle = '#fff'; ca.textBaseline = 'alphabetic';
    for (const [l, x, y] of pos) ca.fillText(l, x, y);
    const blur = Math.max(6, fs * 0.034), OFF = 6000;
    cb.font = face(fs); cb.textBaseline = 'alphabetic';
    cb.shadowColor = '#fff'; cb.shadowBlur = blur; cb.shadowOffsetX = -OFF;
    for (const [l, x, y] of pos) { cb.fillStyle = '#fff'; cb.fillText(l, x + OFF, y); }
    gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
    gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b);
    state.cell = fs * 0.02; state.puffH = blur * 1.15;
    state.dirty = true;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    state.W = Math.max(2, Math.round(r.width * dpr)); state.H = Math.max(2, Math.round(r.height * dpr));
    canvas.width = state.W; canvas.height = state.H;
    gl.viewport(0, 0, state.W, state.H);
    layout();
  }

  const toDevice = (e) => { const r = canvas.getBoundingClientRect(), k = state.W / r.width; return [(e.clientX - r.left) * k, state.H - (e.clientY - r.top) * k]; };
  hero.addEventListener('pointermove', (e) => { const [x, y] = toDevice(e); state.tx = x; state.ty = y; state.hasPtr = true; });
  hero.addEventListener('pointerleave', () => { state.hasPtr = false; state.pressT = 0; });
  hero.addEventListener('pointerdown', (e) => { const [x, y] = toDevice(e); state.tx = x; state.ty = y; state.hasPtr = true; state.pressT = 1; });
  addEventListener('pointerup', () => { state.pressT = 0; });

  new IntersectionObserver(([en]) => { state.running = en.isIntersecting && !document.hidden; if (state.running) requestAnimationFrame(frame); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { state.running = !document.hidden; if (state.running) requestAnimationFrame(frame); });

  let t0 = performance.now(), last = t0;
  function frame(now) {
    if (!state.running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    /* with no pointer the light drifts across the letters */
    const idleX = state.W * (0.5 + 0.34 * Math.sin(t * 0.33)), idleY = state.H * (0.58 + 0.16 * Math.sin(t * 0.47 + 1));
    const goalX = state.hasPtr ? state.tx : idleX, goalY = state.hasPtr ? state.ty : idleY;
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
    state.cx += (goalX - state.cx) * k; state.cy += (goalY - state.cy) * k;
    state.press += (state.pressT - state.press) * (1 - Math.pow(0.0004, dt));
    if (state.started && state.intro < 1.2) state.intro = Math.min(1.2, state.intro + dt * 0.75);

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, state.W, state.H); gl.uniform2f(U.uMouse, state.cx, state.cy);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uPress, state.press); gl.uniform1f(U.uCell, state.cell);
    gl.uniform1f(U.uPuffH, state.puffH); gl.uniform1f(U.uIntro, state.intro); gl.uniform3fv(U.uColor, state.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  size();
  new ResizeObserver(size).observe(canvas);
  document.fonts?.load('900 100px "Playfair Display"').then(layout);   // redraw once Playfair has loaded
  requestAnimationFrame((n) => { t0 = last = n; frame(n); });

  return {
    setColor(h) { state.color = hex(h); },
    start() { state.started = true; },
  };
}
