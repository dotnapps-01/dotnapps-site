import { inr } from '../products.js';
import { $, $$, reduced, scope, looks } from './util.js';

/* Flick stack: prints piled on a table. Flick the top one in any direction and it sails away with its momentum. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'fk';
  hero.innerHTML = `<div class="fk__top"><h1>Soft structure, <em>every day.</em></h1><p>Flick a print away</p></div>
    <div class="fk__stack" id="fk-stack">${set.map((p) => `<figure class="fk__p" data-id="${p.id}"><img src="${p.photo}" alt="${p.name}" draggable="false" decoding="async"><figcaption><b>${p.name}</b><span>${inr(p.price)}</span></figcaption></figure>`).join('')}</div>
    <div class="fk__foot"><a class="fk__btn" href="#shop">Shop the edit</a><p class="fk__tap">Tap a print to shop it</p></div>`;
  const ps = $$('.fk__p', hero), order = set.map((_, k) => k), st = ps.map((_, k) => ({ x: 0, y: 0, r: ((k * 37) % 13) - 6, vx: 0, vy: 0, vr: 0, fly: false, a: 1 }));
  let down = false, ox = 0, oy = 0, hist = [], moved = 0, grab = -1;
  const place = () => ps.forEach((el, k) => {
    const d = order.indexOf(k), s = st[k];
    el.style.zIndex = N - d; el.style.opacity = s.fly ? s.a : d < 4 ? 1 : 0; el.style.pointerEvents = d === 0 && !s.fly ? 'auto' : 'none';
    const sc = s.fly || d === 0 ? 1 : 1 - d * 0.03;
    el.style.transform = `translate3d(${s.x}px, ${s.y + (s.fly || d === 0 ? 0 : d * 7)}px, 0) rotate(${s.r}deg) scale(${sc})`;
  });
  place();
  const stack = $('#fk-stack', hero);
  S.on(stack, 'pointerdown', (e) => { const el = e.target.closest('.fk__p'); if (!el || ps.indexOf(el) !== order[0]) return; grab = order[0]; down = true; moved = 0; ox = e.clientX - st[grab].x; oy = e.clientY - st[grab].y; hist = [[e.clientX, e.clientY, performance.now()]]; st[grab].vx = st[grab].vy = 0; el.setPointerCapture?.(e.pointerId); el.classList.add('is-grab'); });
  S.on(stack, 'pointermove', (e) => { if (!down) return; const s = st[grab]; s.x = e.clientX - ox; s.y = e.clientY - oy; s.r += (s.x * 0.02 - s.r) * 0.2; moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); hist.push([e.clientX, e.clientY, performance.now()]); if (hist.length > 6) hist.shift(); place(); });
  const release = () => {
    if (!down) return; down = false; const el = ps[grab], s = st[grab], a = hist[0], b = hist[hist.length - 1]; el.classList.remove('is-grab');
    const dt = Math.max(1, b[2] - a[2]), vx = ((b[0] - a[0]) / dt) * 1000, vy = ((b[1] - a[1]) / dt) * 1000, sp = Math.hypot(vx, vy);
    if (sp > 520 || Math.hypot(s.x, s.y) > 150) { s.fly = true; const k = 1.6 / Math.max(1, sp / 900); s.vx = vx || (s.x > 0 ? 900 : -900); s.vy = vy; s.vr = s.vx * 0.04; }
    else if (moved < 6) document.dispatchEvent(new CustomEvent('levit:quick', { detail: set[grab].id }));
    grab = -1;
  };
  S.on(stack, 'pointerup', release); S.on(stack, 'pointercancel', release);
  S.loop((dt) => {
    st.forEach((s, k) => {
      if (s.fly) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt; s.a -= dt * 1.1;
        if (s.a <= 0) { s.fly = false; s.a = 1; s.x = s.y = 0; s.r = ((k * 53) % 17) - 8; order.push(order.shift()); }
      } else if (k !== grab && (s.x || s.y)) { s.x += (0 - s.x) * Math.min(1, dt * 12); s.y += (0 - s.y) * Math.min(1, dt * 12); if (Math.abs(s.x) + Math.abs(s.y) < 0.3) s.x = s.y = 0; }
    });
    place();
  });
  return () => S.clear();
}
