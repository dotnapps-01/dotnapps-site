import { inr } from '../products.js';
import { $, $$, reduced, scope, onReady, looks } from './util.js';

/* Spotlight: the looks sit in the dark. Move the light across the screen and they appear; with no pointer it wanders on its own. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'sp';
  hero.innerHTML = `<div class="sp__grid">${set.map((p) => `<button class="sp__tile" type="button" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}"><img src="${p.photo}" alt="" draggable="false" decoding="async"><span class="sp__tag"><b>${p.name}</b><i>${inr(p.price)}</i></span></button>`).join('')}</div>
    <div class="sp__dark" aria-hidden="true"></div>
    <p class="sp__word" aria-hidden="true">LEVIT</p>
    <div class="sp__copy"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure, <em>every day.</em></h1><div class="sp__row"><a class="sp__btn" href="#shop" data-magnet><span>Shop the edit</span></a><p class="sp__hint" id="sp-hint">Move the light</p></div></div>`;
  const tiles = $$('.sp__tile', hero);
  let tx = 0.5, ty = 0.5, x = 0.5, y = 0.5, last = -9e9, hot = -1;
  S.on(hero, 'pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; last = performance.now(); });
  if (matchMedia('(hover: none)').matches) $('#sp-hint', hero).textContent = 'Touch and drag the light';
  S.loop((dt, t) => {
    if (!reduced && performance.now() - last > 2400) { tx = 0.5 + 0.38 * Math.sin(t * 0.5); ty = 0.5 + 0.3 * Math.sin(t * 0.8 + 1); }
    if (reduced) { tx = 0.5; ty = 0.5; }
    x += (tx - x) * Math.min(1, dt * 5); y += (ty - y) * Math.min(1, dt * 5);
    hero.style.setProperty('--mx', (x * 100).toFixed(2) + '%'); hero.style.setProperty('--my', (y * 100).toFixed(2) + '%');
    const r = hero.getBoundingClientRect(); let best = -1, bd = 9e9;
    tiles.forEach((el, k) => { const b = el.getBoundingClientRect(), d = Math.hypot(b.left + b.width / 2 - (r.left + x * r.width), b.top + b.height / 2 - (r.top + y * r.height)); if (d < bd) { bd = d; best = k; } });
    if (best !== hot) { tiles[hot]?.classList.remove('is-hot'); tiles[best].classList.add('is-hot'); hot = best; }
  });
  onReady(() => hero.classList.add('is-in'));
  return () => S.clear();
}
