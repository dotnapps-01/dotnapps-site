import { inr } from '../products.js';
import { $, $$, reduced, clamp, pad, scope, onReady, looks } from './util.js';

/* Cylinder: the looks stand on a slowly turning ring. Drag to spin it; it settles on whichever look faces you. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length, STEP = 360 / N;
  hero.className = 'cy';
  hero.innerHTML = `<div class="cy__top"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure, <em>every day.</em></h1></div>
    <div class="cy__stage" id="cy-stage"><div class="cy__ring" id="cy-ring">${set.map((p, k) => `<button class="cy__card" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false" decoding="async"></button>`).join('')}</div></div>
    <div class="cy__foot"><p class="cy__now"><b id="cy-n">01</b> / ${pad(N)} <span id="cy-name"></span> <i id="cy-price"></i></p><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a><p class="cy__hint">Drag to spin</p></div>`;
  const stage = $('#cy-stage', hero), ring = $('#cy-ring', hero), cards = $$('.cy__card', hero);
  let ang = 0, vel = reduced ? 0 : 9, drag = false, lastX = 0, moved = 0, front = -1, settleTo = null;
  const layout = () => {
    const w = stage.clientWidth, h = stage.clientHeight, cw = Math.min(w * (w < 700 ? 0.56 : 0.3), h * 0.9 * 0.75), ch = cw / 0.75, R = (cw / 2) / Math.tan(Math.PI / N) * 1.12;
    cards.forEach((c, k) => { c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.style.marginLeft = -cw / 2 + 'px'; c.style.marginTop = -ch / 2 + 'px'; c.style.transform = `rotateY(${k * STEP}deg) translateZ(${R}px)`; });
    ring.style.setProperty('--R', R + 'px');
  };
  layout(); S.on(window, 'resize', layout);
  S.on(stage, 'pointerdown', (e) => { drag = true; moved = 0; lastX = e.clientX; settleTo = null; stage.setPointerCapture?.(e.pointerId); stage.classList.add('is-drag'); });
  S.on(stage, 'pointermove', (e) => { if (!drag) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); ang += dx * 0.34; vel = dx * 0.34 * 60; });
  const end = () => { drag = false; stage.classList.remove('is-drag'); };
  S.on(stage, 'pointerup', end); S.on(stage, 'pointercancel', end);
  S.on(stage, 'click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  S.loop((dt) => {
    if (!drag) {
      if (Math.abs(vel) > 14) { ang += vel * dt; vel *= Math.pow(0.18, dt); } else if (!reduced) { vel += (9 - vel) * Math.min(1, dt * 0.8); ang += vel * dt; }
    }
    ring.style.transform = `translateZ(calc(var(--R) * -1)) rotateX(-7deg) rotateY(${ang.toFixed(2)}deg)`;
    let best = 0, bd = 9e9;
    cards.forEach((c, k) => {
      let a = ((k * STEP + ang) % 360 + 540) % 360 - 180;   // 0 = facing the viewer
      const f = Math.abs(a) / 180; if (f < bd) { bd = f; best = k; }
      c.style.opacity = (0.32 + 0.68 * clamp(1 - f * 1.5)).toFixed(3);
      c.style.pointerEvents = Math.abs(a) < 38 ? 'auto' : 'none';
    });
    if (best !== front) { front = best; const p = set[best]; $('#cy-n', hero).textContent = pad(best + 1); $('#cy-name', hero).textContent = p.name; $('#cy-price', hero).textContent = inr(p.price); }
  });
  onReady(() => hero.classList.add('is-in'));
  return () => S.clear();
}
