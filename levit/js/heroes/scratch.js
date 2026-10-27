import { inr } from '../products.js';
import { $, $$, reduced, clamp, pad, scope, onReady, looks } from './util.js';

/* Scratch to reveal: a sand-coloured card printed with LEVIT. Rub it with a finger to scratch the look free. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'sc';
  hero.innerHTML = `<div class="sc__top"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure, <em>every day.</em></h1></div>
    <div class="sc__card" id="sc-card"><div class="sc__look"><img id="sc-img" alt="" draggable="false" decoding="async"></div><canvas id="sc-cv" aria-label="Scratch card. Rub to reveal the look."></canvas><span class="sc__finger" id="sc-finger" aria-hidden="true"></span></div>
    <div class="sc__foot"><p class="sc__prompt" id="sc-prompt">Scratch to reveal today's look</p><div class="sc__reveal" id="sc-reveal"><div><b id="sc-name"></b><span id="sc-price"></span></div><button class="sc__shop" id="sc-shop" type="button">Shop</button><button class="sc__next" id="sc-next" type="button">Next look</button></div><p class="sc__count"><span id="sc-n">01</span> / ${pad(N)}</p></div>`;
  const card = $('#sc-card', hero), cv = $('#sc-cv', hero), ctx = cv.getContext('2d', { willReadFrequently: true }), img = $('#sc-img', hero);
  let i = 0, done = false, down = false, lx = 0, ly = 0, n = 0, W = 0, H = 0;
  const paint = () => {
    W = cv.width = Math.round(card.clientWidth); H = cv.height = Math.round(card.clientHeight);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#E6D3BB'); g.addColorStop(.5, '#D8C2AA'); g.addColorStop(1, '#C9AF92'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .1; for (let k = 0; k < 500; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#6b4a2b'; ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); } ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(80,55,30,.18)'; ctx.lineWidth = 1; for (let k = 0; k < H; k += 14) { ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(W, k + 4); ctx.stroke(); }
    ctx.fillStyle = '#0B0907'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${Math.round(W * 0.27)}px "Playfair Display", serif`; ctx.fillText('LEVIT', W / 2, H * 0.44);
    ctx.font = `500 ${Math.round(W * 0.036)}px Jost, sans-serif`; ctx.fillStyle = 'rgba(11,9,7,.7)'; ctx.fillText('A W 2 6   ·   W O M E N S W E A R', W / 2, H * 0.6);
    ctx.fillStyle = '#A8531E'; ctx.fillText('S C R A T C H   H E R E', W / 2, H * 0.9);
  };
  const load = (k) => { i = k % N; img.src = set[i].photo; img.alt = set[i].name; $('#sc-name', hero).textContent = set[i].name; $('#sc-price', hero).textContent = inr(set[i].price); $('#sc-shop', hero).dataset.quick = set[i].id; $('#sc-n', hero).textContent = pad(i + 1); };
  const cover = () => { done = false; card.classList.remove('done'); hero.classList.remove('is-done'); $('#sc-prompt', hero).hidden = false; paint(); cv.style.opacity = 1; };
  const cleared = () => { const d = ctx.getImageData(0, 0, W, H).data; let c = 0, t = 0; for (let y = 0; y < H; y += 14) for (let x = 0; x < W; x += 14) { t++; if (d[(y * W + x) * 4 + 3] < 40) c++; } return c / t; };
  const reveal = () => { if (done) return; done = true; card.classList.add('done'); hero.classList.add('is-done'); $('#sc-prompt', hero).hidden = true; };
  const scratch = (x, y) => { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(34, W * 0.12); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); lx = x; ly = y; if (++n % 8 === 0 && cleared() > 0.42) reveal(); };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  S.on(cv, 'pointerdown', (e) => { down = true; [lx, ly] = pos(e); scratch(lx + 0.1, ly); cv.setPointerCapture?.(e.pointerId); $('#sc-finger', hero).classList.add('gone'); });
  S.on(cv, 'pointermove', (e) => { if (down) { const [x, y] = pos(e); scratch(x, y); } });
  const up = () => { down = false; if (!done && cleared() > 0.42) reveal(); };
  S.on(cv, 'pointerup', up); S.on(cv, 'pointercancel', up);
  S.on($('#sc-next', hero), 'click', () => { cv.style.transition = 'none'; load(i + 1); cover(); void cv.offsetWidth; cv.style.transition = ''; });
  S.on(window, 'resize', () => { if (!done) paint(); });
  load(0);
  const go = async () => { try { await document.fonts.load('900 40px "Playfair Display"'); } catch { /* use fallback */ } cover();
    // a ghost scratch teaches the gesture
    if (reduced) return;
    S.timeout(() => { if (done || down) return; const pts = [[.18, .5], [.5, .56], [.82, .5], [.76, .66], [.34, .7]]; let k = 0; lx = pts[0][0] * W; ly = pts[0][1] * H; const f = $('#sc-finger', hero); f.classList.remove('gone');
      const step = () => { if (down || done || k >= pts.length) { f.classList.add('gone'); return; } const [px, py] = pts[k++]; f.style.left = px * 100 + '%'; f.style.top = py * 100 + '%'; const sx = lx, sy = ly, tx = px * W, ty = py * H; let t = 0; const run = () => { if (down) return; t += 0.12; scratch(sx + (tx - sx) * Math.min(1, t), sy + (ty - sy) * Math.min(1, t)); if (t < 1) requestAnimationFrame(run); else S.timeout(step, 40); }; run(); };
      f.style.left = pts[0][0] * 100 + '%'; f.style.top = pts[0][1] * 100 + '%'; S.timeout(step, 500); }, 900); };
  onReady(go);
  return () => S.clear();
}
