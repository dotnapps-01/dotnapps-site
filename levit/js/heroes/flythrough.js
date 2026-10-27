import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, onReady, looks } from './util.js';

/* Fly through: photos hang in a long corridor and the camera drifts forward through them. Wheel, drag or mouse height steers speed. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'fl';
  hero.innerHTML = `<div class="fl__scene" id="fl-scene">${[...set, ...set].map((p, k) => `<button class="fl__card" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false" decoding="async"><span class="fl__tag"><b>${p.name}</b><i>${inr(p.price)}</i></span></button>`).join('')}</div>
    <div class="fl__fog" aria-hidden="true"></div>
    <div class="fl__copy"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a></div>
    <p class="fl__hint"><i></i>Scroll or drag to fly faster</p>`;
  const scene = $('#fl-scene', hero), cards = $$('.fl__card', hero), N = cards.length;
  const GAP = 210, LEN = GAP * N;
  // each card sits to the left or right of the corridor at its own height, alternating sides
  const pos = cards.map((_, k) => { const side = k % 2 ? 1 : -1, spread = 0.3 + ((k * 37) % 11) / 11 * 0.22; return { sx: side * spread, y: (((k * 53) % 9) / 9 - 0.5) * 0.7, r: side * (3 + (k % 4)) }; });
  let cam = 0, speed = reduced ? 0 : 150, boost = 0, mx = 0, my = 0, tx = 0, ty = 0, drag = false, lastY = 0;
  S.on(hero, 'wheel', (e) => { if (hero.matches(':hover')) boost = clamp(boost + e.deltaY * 0.4, -600, 900); }, { passive: true });
  S.on(hero, 'pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; if (drag) { boost = clamp(boost + (lastY - e.clientY) * 3, -600, 900); lastY = e.clientY; } });
  S.on(hero, 'pointerdown', (e) => { if (e.target.closest('a, .fl__card')) return; drag = true; lastY = e.clientY; });
  S.on(hero, 'pointerup', () => { drag = false; });
  S.on(hero, 'pointerleave', () => { tx = ty = 0; drag = false; });
  S.loop((dt) => {
    boost *= Math.pow(0.04, dt);
    cam += (speed + boost) * dt; cam = ((cam % LEN) + LEN) % LEN;
    mx += (tx - mx) * Math.min(1, dt * 3); my += (ty - my) * Math.min(1, dt * 3);
    const w = hero.clientWidth, h = hero.clientHeight, cw = w < 700 ? w * 0.36 : Math.min(w * 0.2, h * 0.34), ch = cw * 1.33;
    scene.style.transform = `rotateY(${(mx * 5).toFixed(2)}deg) rotateX(${(-my * 3).toFixed(2)}deg)`;
    cards.forEach((c, k) => {
      let z = k * GAP - cam; if (z < -LEN + 300) z += LEN; if (z > 300) z -= LEN;   // wraps: appears far away, leaves behind the camera
      const p = pos[k], a = clamp((z + 2300) / 900) * clamp((260 - z) / 340);
      c.style.width = cw + 'px'; c.style.height = ch + 'px';
      c.style.opacity = a.toFixed(3);
      c.style.transform = `translate3d(${(p.sx * w).toFixed(1)}px,${(p.y * h).toFixed(1)}px,${z.toFixed(1)}px) translate(-50%,-50%) rotateY(${(-p.sx * 38).toFixed(1)}deg) rotateZ(${p.r}deg)`;
      c.style.pointerEvents = a > 0.5 && z > -900 ? 'auto' : 'none';
    });
  });
  onReady(() => hero.classList.add('is-in'));
  return () => S.clear();
}
