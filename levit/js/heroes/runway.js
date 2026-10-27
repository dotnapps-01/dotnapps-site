import { $, $$, reduced, clamp, lerp, pad, scope, onReady, pinProgress, looks } from './util.js';
import { inr } from '../products.js';

/* Runway: the page pins while the looks walk across the screen behind a huge LEVIT; the one nearest the centre steps forward. */
export function mount(hero) {
  const list = looks();
  hero.className = 'rw';
  hero.innerHTML = `<div class="rw__pin">
      <p class="rw__word" aria-hidden="true"><span>LEVIT</span></p>
      <div class="rw__track" id="rw-track">${list.map((p, k) => `<button class="rw__card" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" ${k > 1 ? 'loading="lazy" ' : ''}decoding="async" draggable="false"><span class="rw__tag"><b>${p.name}</b><i>${inr(p.price)}</i></span></button>`).join('')}</div>
      <div class="rw__ui">
        <h1 class="rw__h">Soft structure, <em>every day.</em></h1>
        <div class="rw__row"><a class="rw__btn" href="#shop"><span>Shop the edit</span></a><p class="rw__now"><b id="rw-n">01</b> / ${pad(list.length)} &nbsp; <span id="rw-name"></span></p></div>
      </div>
      <p class="rw__cue"><i></i>Scroll to walk the runway</p>
    </div>`;
  const S = scope(), track = $('#rw-track', hero), cards = $$('.rw__card', hero), pinEl = $('.rw__pin', hero);
  let auto = 0, last = '';
  const paint = () => {
    const vw = innerWidth, trackW = track.scrollWidth;
    const p = clamp(pinProgress(hero) + auto);
    const x = lerp(vw * 0.5, -(trackW - vw * 0.5), p);
    track.style.transform = `translate3d(${x}px,0,0)`;
    pinEl.style.setProperty('--wx', (-p * 18).toFixed(2) + 'vw');
    let best = 0, bd = 9e9;
    cards.forEach((c, k) => {
      const cx = x + c.offsetLeft + c.offsetWidth / 2, d = (cx - vw / 2) / vw, a = Math.abs(d);
      if (a < bd) { bd = a; best = k; }
      const s = 1.1 - clamp(a * 0.9, 0, 0.3);
      c.style.transform = `scale(${s.toFixed(3)}) rotate(${(d * 6).toFixed(2)}deg)`;
      c.style.opacity = String(1 - clamp(a - 0.45, 0, 0.5)).slice(0, 5);
      c.style.zIndex = Math.round(s * 100);
    });
    const name = list[best].name;
    if (name !== last) { last = name; $('#rw-n', hero).textContent = pad(best + 1); $('#rw-name', hero).textContent = name; }
    pinEl.style.setProperty('--cue', pinProgress(hero) < 0.03 ? 1 : 0);
  };
  S.on(window, 'scroll', paint, { passive: true }); S.on(window, 'resize', paint);
  onReady(() => { if (reduced) return; const t0 = performance.now(); const stop = S.loop(() => { const k = clamp((performance.now() - t0) / 2600); auto = 0.1 * (1 - Math.pow(1 - k, 3)); paint(); if (k >= 1) stop(); }); });
  paint();
  return () => S.clear();
}
