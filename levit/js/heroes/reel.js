import { inr } from '../products.js';
import { $, $$, pad, scope, looks } from './util.js';

/* Reel feed: each look fills the screen. Swipe up for the next; the price and Shop button sit under the thumb. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'rf';
  hero.innerHTML = `<div class="rf__col"><div class="rf__scroll" id="rf-scroll">${set.map((p, k) => `<section class="rf__s" data-i="${k}"><img src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}decoding="async" draggable="false">
      <div class="rf__shade"></div>
      ${k === 0 ? '<h1 class="rf__h">Soft structure,<br><em>every day.</em></h1>' : ''}
      <div class="rf__info"><p class="rf__no">${pad(k + 1)} / ${pad(set.length)}</p><h2>${p.name}</h2><div class="rf__row"><span>${inr(p.price)}</span><button class="rf__shop" type="button" data-quick="${p.id}">Shop this look</button></div></div>
      <button class="rf__heart" type="button" data-id="${p.id}" aria-pressed="false" aria-label="Save ${p.name}"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg></button></section>`).join('')}
      <section class="rf__s rf__end"><div><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h2>Soft structure, <em>every day.</em></h2><a class="rf__shop rf__shop--big" href="#shop">Shop the edit</a><p class="rf__down">Keep scrolling for the full collection</p></div></section></div>
    <div class="rf__dots" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
    <p class="rf__cue" id="rf-cue" aria-hidden="true"><i></i><span>Swipe up</span></p></div>`;
  const sc = $('#rf-scroll', hero), dots = $$('.rf__dots i', hero), cue = $('#rf-cue', hero);
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.6) { const k = +en.target.dataset.i; dots.forEach((d, m) => d.classList.toggle('is-on', m === k)); if (k > 0) cue.classList.add('gone'); } }), { root: sc, threshold: [0.6] });
  $$('.rf__s[data-i]', hero).forEach((s) => io.observe(s)); S.add(() => io.disconnect());
  dots[0].classList.add('is-on');
  S.on(hero, 'click', (e) => { const h = e.target.closest('.rf__heart'); if (!h) return; const on = h.getAttribute('aria-pressed') !== 'true'; h.setAttribute('aria-pressed', on); if (on) document.dispatchEvent(new CustomEvent('levit:wish', { detail: h.dataset.id })); });
  return () => S.clear();
}
