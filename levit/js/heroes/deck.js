import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, looks } from './util.js';

/* Swipe deck: drag a look right to save it to the wishlist, left to skip. Buttons do the same for one thumb. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'dk';
  hero.innerHTML = `<div class="dk__top"><h1>Soft structure, <em>every day.</em></h1><p class="dk__hint"><span>Swipe right to save</span><span>Swipe left to skip</span></p></div>
    <div class="dk__stack" id="dk-stack" role="group" aria-label="Looks to swipe">${set.map((p) => `<article class="dk__card" data-id="${p.id}"><img src="${p.photo}" alt="${p.name}" draggable="false" decoding="async"><span class="dk__stamp dk__stamp--love">Love</span><span class="dk__stamp dk__stamp--skip">Skip</span><div class="dk__meta"><b>${p.name}</b><span>${inr(p.price)}</span></div></article>`).join('')}</div>
    <div class="dk__btns"><button class="dk__b dk__b--skip" type="button" id="dk-skip" aria-label="Skip this look"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><button class="dk__b dk__b--shop" type="button" id="dk-shop" aria-label="Shop this look"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M5 8h14l-1 12.5H6L5 8Z"/><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/></svg></button><button class="dk__b dk__b--love" type="button" id="dk-love" aria-label="Save this look"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg></button></div>
    <p class="dk__saved"><b id="dk-n">0</b> saved this visit</p>`;
  const cards = $$('.dk__card', hero), order = set.map((_, k) => k);
  let saved = 0, busy = false;
  const layout = (anim = true) => order.forEach((k, d) => {
    const c = cards[k]; if (c.classList.contains('is-drag')) return;
    c.style.transition = anim && !reduced ? 'transform .45s var(--ease), opacity .3s' : 'none';
    c.style.zIndex = N - d; c.style.opacity = d < 3 ? 1 : 0; c.style.pointerEvents = d === 0 ? 'auto' : 'none';
    c.style.transform = `translate3d(0, ${d * 12}px, 0) scale(${1 - d * 0.05}) rotate(${d === 0 ? 0 : (k % 2 ? 1 : -1) * d * 1.6}deg)`;
  });
  layout(false);
  const stamps = (c, x) => { $('.dk__stamp--love', c).style.opacity = clamp(x / 110); $('.dk__stamp--skip', c).style.opacity = clamp(-x / 110); };
  const fly = (dir, from = 0) => {
    if (busy) return; busy = true;
    const k = order[0], c = cards[k], w = innerWidth;
    c.classList.remove('is-drag'); c.style.transition = reduced ? 'none' : 'transform .5s cubic-bezier(.3,.7,.3,1), opacity .5s';
    c.style.transform = `translate3d(${dir * w * 1.1}px, ${from * 0.4 - 30}px, 0) rotate(${dir * 28}deg)`; c.style.opacity = 0; stamps(c, dir * 200);
    if (dir > 0) { saved += 1; $('#dk-n', hero).textContent = saved; document.dispatchEvent(new CustomEvent('levit:wish', { detail: set[k].id })); }
    S.timeout(() => { order.push(order.shift()); stamps(c, 0); c.style.transition = 'none'; layout(false); void c.offsetWidth; busy = false; }, reduced ? 0 : 420);
    layout();
  };
  let x0 = 0, y0 = 0, dx = 0, dy = 0, t0 = 0, down = false, moved = 0;
  S.on($('#dk-stack', hero), 'pointerdown', (e) => { const c = e.target.closest('.dk__card'); if (!c || c !== cards[order[0]] || busy) return; down = true; x0 = e.clientX; y0 = e.clientY; dx = dy = moved = 0; t0 = performance.now(); c.classList.add('is-drag'); c.style.transition = 'none'; c.setPointerCapture?.(e.pointerId); });
  S.on($('#dk-stack', hero), 'pointermove', (e) => {
    if (!down) return; const c = cards[order[0]]; dx = e.clientX - x0; dy = e.clientY - y0; moved = Math.max(moved, Math.hypot(dx, dy));
    c.style.transform = `translate3d(${dx}px, ${dy * 0.5}px, 0) rotate(${dx * 0.07}deg)`; stamps(c, dx);
  });
  const end = () => {
    if (!down) return; down = false; const c = cards[order[0]]; c.classList.remove('is-drag');
    const v = dx / Math.max(1, performance.now() - t0);
    if (Math.abs(dx) > 110 || Math.abs(v) > 0.7) fly(dx > 0 ? 1 : -1, dy);
    else { stamps(c, 0); layout(); if (moved < 6) document.dispatchEvent(new CustomEvent('levit:quick', { detail: set[order[0]].id })); }
  };
  S.on($('#dk-stack', hero), 'pointerup', end); S.on($('#dk-stack', hero), 'pointercancel', end);
  S.on($('#dk-skip', hero), 'click', () => fly(-1)); S.on($('#dk-love', hero), 'click', () => fly(1));
  S.on($('#dk-shop', hero), 'click', () => document.dispatchEvent(new CustomEvent('levit:quick', { detail: set[order[0]].id })));
  S.on(window, 'keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') fly(1); if (e.key === 'ArrowLeft') fly(-1); });
  return () => S.clear();
}
