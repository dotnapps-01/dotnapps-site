import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, looks } from './util.js';

/* Draggable pile: prints scattered on a warm tabletop. Grab one, throw it, shuffle the lot. A tap opens the product. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'pl';
  hero.innerHTML = `<div class="pl__copy pl__rise"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1><p class="pl__lede">A table of prints from our boutique. Pick them up, throw them about, tap one to shop it.</p><div class="pl__row"><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a><button class="pl__shuffle" type="button" id="pl-shuffle">Shuffle ↺</button></div></div>
    <div class="pl__table" id="pl-table">${set.map((p, k) => `<figure class="pl__print" data-id="${p.id}" tabindex="0" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false" ${k > 3 ? 'loading="lazy" ' : ''}decoding="async"><figcaption><b>${p.name}</b><span>${inr(p.price)}</span></figcaption></figure>`).join('')}</div>`;
  const table = $('#pl-table', hero), els = $$('.pl__print', hero);
  const st = els.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, tx: null, ty: null, tr: 0 }));
  let top = 10, grab = -1, ox = 0, oy = 0, hist = [], moved = 0, size = { w: 1, h: 1, pw: 150, ph: 190 };
  const measure = () => { const r = table.getBoundingClientRect(), p = els[0].getBoundingClientRect(); size = { w: r.width, h: r.height, pw: p.width, ph: p.height }; };
  const scatter = (animate) => {
    measure();
    const left = size.w > 800 ? size.w * 0.42 : size.pw * 0.2, span = size.w - left - size.pw * 0.2;
    st.forEach((s, k) => {
      const col = k % 4, row = Math.floor(k / 4);
      const nx = left + (col / 3) * (span - size.pw) + (Math.random() - 0.5) * size.pw * 0.5, ny = (size.h - size.ph) * (0.12 + row * 0.5) + (Math.random() - 0.5) * size.ph * 0.35;
      const nr = (Math.random() - 0.5) * 26;
      if (animate) { s.tx = clamp(nx, 0, size.w - size.pw); s.ty = clamp(ny, 0, size.h - size.ph); s.tr = nr; } else { s.x = clamp(nx, 0, size.w - size.pw); s.y = clamp(ny, 0, size.h - size.ph); s.r = nr; }
    });
  };
  const place = () => els.forEach((e, k) => { const s = st[k]; e.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) rotate(${s.r.toFixed(2)}deg)`; });
  scatter(false); place();
  S.on(window, 'resize', () => { measure(); st.forEach((s) => { s.x = clamp(s.x, 0, size.w - size.pw); s.y = clamp(s.y, 0, size.h - size.ph); }); });
  S.on(table, 'pointerdown', (e) => {
    const el = e.target.closest('.pl__print'); if (!el) return;
    grab = els.indexOf(el); const s = st[grab], r = table.getBoundingClientRect();
    ox = e.clientX - r.left - s.x; oy = e.clientY - r.top - s.y; moved = 0; hist = [[e.clientX, e.clientY, performance.now()]];
    s.vx = s.vy = s.vr = 0; s.tx = null; el.style.zIndex = ++top; el.classList.add('is-grab'); el.setPointerCapture?.(e.pointerId);
  });
  S.on(table, 'pointermove', (e) => {
    if (grab < 0) return; const s = st[grab], r = table.getBoundingClientRect();
    const nx = e.clientX - r.left - ox, ny = e.clientY - r.top - oy; moved += Math.abs(nx - s.x) + Math.abs(ny - s.y);
    s.x = clamp(nx, -size.pw * 0.2, size.w - size.pw * 0.8); s.y = clamp(ny, -size.ph * 0.2, size.h - size.ph * 0.8);
    hist.push([e.clientX, e.clientY, performance.now()]); if (hist.length > 6) hist.shift();
  });
  const release = () => {
    if (grab < 0) return; const s = st[grab], a = hist[0], b = hist[hist.length - 1];
    if (a && b && b[2] > a[2]) { s.vx = ((b[0] - a[0]) / (b[2] - a[2])) * 1000; s.vy = ((b[1] - a[1]) / (b[2] - a[2])) * 1000; s.vr = s.vx * 0.05; }
    els[grab].classList.remove('is-grab'); grab = -1;
  };
  S.on(window, 'pointerup', release); S.on(window, 'pointercancel', release);
  S.on(table, 'click', (e) => {
    const el = e.target.closest('.pl__print'); if (!el) return;
    if (moved > 6) { moved = 0; return; }
    document.dispatchEvent(new CustomEvent('levit:quick', { detail: el.dataset.id }));
  });
  S.on(table, 'keydown', (e) => { if (e.key === 'Enter') e.target.click?.(); });
  S.on($('#pl-shuffle', hero), 'click', () => scatter(true));
  S.loop((dt) => {
    st.forEach((s, k) => {
      if (k === grab) return;
      if (s.tx !== null) {                                    // spring toward a shuffle target
        s.x += (s.tx - s.x) * Math.min(1, dt * 7); s.y += (s.ty - s.y) * Math.min(1, dt * 7); s.r += (s.tr - s.r) * Math.min(1, dt * 7);
        if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) < 0.6) s.tx = null;
      } else if (Math.abs(s.vx) + Math.abs(s.vy) > 4) {       // thrown: slide, spin, bounce off the table edges
        s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt;
        const f = Math.pow(0.12, dt); s.vx *= f; s.vy *= f; s.vr *= f;
        const maxX = size.w - size.pw, maxY = size.h - size.ph;
        if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx) * 0.55; } if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx) * 0.55; }
        if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy) * 0.55; } if (s.y > maxY) { s.y = maxY; s.vy = -Math.abs(s.vy) * 0.55; }
      }
    });
    place();
  });
  return () => S.clear();
}
