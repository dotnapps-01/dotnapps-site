import { inr } from '../products.js';
import { $, $$, reduced, pad, scope, onReady, looks } from './util.js';

/* Venetian blinds: a tall frame made of eight vertical slats. They flip one after another to bring in the next look. */
export function mount(hero) {
  const set = looks(), S = scope(), N = 8, NSL = 9;
  hero.className = 'sl';
  hero.innerHTML = `<div class="sl__copy sl__rise"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1>Soft structure,<br><em>every day.</em></h1><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a></div>
    <div class="sl__frame" id="sl-frame" role="group" aria-roledescription="carousel" aria-label="Looks">${Array.from({ length: NSL }, (_, i) => `<div class="sl__s" style="--i:${i}"><div class="sl__f sl__f--a"><img alt="" draggable="false"></div><div class="sl__f sl__f--b"><img alt="" draggable="false"></div></div>`).join('')}</div>
    <div class="sl__info sl__rise" aria-live="polite"><p class="sl__count"><b id="sl-n">01</b> / ${pad(set.length)}</p><h2 id="sl-name"></h2><p id="sl-price"></p><button class="btn btn--ink" id="sl-shop" type="button"><span>Shop this look</span></button><div class="sl__nav"><button type="button" id="sl-prev" aria-label="Previous look">←</button><button type="button" id="sl-next" aria-label="Next look">→</button></div></div>`;
  const frame = $('#sl-frame', hero), slats = $$('.sl__s', frame);
  let i = 0, busy = false, timer = 0, paused = false;
  const size = () => { const w = frame.clientWidth, sw = w / NSL; frame.style.setProperty('--fw', w + 'px'); frame.style.setProperty('--sw', sw + 'px'); };
  const setFace = (k, which, p) => { const im = $(`.sl__f--${which} img`, slats[k]); im.src = p.photo; im.alt = ''; };
  const label = (p, n) => { $('#sl-n', hero).textContent = pad(n + 1); $('#sl-name', hero).textContent = p.name; $('#sl-price', hero).textContent = inr(p.price); $('#sl-shop', hero).dataset.quick = p.id; };
  slats.forEach((_, k) => { setFace(k, 'a', set[0]); setFace(k, 'b', set[1]); });
  label(set[0], 0); size(); S.on(window, 'resize', size);
  const wait = (ms) => new Promise((r) => S.timeout(r, reduced ? 0 : ms));
  async function go(n) {
    if (busy) return; busy = true;
    n = (n + set.length) % set.length; const p = set[n];
    slats.forEach((_, k) => setFace(k, 'b', p));
    label(p, n);
    frame.classList.add('is-flip'); await wait(900 + NSL * 70);
    slats.forEach((_, k) => setFace(k, 'a', p));
    frame.classList.add('no-anim'); frame.classList.remove('is-flip'); void frame.offsetWidth; frame.classList.remove('no-anim');
    i = n; busy = false;
  }
  const arm = () => { clearTimeout(timer); if (!reduced && !paused && !document.hidden) timer = setTimeout(async () => { await go(i + 1); arm(); }, 4200); };
  S.add(() => clearTimeout(timer));
  const step = async (d) => { clearTimeout(timer); await go(i + d); arm(); };
  S.on($('#sl-next', hero), 'click', () => step(1)); S.on($('#sl-prev', hero), 'click', () => step(-1));
  S.on(frame, 'click', () => step(1));
  S.on(hero, 'pointerenter', (e) => { if (e.pointerType === 'mouse') { paused = true; clearTimeout(timer); } }); S.on(hero, 'pointerleave', () => { paused = false; arm(); });
  S.on(document, 'visibilitychange', () => (document.hidden ? clearTimeout(timer) : arm()));
  onReady(() => { hero.classList.add('is-in'); S.timeout(arm, 800); });
  return () => S.clear();
}
