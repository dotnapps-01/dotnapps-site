import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, looks } from './util.js';

/* Tilt to peek: the look sits in layers that slide against each other as you tilt the phone (or move the mouse).
   Swipe sideways for the next look. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'tl';
  hero.innerHTML = `<div class="tl__bgs" aria-hidden="true">${set.map((p) => `<img src="${p.photo}" alt="">`).join('')}</div>
    <p class="tl__word" aria-hidden="true"><span>LEVIT</span></p>
    <div class="tl__scene"><div class="tl__card">${set.map((p, k) => `<img class="${k ? '' : 'is-on'}" src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}draggable="false" decoding="async">`).join('')}<span class="tl__glare"></span></div></div>
    <h1 class="tl__h">Soft structure, <em>every day.</em></h1>
    <div class="tl__bar"><div class="tl__who"><b id="tl-name"></b><span id="tl-price"></span></div><button class="tl__shop" id="tl-shop" type="button">Shop</button></div>
    <div class="tl__dots" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
    <button class="tl__perm" id="tl-perm" type="button" hidden>Tap to enable tilt</button><p class="tl__hint" id="tl-hint">Tilt your phone · swipe for the next look</p>`;
  const imgs = $$('.tl__card img', hero), bgs = $$('.tl__bgs img', hero), dots = $$('.tl__dots i', hero);
  let i = 0, tx = 0, ty = 0, x = 0, y = 0, lastIn = -9e9;
  const show = (k) => { i = (k + N) % N; imgs.forEach((m, n) => m.classList.toggle('is-on', n === i)); bgs.forEach((m, n) => m.classList.toggle('is-on', n === i)); dots.forEach((d, n) => d.classList.toggle('is-on', n === i)); $('#tl-name', hero).textContent = set[i].name; $('#tl-price', hero).textContent = inr(set[i].price); $('#tl-shop', hero).dataset.quick = set[i].id; };
  show(0);
  const orient = (e) => { if (e.gamma == null) return; lastIn = performance.now(); tx = clamp(e.gamma / 28, -1, 1); ty = clamp(((e.beta ?? 45) - 50) / 28, -1, 1); };
  const perm = $('#tl-perm', hero);
  if (!matchMedia('(hover: none)').matches) { /* no sensors on desktop: the mouse drives the tilt */ } else if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { perm.hidden = false; S.on(perm, 'click', async () => { try { if ((await DeviceOrientationEvent.requestPermission()) === 'granted') { S.on(window, 'deviceorientation', orient); perm.hidden = true; } } catch { perm.hidden = true; } }); }
  else S.on(window, 'deviceorientation', orient);
  S.on(hero, 'pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; lastIn = performance.now(); });
  let sx = null;
  S.on(hero, 'pointerdown', (e) => { if (e.target.closest('button, a')) return; sx = e.clientX; });
  S.on(hero, 'pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); });
  S.on(window, 'keydown', (e) => { if (document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  S.loop((dt, t) => {
    if (reduced) { tx = ty = 0; } else if (performance.now() - lastIn > 2500) { tx = Math.sin(t * 0.7) * 0.7; ty = Math.cos(t * 0.5) * 0.35; }
    x += (tx - x) * Math.min(1, dt * 6); y += (ty - y) * Math.min(1, dt * 6);
    hero.style.setProperty('--x', x.toFixed(3)); hero.style.setProperty('--y', y.toFixed(3));
  });
  S.timeout(() => $('#tl-hint', hero).classList.add('gone'), 5200);
  return () => S.clear();
}
