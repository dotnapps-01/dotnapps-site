import { inr } from '../products.js';
import { $, $$, reduced, scope, onReady, looks } from './util.js';

/* Bento grid: photo tiles that each change on their own beat, beside colour blocks. Calm, modern, shop-first. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'bn';
  const ph = (cls, start, extra = '') => `<div class="bn__t bn__ph ${cls}" data-s="${start}">${set.map((p, k) => `<button class="bn__slide${k === start ? ' is-on' : ''}" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" ${k === start ? '' : 'loading="lazy" '}decoding="async" draggable="false"><span class="bn__tag"><b>${p.name}</b><i>${inr(p.price)}</i></span></button>`).join('')}${extra}</div>`;
  hero.innerHTML = `<div class="bn__grid">
      ${ph('bn__a', 0, `<div class="bn__copy"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1></div>`)}
      ${ph('bn__b', 2)}
      ${ph('bn__d', 4)}
      <div class="bn__t bn__c"><b>22</b><span>new pieces,<br>shot in our<br>own boutique</span></div>
      <a class="bn__t bn__e" href="#shop" data-magnet><span>Shop<br>the edit</span><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
    </div>`;
  const tiles = $$('.bn__ph', hero);
  tiles.forEach((t, n) => {
    const slides = $$('.bn__slide', t); let i = +t.dataset.s, held = false;
    S.on(t, 'pointerenter', () => { held = true; }); S.on(t, 'pointerleave', () => { held = false; });
    const show = (k) => { i = (k + slides.length) % slides.length; slides.forEach((s, m) => s.classList.toggle('is-on', m === i)); };
    if (!reduced) onReady(() => S.timeout(() => S.interval(() => { if (!held && !document.hidden) show(i + 1); }, 4300 + n * 700), 900 + n * 1100));
  });
  onReady(() => hero.classList.add('is-in'));
  return () => S.clear();
}
