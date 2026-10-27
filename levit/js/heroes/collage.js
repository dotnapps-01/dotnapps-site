import { inr } from '../products.js';
import { $, $$, reduced, scope, onReady, looks } from './util.js';

/* Collage: a big editorial headline with photos pinned and taped at different depths. The layers shift against each other with the mouse. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'co';
  const P = [
    { i: 0, d: 1.0, c: 'co__p1' }, { i: 2, d: 0.6, c: 'co__p2' }, { i: 3, d: 1.5, c: 'co__p3' }, { i: 5, d: 0.8, c: 'co__p4' }, { i: 4, d: 1.2, c: 'co__p5' },
  ];
  hero.innerHTML = `<h1 class="co__h"><span>Soft</span><span><em>structure,</em></span><span>every day.</span></h1>
    <div class="co__layer">${P.map((q) => { const p = set[q.i]; return `<button class="co__p ${q.c}" type="button" data-d="${q.d}" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><i class="co__tape"></i><img src="${p.photo}" alt="" draggable="false" decoding="async"><span class="co__cap"><b>${p.name}</b><i>${inr(p.price)}</i></span></button>`; }).join('')}
      <div class="co__stamp" data-d="1.4" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="co-ring" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs><text><textPath href="#co-ring">NEW IN · AW26 · WOMENSWEAR · NEW IN · AW26 ·</textPath></text></svg><b>↗</b></div></div>
    <div class="co__foot"><p>The new collection, from our boutique.</p><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a></div>`;
  const layers = $$('[data-d]', hero);
  let tx = 0, ty = 0, x = 0, y = 0;
  S.on(hero, 'pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; });
  S.on(hero, 'pointerleave', () => { tx = ty = 0; });
  S.loop((dt, t) => {
    x += (tx - x) * Math.min(1, dt * 4); y += (ty - y) * Math.min(1, dt * 4);
    const sy = scrollY * 0.04;
    layers.forEach((el) => { const d = +el.dataset.d; el.style.translate = `${(-x * 26 * d).toFixed(1)}px ${(-y * 18 * d - sy * d + (reduced ? 0 : Math.sin(t * 0.7 + d * 3) * 5)).toFixed(1)}px`; });
  });
  onReady(() => hero.classList.add('is-in'));
  return () => S.clear();
}
