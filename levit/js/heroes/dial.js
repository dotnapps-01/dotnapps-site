import { inr } from '../products.js';
import { $, $$, reduced, scope, looks } from './util.js';

/* Thumb dial: spin the dial at the bottom of the screen with your thumb; the large look above follows. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length, STEP = 360 / N;
  hero.className = 'dl';
  hero.innerHTML = `<div class="dl__top"><h1>Soft structure, <em>every day.</em></h1></div>
    <div class="dl__photo" id="dl-photo">${set.map((p, k) => `<img class="${k ? '' : 'is-on'}" src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}draggable="false" decoding="async">`).join('')}</div>
    <div class="dl__info"><div><b id="dl-name"></b><span id="dl-price"></span></div><button class="dl__shop" id="dl-shop" type="button">Shop</button></div>
    <div class="dl__dial" id="dl-dial" role="group" aria-label="Spin to choose a look"><div class="dl__ticks" aria-hidden="true"></div><div class="dl__ring" id="dl-ring">${set.map((p, k) => `<button class="dl__t" type="button" data-k="${k}" aria-label="${p.name}"><img src="${p.photo}" alt="" draggable="false"></button>`).join('')}</div><div class="dl__hub" aria-hidden="true"><span>LEVIT</span></div><span class="dl__mark" aria-hidden="true"></span></div>`;
  const dial = $('#dl-dial', hero), ring = $('#dl-ring', hero), thumbs = $$('.dl__t', hero), imgs = $$('.dl__photo img', hero);
  let ang = 0, vel = 0, drag = false, last = 0, cur = -1, target = null, moved = 0;
  const centre = () => { const r = dial.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const at = (e) => { const [cx, cy] = centre(); return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI; };
  const R = () => dial.clientWidth / 2 - dial.clientWidth * 0.11;
  const layout = () => { const r = R(); thumbs.forEach((t, k) => { const a = k * STEP + ang; t.style.transform = `rotate(${a}deg) translateY(${-r}px) rotate(${-a}deg)`; }); ring.style.setProperty('--r', r + 'px'); };
  const idx = () => ((Math.round(-ang / STEP) % N) + N) % N;
  const show = (k) => { if (k === cur) return; cur = k; imgs.forEach((m, n) => m.classList.toggle('is-on', n === k)); thumbs.forEach((t, n) => t.classList.toggle('is-on', n === k)); $('#dl-name', hero).textContent = set[k].name; $('#dl-price', hero).textContent = inr(set[k].price); $('#dl-shop', hero).dataset.quick = set[k].id; };
  S.on(dial, 'pointerdown', (e) => { drag = true; moved = 0; last = at(e); vel = 0; target = null; dial.setPointerCapture?.(e.pointerId); });
  S.on(dial, 'pointermove', (e) => { if (!drag) return; const a = at(e); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; ang += d; vel = d * 60; moved += Math.abs(d); last = a; });
  const end = () => { drag = false; };
  S.on(dial, 'pointerup', end); S.on(dial, 'pointercancel', end);
  S.on(dial, 'click', (e) => { const t = e.target.closest('.dl__t'); if (t && moved < 4) { const k = +t.dataset.k; let a = -k * STEP; const base = Math.round(ang / 360) * 360; target = a + base; if (Math.abs(target - ang) > 180) target += target < ang ? 360 : -360; } });
  S.on(window, 'keydown', (e) => { if (document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') target = Math.round(ang / STEP) * STEP - STEP; if (e.key === 'ArrowLeft') target = Math.round(ang / STEP) * STEP + STEP; });
  S.loop((dt) => {
    if (!drag) {
      if (target !== null) { ang += (target - ang) * Math.min(1, dt * 9); if (Math.abs(target - ang) < 0.1) { ang = target; target = null; } }
      else if (Math.abs(vel) > 8) { ang += vel * dt; vel *= Math.pow(0.05, dt); }
      else { const t = Math.round(ang / STEP) * STEP; ang += (t - ang) * Math.min(1, dt * 8); vel = 0; }
    }
    layout(); show(idx());
  });
  layout(); show(0);
  return () => S.clear();
}
