import { inr } from '../products.js';
import { $, $$, reduced, scope, onReady, looks } from './util.js';

/* Photo booth: the machine prints strips of four looks, which drop onto the table. Press the button for another. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'pb';
  hero.innerHTML = `<div class="pb__copy"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure, <em>every day.</em></h1><p class="pb__lede">Our little photo booth prints four looks at a time. Tap a photo to shop it.</p><div class="pb__row"><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a><button class="pb__again" type="button" id="pb-print">Print a strip ＋</button></div></div>
    <div class="pb__machine" aria-hidden="true"><div class="pb__sign">LEVIT BOOTH</div><div class="pb__slot"><i id="pb-led"></i></div></div>
    <div class="pb__table" id="pb-table"></div>`;
  const table = $('#pb-table', hero), led = $('#pb-led', hero);
  let n = 0, busy = false, timer = 0;
  const slotX = () => hero.clientWidth * (hero.clientWidth > 900 ? 0.64 : 0.5);
  function print() {
    if (busy) return; busy = true; led.classList.add('is-on');
    const w = hero.clientWidth, h = hero.clientHeight, mob = w < 700, sw = mob ? Math.min(w * 0.3, 130) : Math.min(w * 0.12, 175);
    const strip = document.createElement('div'); strip.className = 'pb__strip';
    strip.style.width = sw + 'px';
    const picks = Array.from({ length: 4 }, (_, m) => set[(n * 4 + m * 2 + m) % set.length]);
    strip.innerHTML = picks.map((p) => `<button type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false"></button>`).join('');
    strip.style.left = slotX() - sw / 2 + 'px'; strip.style.top = (mob ? 120 : 138) + 'px';
    table.append(strip); n++;
    const rest = { x: (mob ? 0.08 : 0.34) * w + Math.random() * (w * (mob ? 0.62 : 0.5)), y: h * (mob ? 0.32 : 0.28) + Math.random() * h * 0.12, r: (Math.random() - 0.5) * 24 };
    requestAnimationFrame(() => strip.classList.add('is-out'));
    const done = reduced ? 0 : 2300;
    S.timeout(() => {
      led.classList.remove('is-on');
      strip.style.transition = 'left 1s var(--ease), top 1s var(--ease), rotate 1s var(--ease)';
      strip.style.left = rest.x + 'px'; strip.style.top = rest.y + 'px'; strip.style.rotate = rest.r + 'deg';
      const all = $$('.pb__strip', table); if (all.length > 6) { const old = all[0]; old.classList.add('is-gone'); S.timeout(() => old.remove(), 700); }
      busy = false;
    }, done);
  }
  const arm = () => { clearInterval(timer); if (!reduced) timer = setInterval(() => { if (!document.hidden) print(); }, 5200); };
  S.add(() => clearInterval(timer));
  S.on($('#pb-print', hero), 'click', () => { print(); arm(); });
  onReady(() => { S.timeout(() => { print(); arm(); }, 700); });
  return () => S.clear();
}
