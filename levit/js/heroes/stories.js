import { inr } from '../products.js';
import { $, $$, reduced, pad, root, scope, looks } from './util.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const WHEN = ['now', '2m', '14m', '1h', '3h', '5h', '8h', '1d'];

/* Story reel: a phone-shaped frame of looks with progress bars. Tap the sides to move, hold to pause,
   tap the sticker or the pill to shop. Rings beside it jump to a look. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length, DUR = 5200;
  hero.className = 'st';
  hero.innerHTML = `<div class="st__glow" aria-hidden="true">${set.map((p) => `<img src="${p.photo}" alt="">`).join('')}</div>
    <div class="st__copy">
      <p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p>
      <h1>Soft structure,<br><em>every day.</em></h1>
      <p class="st__lede">Eight looks from our boutique, told like a story. Tap to move, hold to pause, tap the sticker to shop.</p>
      <a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a>
    </div>
    <div class="st__phone" id="st-phone" role="group" aria-roledescription="carousel" aria-label="Looks from the AW26 collection">
      <div class="st__bars">${set.map(() => '<span><i></i></span>').join('')}</div>
      <div class="st__say" id="st-say" aria-live="polite"></div>
      <div class="st__who"><span class="st__av"><b>L</b></span><span class="st__id">levit.womenswear</span><small id="st-when">now</small></div>
      ${set.map((p, k) => `<figure class="st__slide${k ? '' : ' is-on'}"><img src="${p.photo}" alt="${p.name}" ${k ? 'loading="lazy" ' : ''}decoding="async" draggable="false"></figure>`).join('')}
      <button class="st__zone st__zone--l" type="button" aria-label="Previous look"></button><button class="st__zone st__zone--r" type="button" aria-label="Next look"></button>
      <div class="st__size" id="st-size" role="group" aria-label="Save your size"><small>My size</small>${SIZES.map((z) => `<button type="button" data-z="${z}" aria-pressed="false">${z}</button>`).join('')}</div>
      <p class="st__swipe" id="st-swipe" aria-hidden="true"><i></i><i></i><span>Swipe up</span></p>
      <p class="st__paused" aria-hidden="true">Paused</p>
      <span class="st__glare" aria-hidden="true"></span>
      <button class="st__sticker" id="st-sticker" type="button"><small>The look</small><b id="st-name"></b><span id="st-price"></span></button>
      <div class="st__bottom"><button class="st__like" id="st-like" type="button" aria-pressed="false" aria-label="Like this look"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg></button><button class="st__shop" id="st-shop" type="button">Shop this look <span aria-hidden="true">↑</span></button></div>
    </div>
    <ul class="st__rings" aria-label="Choose a look">${set.map((p, k) => `<li><button type="button" data-k="${k}" aria-label="${p.name}"><img src="${p.photo}" alt="" loading="lazy" draggable="false"></button><span>${p.name.split(' ').slice(0, 2).join(' ')}</span></li>`).join('')}</ul>`;
  const phone = $('#st-phone', hero), slides = $$('.st__slide', hero), bars = $$('.st__bars i', hero), rings = $$('.st__rings button', hero), like = $('#st-like', hero);
  const liked = new Set();
  const say = (p) => { let s = (p.blurb.split(/(?<=\.)\s/)[0] || p.blurb).replace(/\.$/, ''); const cut = s.indexOf(','); if (cut > 24) s = s.slice(0, cut); const words = s.split(' ').slice(0, 11); return words.map((w, n) => `<span style="--w:${n}">${w}</span>`).join(' '); };
  const mySize = () => { try { return localStorage.getItem('levit.size'); } catch { return null; } };
  const markSize = () => $$('.st__size button', hero).forEach((b) => b.setAttribute('aria-pressed', b.dataset.z === mySize()));
  const glows = $$('.st__glow img', hero);
  let i = 0, held = false, acc = 0, visible = true;
  const label = () => {
    const p = set[i];
    $('#st-name', hero).textContent = p.name; $('#st-price', hero).textContent = inr(p.price); $('#st-when', hero).textContent = WHEN[i] || 'now';
    $('#st-sticker', hero).dataset.quick = p.id; $('#st-shop', hero).dataset.quick = p.id;
    like.setAttribute('aria-pressed', liked.has(i));
    const sayEl = $('#st-say', hero); sayEl.innerHTML = `<p>${say(p)}</p>`; sayEl.classList.remove('go'); void sayEl.offsetWidth; sayEl.classList.add('go');
    phone.classList.toggle('has-size', i % 3 === 2); phone.classList.toggle('show-swipe', i < 2);
    glows.forEach((g, m) => g.classList.toggle('is-on', m === i)); markSize();
    // a small tilt that changes with each look, so the sticker feels placed by hand
    $('#st-sticker', hero).style.setProperty('--tilt', [-3, 2.5, -2, 3, -3.5, 2, -2.5, 3][i % 8] + 'deg');
  };
  const show = (k) => {
    i = (k + N) % N; acc = 0;
    slides.forEach((s, m) => s.classList.toggle('is-on', m === i));
    bars.forEach((b, m) => { b.style.width = m < i ? '100%' : '0%'; });
    rings.forEach((r, m) => { r.classList.toggle('is-on', m === i); r.classList.toggle('is-seen', m < i); r.style.setProperty('--p', m === i ? 0 : 0); });
    label();
  };
  S.on($('.st__zone--r', hero), 'click', () => show(i + 1));
  S.on($('.st__zone--l', hero), 'click', () => show(i - 1));
  rings.forEach((r) => S.on(r, 'click', () => show(+r.dataset.k)));
  S.on(like, 'click', () => {
    if (liked.has(i)) liked.delete(i); else { liked.add(i); for (let n = 0; n < 7; n++) { const h = document.createElement('i'); h.className = 'st__heart'; h.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px'); h.style.setProperty('--d', (Math.random() * .25) + 's'); h.style.setProperty('--s', (.7 + Math.random() * .7).toFixed(2)); $('.st__bottom', hero).append(h); setTimeout(() => h.remove(), 1500); } }
    like.setAttribute('aria-pressed', liked.has(i));
  });
  const hold = (v) => () => { held = v; phone.classList.toggle('is-held', v); };
  S.on(phone, 'pointerdown', (e) => { if (e.target.closest('.st__sticker, .st__bottom')) return; held = true; phone.classList.add('is-held'); });
  S.on(window, 'pointerup', hold(false)); S.on(window, 'pointercancel', hold(false));
  S.on(phone, 'pointerleave', (e) => { if (e.pointerType === 'mouse') hold(false)(); });
  S.on(window, 'keydown', (e) => { if (!visible || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);
  let run = !reduced;
  S.on(document, 'visibilitychange', () => { run = !document.hidden && !reduced; });
  S.loop((dt) => {
    if (!run || held || !visible || !root.classList.contains('is-ready')) return;
    acc += dt * 1000; const pc = Math.min(100, (acc / DUR) * 100); bars[i].style.width = pc + '%'; rings[i].style.setProperty('--p', pc.toFixed(1));
    if (acc >= DUR) show(i + 1);
  });
  S.on($('#st-size', hero), 'click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    try { localStorage.setItem('levit.size', b.dataset.z); } catch { /* storage unavailable */ }
    markSize(); document.dispatchEvent(new CustomEvent('levit:toast', { detail: `Size ${b.dataset.z} saved. We'll preselect it when you shop.` }));
  });
  // swipe up on the frame opens the product, like the link sticker in a story
  let sy = null, sx = null;
  S.on(phone, 'pointerdown', (e) => { if (e.target.closest('button')) return; sy = e.clientY; sx = e.clientX; });
  S.on(window, 'pointerup', (e) => { if (sy === null) return; const dy = e.clientY - sy, dx = e.clientX - sx; sy = null; if (dy < -70 && Math.abs(dx) < 70) document.dispatchEvent(new CustomEvent('levit:quick', { detail: set[i].id })); });
  // a gentle 3D tilt toward the pointer, with a moving glare
  if (!reduced) {
    S.on(hero, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = phone.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const k = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 520)), l = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 520));
      phone.style.setProperty('--ry', (k * 7).toFixed(2) + 'deg'); phone.style.setProperty('--rx', (-l * 5).toFixed(2) + 'deg');
      phone.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); phone.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
    });
    S.on(hero, 'pointerleave', () => { phone.style.setProperty('--ry', '0deg'); phone.style.setProperty('--rx', '0deg'); });
  }
  show(0);
  return () => S.clear();
}
