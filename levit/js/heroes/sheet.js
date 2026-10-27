import { inr } from '../products.js';
import { $, $$, reduced, clamp, scope, looks } from './util.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

/* Bottom sheet: a full-screen look with a sheet you drag up from the bottom to pick a size and add to the bag. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'sh';
  hero.innerHTML = `<div class="sh__photo" id="sh-photo">${set.map((p, k) => `<img class="${k ? '' : 'is-on'}" src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}draggable="false" decoding="async">`).join('')}</div>
    <div class="sh__shade"></div>
    <h1 class="sh__h">Soft structure,<br><em>every day.</em></h1>
    <div class="sh__dots" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
    <div class="sh__sheet" id="sh-sheet">
      <button class="sh__grip" id="sh-grip" type="button" aria-expanded="false" aria-label="Open details"><i></i></button>
      <div class="sh__head"><div><h2 id="sh-name"></h2><p id="sh-price"></p></div><span class="sh__up" aria-hidden="true">Swipe up</span></div>
      <div class="sh__body"><p id="sh-blurb"></p><p class="sh__lbl">Size</p><div class="sh__sizes" id="sh-sizes" role="group" aria-label="Size">${SIZES.map((z) => `<button type="button" data-z="${z}" aria-pressed="false">${z}</button>`).join('')}</div><button class="sh__add" id="sh-add" type="button">Pick a size</button><button class="sh__more" id="sh-more" type="button">Full details</button></div>
    </div>`;
  const photo = $('#sh-photo', hero), imgs = $$('img', photo), dots = $$('.sh__dots i', hero), sheet = $('#sh-sheet', hero), grip = $('#sh-grip', hero);
  let i = 0, size = null, open = false, drag = false, y0 = 0, base = 0, cur = 0, maxY = 0, v = 0, lastY = 0, lastT = 0;
  const show = (k) => { i = (k + N) % N; imgs.forEach((m, n) => m.classList.toggle('is-on', n === i)); dots.forEach((d, n) => d.classList.toggle('is-on', n === i)); const p = set[i]; $('#sh-name', hero).textContent = p.name; $('#sh-price', hero).textContent = inr(p.price); $('#sh-blurb', hero).textContent = p.blurb; $('#sh-more', hero).dataset.quick = p.id; };
  const measure = () => { const peek = 118; maxY = Math.max(0, sheet.offsetHeight - peek); };
  const set_y = (y, anim) => { cur = clamp(y, 0, maxY); sheet.style.transition = anim && !reduced ? 'transform .45s var(--ease)' : 'none'; sheet.style.transform = `translate3d(0, ${cur}px, 0)`; const pr = 1 - cur / (maxY || 1); photo.style.transition = sheet.style.transition.replace('transform', 'transform, filter'); photo.style.setProperty('--p', pr.toFixed(3)); };
  const snap = (o) => { open = o; set_y(o ? 0 : maxY, true); grip.setAttribute('aria-expanded', o); sheet.classList.toggle('is-open', o); };
  const btn = () => { const b = $('#sh-add', hero); b.textContent = size ? `Add to bag · ${inr(set[i].price)}` : 'Pick a size'; b.classList.toggle('is-ready', !!size); };
  S.on($('#sh-sizes', hero), 'click', (e) => { const b = e.target.closest('[data-z]'); if (!b) return; size = b.dataset.z; $$('#sh-sizes button', hero).forEach((n) => n.setAttribute('aria-pressed', n === b)); btn(); });
  S.on($('#sh-add', hero), 'click', () => { if (!size) { $('#sh-sizes', hero).classList.add('shake'); S.timeout(() => $('#sh-sizes', hero).classList.remove('shake'), 500); return; } document.dispatchEvent(new CustomEvent('levit:add', { detail: { id: set[i].id, size } })); });
  S.on(grip, 'click', () => snap(!open));
  // drag the sheet by its top part
  S.on(sheet, 'pointerdown', (e) => { if (e.target.closest('.sh__body button, .sh__sizes')) return; drag = true; y0 = e.clientY; base = cur; v = 0; lastY = e.clientY; lastT = performance.now(); sheet.setPointerCapture?.(e.pointerId); });
  S.on(sheet, 'pointermove', (e) => { if (!drag) return; const now = performance.now(); v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now; set_y(base + (e.clientY - y0), false); });
  const end = (e) => { if (!drag) return; drag = false; const moved = Math.abs(e.clientY - y0); if (moved < 6) return; snap(v < -0.25 ? true : v > 0.25 ? false : cur < maxY / 2); };
  S.on(sheet, 'pointerup', end); S.on(sheet, 'pointercancel', end);
  // swipe the photo for the next look
  let sx = null;
  S.on(photo, 'pointerdown', (e) => { sx = e.clientX; }); S.on(photo, 'pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); size = null; $$('#sh-sizes button', hero).forEach((n) => n.setAttribute('aria-pressed', false)); btn(); } else if (open) snap(false); });
  S.on(window, 'resize', () => { measure(); set_y(open ? 0 : maxY, false); });
  show(0); btn(); requestAnimationFrame(() => { measure(); set_y(maxY, false); });
  S.timeout(() => { measure(); if (!open) set_y(maxY, false); }, 400);
  return () => S.clear();
}
