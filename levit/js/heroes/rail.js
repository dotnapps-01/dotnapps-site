import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, onReady, looks } from './util.js';

const HANGER = `<svg class="rl__hanger" viewBox="0 0 120 60" aria-hidden="true"><path d="M60 22V14c0-5 5-8 9-6s4 8-1 10" fill="none" stroke="#c8a24e" stroke-width="3.4" stroke-linecap="round"/><path d="M60 22 8 50c-3 2-2 5 2 5h100c4 0 5-3 2-5Z" fill="none" stroke="#14100d" stroke-width="4" stroke-linejoin="round"/></svg>`;

/* Clothes rail: photos hang from hangers on a brass rail. Drag it (it keeps its momentum) and they swing like pendulums. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'rl';
  hero.innerHTML = `<div class="rl__wall"></div>
    <div class="rl__bar" aria-hidden="true"><i></i><i></i></div>
    <div class="rl__track" id="rl-track" aria-label="Looks on the rail">${[...set, ...set, ...set].map((p, k) => `<div class="rl__item" data-k="${k}">${HANGER}<button class="rl__card" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false" ${k > 4 ? 'loading="lazy" ' : ''}decoding="async"><span class="rl__tag"><b>${p.name}</b><i>${inr(p.price)}</i></span></button></div>`).join('')}</div>
    <div class="rl__ui rl__rise"><h1 class="rl__h">Soft structure, <em>every day.</em></h1><div class="rl__row"><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a><p class="rl__hint"><span class="rl__arrows" aria-hidden="true">⟵ ⟶</span> Drag the rail</p></div></div>`;
  const track = $('#rl-track', hero), items = $$('.rl__item', hero);
  const n = set.length;
  let x = 0, v = 0, drag = false, moved = 0, lastX = 0, lastT = 0, setW = 1, W = 1;
  const th = items.map(() => ({ a: 0, w: 0 }));
  const measure = () => { const r = items[0].getBoundingClientRect(), r1 = items[1].getBoundingClientRect(); W = r1.left - r.left; setW = W * n; x = ((x % setW) + setW) % setW - setW; };
  S.on(window, 'resize', measure);
  S.on(hero, 'pointerdown', (e) => { if (e.target.closest('a, .rl__ui')) return; drag = true; moved = 0; lastX = e.clientX; lastT = performance.now(); hero.setPointerCapture?.(e.pointerId); hero.classList.add('is-drag'); });
  S.on(hero, 'pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - lastX, now = performance.now(), dt = Math.max(1, now - lastT);
    x += dx; moved += Math.abs(dx); v = 0.7 * v + 0.3 * (dx / dt) * 1000; lastX = e.clientX; lastT = now;
  });
  const end = () => { drag = false; hero.classList.remove('is-drag'); };
  S.on(hero, 'pointerup', end); S.on(hero, 'pointercancel', end);
  S.on(hero, 'click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  const drift = reduced ? 0 : -30;
  onReady(() => { measure(); hero.classList.add('is-in'); });
  S.loop((dt, t) => {
    if (!W || W === 1) measure();
    if (!drag) { v += ((drift - v) * Math.min(1, dt * 1.6)); x += v * dt; }
    else v *= 0.9;
    if (x <= -setW * 2) x += setW; if (x > -setW) x -= setW;
    track.style.transform = `translate3d(${x}px,0,0)`;
    items.forEach((it, k) => {
      const s = th[k], target = clamp(-v * 0.014, -22, 22) + Math.sin(t * 1.1 + k * 0.9) * 1.6;
      s.w += (-70 * (s.a - target) - 5.2 * s.w) * dt; s.a += s.w * dt;
      it.style.transform = `rotate(${s.a.toFixed(2)}deg)`;
    });
  });
  return () => S.clear();
}
