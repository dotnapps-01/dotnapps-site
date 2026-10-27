import { PRODUCTS, CATEGORIES, inr, byId } from '../products.js';
import { $, $$, reduced, pad, scope, onReady } from './util.js';

const TONE = { 'ruby-ruffle-dress': 'ink', 'smocked-bow-top': 'light', 'black-bell-sleeve-kurta': 'ink', 'tissue-dupatta-kurta': 'ink', 'red-polka-midi': 'light', 'lace-crochet-top': 'ink', 'navy-zip-jacket': 'light', 'ruby-cape-dress': 'ink' };

/* A magazine cover. Pages are looks; turning a page flips the cover around its spine to the next one. */
export function mount(hero) {
  hero.className = 'mg';
  hero.innerHTML = `<h1 class="mg__h1">LEVIT AW26: Soft structure, every day.</h1>
    <aside class="mg__left mg__rise">
      <p class="eyebrow"><span class="eyebrow__dot"></span>Issue 01 · AW26</p>
      <p class="mg__lede">The new collection, shot in our own boutique. Turn the page to meet every look.</p>
      <a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <button class="mg__turn" type="button" id="mg-next"><span>Turn the page</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg></button>
    </aside>
    <div class="mg__stage"><div class="mg__book" id="book" role="group" aria-roledescription="carousel" aria-label="Magazine covers"></div></div>
    <nav class="mg__toc mg__rise" aria-label="Inside this issue"><p class="mg__toch">Inside this issue</p><ol id="toc"></ol></nav>`;
  const S = scope(), book = $('#book', hero);
  const looks = Object.keys(TONE).map(byId).filter(Boolean), N = looks.length;
  const cat = (p) => CATEGORIES.find((c) => c.id === p.cat)?.name || '';
  book.innerHTML = looks.map((p, k) => `<div class="mg__page"><div class="mg__face tone-${TONE[p.id]}">
      <img class="mg__img" src="${p.photo}" alt="${p.name}" ${k ? 'loading="lazy" ' : ''}decoding="async">
      <div class="mg__wash"></div><div class="mg__gloss"></div><div class="mg__spine"></div>
      <div class="mg__strip"><span>AW26 · Womenswear</span><span>Issue 01 · No. ${pad(k + 1)}</span></div>
      <div class="mg__mast">LEVIT</div>
      <ul class="mg__lines"><li>Soft structure, <em>every day.</em></li><li>${PRODUCTS.length} pieces<small>shot in our own boutique</small></li></ul>
      <div class="mg__look"><small>${cat(p)} · the look</small><b>${p.name}</b><button type="button" data-quick="${p.id}">Shop inside · ${inr(p.price)}</button></div>
      <div class="mg__code" aria-hidden="true"><i></i>LEVIT AW26</div><div class="mg__corner" aria-hidden="true"></div></div>
      <div class="mg__back" aria-hidden="true"><span>LEVIT</span></div></div>`).join('');
  const pages = $$('.mg__page', book);
  $('#toc', hero).innerHTML = looks.map((p, k) => `<li><button type="button" data-go="${k}"><i>${pad(k + 1)}</i><b>${p.name}</b><span>${inr(p.price)}</span></button></li>`).join('');
  const toc = $$('#toc li', hero);
  const order = looks.map((_, k) => k);
  const wait = (ms) => new Promise((r) => S.timeout(r, reduced ? 0 : ms));
  const z = () => order.forEach((k, pos) => { pages[k].style.zIndex = N - pos; });
  const mark = (k) => toc.forEach((li, m) => li.classList.toggle('is-on', m === k));
  let busy = false, timer = 0, paused = false;
  z(); mark(0);
  async function next() {
    if (busy) return; busy = true;
    const top = pages[order[0]];
    mark(order[1]);
    top.classList.add('is-flipped'); await wait(1400);
    top.classList.add('is-gone'); await wait(300);
    top.classList.add('no-anim'); top.classList.remove('is-flipped', 'is-gone');
    order.push(order.shift()); z(); void top.offsetWidth; top.classList.remove('no-anim');
    busy = false;
  }
  async function prev() {
    if (busy) return; busy = true;
    const last = order[N - 1], pg = pages[last];
    pg.classList.add('no-anim', 'is-flipped'); order.unshift(order.pop()); z(); mark(last);
    void pg.offsetWidth; pg.classList.remove('no-anim', 'is-flipped'); await wait(1400); busy = false;
  }
  const goTo = (t) => { if (busy || t === order[0]) return; order.splice(order.indexOf(t), 1); order.splice(1, 0, t); z(); next(); };
  const arm = () => { clearTimeout(timer); if (!reduced && !paused && !document.hidden) timer = setTimeout(async () => { await next(); arm(); }, 5200); };
  S.add(() => clearTimeout(timer));
  const act = (fn) => { clearTimeout(timer); Promise.resolve(fn()).then(() => { timer = setTimeout(arm, 1500); }); };
  S.on($('#mg-next', hero), 'click', () => act(next));
  S.on($('#toc', hero), 'click', (e) => { const b = e.target.closest('[data-go]'); if (b) act(() => goTo(+b.dataset.go)); });
  let x0 = null;
  S.on(book, 'pointerdown', (e) => { x0 = e.clientX; });
  S.on(book, 'pointerup', (e) => {
    if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
    if (e.target.closest('button')) return;
    if (Math.abs(dx) < 8) act(next); else act(dx < 0 ? next : prev);
  });
  S.on(hero, 'pointerenter', (e) => { if (e.pointerType === 'mouse') { paused = true; clearTimeout(timer); } });
  S.on(hero, 'pointerleave', () => { paused = false; arm(); });
  S.on(document, 'visibilitychange', () => (document.hidden ? clearTimeout(timer) : arm()));
  onReady(() => S.timeout(arm, 600));
  return () => S.clear();
}
