import { inr } from '../products.js';
import { $, $$, pad, scope, looks } from './util.js';

const PINS = [{ l: 'Detail', x: 50, y: 28 }, { l: 'Fabric', x: 36, y: 50 }, { l: 'Fit', x: 60, y: 64 }, { l: 'Finish', x: 48, y: 84 }];

/* Shop-the-look pins: tap a dot on the photo to see a detail of that piece, taken from the product description. */
export function mount(hero) {
  const set = looks(), S = scope(), N = set.length;
  hero.className = 'pn';
  hero.innerHTML = `<div class="pn__top"><h1>Soft structure, <em>every day.</em></h1><p class="pn__no"><span id="pn-n">01</span> / ${pad(N)}</p></div>
    <div class="pn__frame" id="pn-frame"><div class="pn__photo">${set.map((p, k) => `<img class="${k ? '' : 'is-on'}" src="${p.photo}" alt="${p.name}" ${k > 1 ? 'loading="lazy" ' : ''}draggable="false" decoding="async">`).join('')}</div><div class="pn__pins" id="pn-pins"></div><div class="pn__tip" id="pn-tip" role="status"></div></div>
    <div class="pn__bar"><button class="pn__arrow" id="pn-prev" type="button" aria-label="Previous look">←</button><div class="pn__who"><b id="pn-name"></b><span id="pn-price"></span></div><button class="pn__shop" id="pn-shop" type="button">Shop</button><button class="pn__arrow" id="pn-next" type="button" aria-label="Next look">→</button></div>
    <p class="pn__hint">Tap the dots to see the details</p>`;
  const imgs = $$('.pn__photo img', hero), pins = $('#pn-pins', hero), tip = $('#pn-tip', hero);
  let i = 0, openPin = -1;
  const close = () => { openPin = -1; tip.classList.remove('on'); $$('.pn__pin', hero).forEach((b) => b.classList.remove('is-open')); };
  const draw = () => {
    const p = set[i];
    pins.innerHTML = PINS.slice(0, p.details.length).map((q, k) => `<button class="pn__pin" type="button" data-k="${k}" style="left:${q.x}%;top:${q.y}%;--d:${k * 0.35}s" aria-label="${q.l}: ${p.details[k]}"><i></i></button>`).join('');
    close();
  };
  const showTip = (k) => {
    const q = PINS[k], p = set[i], b = $(`.pn__pin[data-k="${k}"]`, hero); if (!b) return;
    $$('.pn__pin', hero).forEach((n) => n.classList.toggle('is-open', n === b));
    tip.innerHTML = `<small>${q.l}</small><b>${p.details[k]}</b>`; tip.style.left = clamp(q.x, 24, 76) + '%'; tip.style.top = (q.y < 60 ? q.y + 7 : q.y - 17) + '%'; tip.classList.add('on'); openPin = k;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const show = (k) => { i = (k + N) % N; imgs.forEach((m, n) => m.classList.toggle('is-on', n === i)); $('#pn-n', hero).textContent = pad(i + 1); $('#pn-name', hero).textContent = set[i].name; $('#pn-price', hero).textContent = inr(set[i].price); $('#pn-shop', hero).dataset.quick = set[i].id; draw(); };
  S.on(pins, 'click', (e) => { const b = e.target.closest('.pn__pin'); if (!b) return; const k = +b.dataset.k; if (openPin === k) close(); else showTip(k); });
  S.on($('#pn-frame', hero), 'click', (e) => { if (!e.target.closest('.pn__pin, .pn__tip')) close(); });
  S.on($('#pn-next', hero), 'click', () => show(i + 1)); S.on($('#pn-prev', hero), 'click', () => show(i - 1));
  let sx = null; const fr = $('#pn-frame', hero);
  S.on(fr, 'pointerdown', (e) => { sx = e.clientX; }); S.on(fr, 'pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
  S.on(window, 'keydown', (e) => { if (document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  show(0); S.timeout(() => { if (openPin < 0) showTip(0); }, 1600);
  return () => S.clear();
}
