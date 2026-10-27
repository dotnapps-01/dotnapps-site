import { inr } from '../products.js';
import { $, $$, pad, scope, looks } from './util.js';

const HEART = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg>';

/* Hero reel: each look fills the frame and you swipe up for the next. The rest of the page scrolls normally;
   "Skip to shop" and the last panel hand the visitor on. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'rf';
  hero.innerHTML = `<div class="rf__bg" aria-hidden="true">${set.map((p) => `<img src="${p.photo}" alt="">`).join('')}</div>
    <div class="rf__side"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1><p>Swipe through eight looks from our boutique, save the ones you love, shop in one tap.</p><a class="rf__shop rf__shop--big" href="#shop">Shop the edit</a></div>
    <div class="rf__col">
      <h1 class="rf__h">Soft structure,<br><em>every day.</em></h1>
      <a class="rf__skip" href="#shop">Skip to shop ↓</a>
      <div class="rf__scroll" id="rf-scroll" tabindex="-1">${set.map((p, k) => `<section class="rf__s" data-i="${k}" aria-label="${p.name}"><img src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}decoding="async" draggable="false">
        <div class="rf__shade"></div>
        <div class="rf__info"><p class="rf__no">${pad(k + 1)} / ${pad(set.length)}</p><h2>${p.name}</h2><div class="rf__row"><span>${inr(p.price)}</span><button class="rf__shop" type="button" data-quick="${p.id}">Shop this look</button></div></div>
        <button class="rf__heart" type="button" data-id="${p.id}" aria-pressed="false" aria-label="Save ${p.name}">${HEART}</button></section>`).join('')}
        <section class="rf__s rf__end"><div><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h2>Soft structure, <em>every day.</em></h2><a class="rf__shop rf__shop--big" href="#shop">Shop the edit</a><p class="rf__down">Keep scrolling for the full collection</p></div></section></div>
      <div class="rf__dots" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
      <p class="rf__cue" id="rf-cue" aria-hidden="true"><i></i><span>Swipe up</span></p></div>`;
  const sc = $('#rf-scroll', hero), dots = $$('.rf__dots i', hero), cue = $('#rf-cue', hero), bgs = $$('.rf__bg img', hero), col = $('.rf__col', hero);
  const mark = (k) => { dots.forEach((d, m) => d.classList.toggle('is-on', m === k)); bgs.forEach((b, m) => b.classList.toggle('is-on', m === k)); col.classList.toggle('at-end', k < 0); };
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting || en.intersectionRatio < 0.6) return;
    const k = en.target.dataset.i === undefined ? -1 : +en.target.dataset.i;
    mark(k); if (k !== 0) cue.classList.add('gone');
  }), { root: sc, threshold: [0.6] });
  $$('.rf__s', hero).forEach((s) => io.observe(s)); S.add(() => io.disconnect());
  mark(0);
  S.on(hero, 'click', (e) => {
    const h = e.target.closest('.rf__heart'); if (!h) return;
    const on = h.getAttribute('aria-pressed') !== 'true'; h.setAttribute('aria-pressed', on);
    if (on) document.dispatchEvent(new CustomEvent('levit:wish', { detail: h.dataset.id }));
  });
  return () => S.clear();
}
