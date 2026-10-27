import { inr } from '../products.js';
import { $, $$, reduced, pad, scope, onReady, looks } from './util.js';

/* Story reel: a phone-shaped frame with progress bars; tap the sides, hold to pause. Highlight rings at the side jump to a look. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length, DUR = 5200;
  hero.className = 'st';
  hero.innerHTML = `<div class="st__copy st__rise"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1><p class="st__lede">Eight looks from our boutique, told like a story. Tap to move, hold to pause.</p><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a></div>
    <div class="st__phone" id="st-phone" aria-roledescription="carousel" aria-label="Looks">
      <div class="st__bars">${set.map(() => '<span><i></i></span>').join('')}</div>
      <div class="st__who"><b>L</b><span>levit.womenswear</span><small>AW26</small></div>
      ${set.map((p, k) => `<figure class="st__slide${k ? '' : ' is-on'}"><img src="${p.photo}" alt="${p.name}" ${k ? 'loading="lazy" ' : ''}decoding="async" draggable="false"></figure>`).join('')}
      <button class="st__zone st__zone--l" type="button" aria-label="Previous look"></button><button class="st__zone st__zone--r" type="button" aria-label="Next look"></button>
      <div class="st__cap"><div><b id="st-name"></b><span id="st-price"></span></div><button type="button" id="st-shop">Shop →</button></div>
    </div>
    <ul class="st__rings st__rise" aria-label="Choose a look">${set.map((p, k) => `<li><button type="button" data-k="${k}" aria-label="${p.name}"><img src="${p.photo}" alt="" loading="lazy" draggable="false"></button><span>${p.name.split(' ')[0]}</span></li>`).join('')}</ul>`;
  const phone = $('#st-phone', hero), slides = $$('.st__slide', hero), bars = $$('.st__bars i', hero), rings = $$('.st__rings button', hero);
  let i = 0, t0 = 0, held = false, acc = 0, stop = null;
  const label = () => { const p = set[i]; $('#st-name', hero).textContent = p.name; $('#st-price', hero).textContent = inr(p.price); $('#st-shop', hero).dataset.quick = p.id; };
  const show = (k) => {
    i = (k + N) % N; acc = 0;
    slides.forEach((s, m) => s.classList.toggle('is-on', m === i));
    bars.forEach((b, m) => { b.style.transition = 'none'; b.style.width = m < i ? '100%' : '0%'; });
    rings.forEach((r, m) => r.classList.toggle('is-on', m === i));
    label();
  };
  S.on($('.st__zone--r', hero), 'click', () => show(i + 1));
  S.on($('.st__zone--l', hero), 'click', () => show(i - 1));
  rings.forEach((r) => S.on(r, 'click', () => show(+r.dataset.k)));
  const hold = (v) => () => { held = v; phone.classList.toggle('is-held', v); };
  S.on(phone, 'pointerdown', (e) => { if (e.target.closest('.st__cap')) return; held = true; phone.classList.add('is-held'); });
  S.on(window, 'pointerup', hold(false)); S.on(phone, 'pointerleave', (e) => { if (e.pointerType === 'mouse') hold(false)(); });
  let run = !reduced;
  S.on(document, 'visibilitychange', () => { run = !document.hidden && !reduced; });
  S.loop((dt) => {
    if (!run || held || !root_ready()) return;
    acc += dt * 1000; bars[i].style.width = Math.min(100, (acc / DUR) * 100) + '%';
    if (acc >= DUR) show(i + 1);
  });
  function root_ready() { return document.documentElement.classList.contains('is-ready'); }
  show(0);
  return () => S.clear();
}
