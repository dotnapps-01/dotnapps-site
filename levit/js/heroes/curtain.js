import { inr } from '../products.js';
import { $, reduced, clamp, lerp, scope, onReady, pinProgress, looks } from './util.js';

/* Sand curtain: the LEVIT logo is printed across two curtain halves. Scrolling draws them apart onto the look behind. */
export function mount(hero) {
  const L = looks()[0];
  hero.className = 'cu';
  hero.innerHTML = `<div class="cu__pin">
      <div class="cu__scene">
        <img class="cu__bg" src="${L.photo}" alt="" decoding="async">
        <figure class="cu__fg"><img src="${L.photo}" alt="${L.name}" decoding="async"></figure>
        <div class="cu__copy">
          <h1>Soft structure,<br><em>every day.</em></h1>
          <div class="cu__cta"><a class="cu__btn" href="#shop"><span>Shop the edit</span></a><button class="cu__look" type="button" data-quick="${L.id}">${L.name} · ${inr(L.price)}</button></div>
        </div>
      </div>
      <div class="cu__panel cu__panel--l"><span class="cu__word" aria-hidden="true">LEVIT</span></div>
      <div class="cu__panel cu__panel--r"><span class="cu__word" aria-hidden="true">LEVIT</span></div>
      <p class="cu__cue"><i></i>Scroll to open the curtain</p>
    </div>`;
  const S = scope(), pin = $('.cu__pin', hero), scene = $('.cu__scene', hero), copy = $('.cu__copy', hero);
  let intro = reduced ? 0.22 : 0, target = 0;
  const paint = () => {
    const p = pinProgress(hero), e = p * p * (3 - 2 * p);
    const o = reduced ? 1 : lerp(intro, 1, e);                 // curtain opening 0..1
    pin.style.setProperty('--o', o.toFixed(4));
    scene.style.setProperty('--s', lerp(1.14, 1, o).toFixed(4));
    const t = clamp((o - 0.42) / 0.4); copy.style.opacity = t; copy.style.translate = `0 ${lerp(28, 0, t)}px`;
    pin.style.setProperty('--cue', p < 0.03 ? 1 : 0);
  };
  S.on(window, 'scroll', paint, { passive: true }); S.on(window, 'resize', paint);
  onReady(() => { // draw the curtain slightly ajar so the page invites a scroll
    const start = performance.now();
    const stop = S.loop(() => { const k = clamp((performance.now() - start) / 1800); intro = 0.24 * (1 - Math.pow(1 - k, 3)); paint(); if (k >= 1) stop(); });
  });
  paint();
  return () => S.clear();
}
