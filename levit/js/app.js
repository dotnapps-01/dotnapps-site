import { PRODUCTS, CATEGORIES, SIZES, inr, byId } from './products.js';
import { garmentSVG, GARMENT_DEFS } from './garments.js';
import { initHeroes } from './heroes/index.js';

/* ───────────────────────── helpers ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

document.body.insertAdjacentHTML('afterbegin', GARMENT_DEFS);

let toastTimer, toastHide;
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label; b.addEventListener('click', () => { action.fn(); closeToast(); }); t.append(b); }
  // a popover lives in the top layer, so the toast (and its Undo) stays above an open bag or quick view
  clearTimeout(toastHide);
  // inside an open dialog the page behind is inert, so the toast moves in there to stay clickable (Undo)
  const host = document.querySelector('dialog[open]') || document.body;
  if (t.parentNode !== host) { try { t.hidePopover(); } catch { /* not open */ } host.append(t); }
  try { if (!t.matches(':popover-open')) t.showPopover(); } catch { /* popover unsupported: falls back to a fixed element */ }
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(closeToast, action ? 5200 : 2600);
}
function closeToast() {
  const t = $('#toast'); t.classList.remove('on');
  toastHide = setTimeout(() => { try { t.hidePopover(); } catch { /* not a popover */ } }, 600);
}

const priceHTML = (p) => `${inr(p.price)}${p.was ? ` <s>${inr(p.was)}</s>` : ''}`;
const FREE_SHIP = 1999, SHIP = 99, COD = 49;

/* ───────────────────────── state ───────────────────────── */
const SIZE_KEY = 'levit.size';
const savedSize = () => { try { const s = localStorage.getItem(SIZE_KEY); return SIZES.includes(s) ? s : null; } catch { return null; } };
const saveSize = (s) => { try { localStorage.setItem(SIZE_KEY, s); } catch { /* storage unavailable */ } };
let view = store.get('levit.view', '2');
let bag = store.get('levit.bag.v1', []).filter((l) => byId(l.id));
let wish = new Set(store.get('levit.wish.v1', []).filter(byId));
let filter = 'all';
let sort = 'featured';
const colorOf = {};              // productId -> selected colour index in the grid

const saveBag = () => store.set('levit.bag.v1', bag);
const saveWish = () => store.set('levit.wish.v1', [...wish]);

/* ───────────────────────── dialogs ───────────────────────── */
const dialogs = {};
$$('dialog').forEach((d) => (dialogs[d.id] = d));
function openDialog(id) {
  const d = dialogs[id];
  if (!d) return;
  $$('dialog[open]').forEach((o) => o !== d && o.id !== 'menu' && o.close());
  if (!d.open) d.showModal();
}
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) {
    const id = open.dataset.open;
    if (id === 'wish') { showSaved(); return; }
    if (id === 'search') { openDialog('search'); setTimeout(() => $('#search-input').focus(), 60); return; }
    if (id === 'bag') renderBag();
    openDialog(id);
    return;
  }
  const quick = e.target.closest('[data-quick]');
  if (quick) { openQuick(quick.dataset.quick); return; }
  const close = e.target.closest('[data-close]');
  if (close) { close.closest('dialog')?.close(); return; }
  if (e.target instanceof HTMLDialogElement) e.target.close();      // backdrop click
});

/* ───────────────────────── index (collections) ───────────────────────── */
function renderIndex() {
  $('#index').innerHTML = CATEGORIES.map((c, i) => {
    const n = PRODUCTS.filter((p) => p.cat === c.id).length;
    return `<li data-reveal style="--d:${i * 0.06}s"><a href="#shop" data-filter="${c.id}" data-cat="${c.id}">
      <span class="index__no">0${i + 1}</span>
      <span class="index__name">${c.name}</span>
      <span class="index__meta"><small>${n} pieces</small><span>${c.blurb}</span></span>
      <svg class="index__arrow" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
    </a></li>`;
  }).join('');
}

/* ───────────────────────── shop ───────────────────────── */
function renderChips() {
  const all = [{ id: 'all', name: 'All' }, ...CATEGORIES];
  if (wish.size) all.push({ id: 'saved', name: 'Saved' });
  $('#chips').innerHTML = all.map((c) => {
    const n = c.id === 'all' ? PRODUCTS.length : c.id === 'saved' ? wish.size : PRODUCTS.filter((p) => p.cat === c.id).length;
    return `<button class="chip" role="tab" data-chip="${c.id}" aria-selected="${filter === c.id}">${c.name}<small>${n}</small></button>`;
  }).join('');
  const on = $('#chips [aria-selected="true"]');
  if (on) { const c = $('#chips'); c.scrollTo({ left: on.offsetLeft - (c.clientWidth - on.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' }); }
}

function visibleProducts() {
  let list = PRODUCTS.filter((p) => filter === 'all' || (filter === 'saved' ? wish.has(p.id) : p.cat === filter));
  if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  if (sort === 'new') list = [...list].sort((a, b) => (b.tag === 'New') - (a.tag === 'New'));
  return list;
}

const heart = '<svg viewBox="0 0 24 24" width="20" height="20" stroke-width="1.5" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg>';

function cardHTML(p, i) {
  const sale = p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
  const tag = p.tag && !(sale && p.tag.startsWith('-')) ? `<span class="card__tag">${p.tag}</span>` : '';
  const cat = CATEGORIES.find((c) => c.id === p.cat)?.name || '';
  return `<article class="card" data-id="${p.id}" data-reveal style="--i:${i % 8}">
    <div class="card__hang">
      <div class="card__stage">
        <button class="card__media" style="--bg:${p.bg}" data-quick="${p.id}" aria-label="${p.name}, ${inr(p.price)}. Open details">
          <img class="card__photo" src="${p.photo}" alt="" loading="lazy" decoding="async">
        </button>
        ${tag}
        <button class="card__wish" aria-pressed="${wish.has(p.id)}" aria-label="Save ${p.name} to wishlist" data-wish="${p.id}">${heart}</button>
        <div class="card__quick" role="group" aria-label="Quick add ${p.name}">${SIZES.map((s) => `<button data-qadd="${p.id}" data-size="${s}" aria-label="Add size ${s} to bag">${s}</button>`).join('')}</div>
        <button class="card__add" data-quick="${p.id}" aria-label="Choose a size for ${p.name}">Add <span aria-hidden="true">+</span></button>
      </div>
      <span class="card__price${sale ? ' is-sale' : ''}" aria-hidden="true">${inr(p.price)}${p.was ? ` <s>${inr(p.was)}</s>` : ''}</span>
    </div>
    <div class="card__meta">
      <h3 class="card__name">${p.name}</h3>
      <p class="card__cat">${cat}${sale ? ` · <b>${sale}% off</b>` : ''}</p>
      <p class="sr">${priceHTML(p)}</p>
    </div>
  </article>`;
}

function renderGrid() {
  const list = visibleProducts();
  const g = $('#grid');
  g.dataset.view = view;
  g.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : `<div class="grid__empty"><p>${filter === 'saved' ? 'Nothing saved yet. Tap the heart on any piece.' : 'Nothing here yet.'}</p><button class="btn btn--ink" type="button" data-chip="all"><span>See everything</span></button></div>`;
  $('#shop-n').textContent = PRODUCTS.length;
  const name = filter === 'all' ? '' : filter === 'saved' ? 'Saved' : CATEGORIES.find((c) => c.id === filter)?.name;
  $('#shop-result').innerHTML = filter === 'all' && sort === 'featured' ? '' : `Showing <b>${list.length}</b> ${list.length === 1 ? 'piece' : 'pieces'}${name ? ` in <b>${name}</b>` : ''}${sort !== 'featured' ? ` · ${$('#sort').selectedOptions[0].textContent.toLowerCase()}` : ''} <button class="link" type="button" data-clear>Clear</button>`;
  $$('#grid [data-reveal]').forEach(observeReveal);
  $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
  renderChips();
}

function setFilter(f, scroll = false) {
  filter = f; renderGrid();
  if (scroll) $('#shop').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
function showSaved() {
  if (!wish.size) { toast('Tap the heart on any piece to save it'); return; }
  setFilter('saved', true);
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-chip]'); if (c) { setFilter(c.dataset.chip); return; }
  if (e.target.closest('[data-clear]')) { sort = 'featured'; $('#sort').value = 'featured'; setFilter('all'); return; }
  const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; store.set('levit.view', view); renderGrid(); }
});
$('#sort').addEventListener('change', (e) => { sort = e.target.value; renderGrid(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-filter]');
  if (a) setFilter(a.dataset.filter);
});

$('#grid').addEventListener('click', (e) => {
  const w = e.target.closest('[data-wish]');
  if (w) { toggleWish(w.dataset.wish, w); return; }
  const q = e.target.closest('[data-qadd]');
  if (q) { saveSize(q.dataset.size); addToBag(q.dataset.qadd, q.dataset.size, colorOf[q.dataset.qadd] ?? 0, 1, { open: false }); }
});

function toggleWish(id, btn) {
  const on = !wish.has(id);
  on ? wish.add(id) : wish.delete(id);
  saveWish(); updateCounts();
  $$(`[data-wish="${id}"]`).forEach((b) => { b.setAttribute('aria-pressed', on); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
  if ($('#q-wish').dataset.id === id) $('#q-wish').setAttribute('aria-pressed', on);
  toast(on ? 'Saved to your wishlist' : 'Removed from wishlist');
  if (filter === 'saved') { if (!wish.size) filter = 'all'; renderGrid(); } else renderChips();
}

/* ───────────────────────── quick view ───────────────────────── */
const Q = { id: null, ci: 0, size: null, shot: 'art' };

function openQuick(id) {
  const p = byId(id);
  if (!p) return;
  Q.id = id; Q.ci = colorOf[id] ?? 0; Q.size = null;
  $('#q-cat').textContent = CATEGORIES.find((c) => c.id === p.cat).name;
  $('#q-name').textContent = p.name;
  const sale = p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
  $('#q-price').innerHTML = `${inr(p.price)}${p.was ? ` <s>${inr(p.was)}</s> <span class="off">−${sale}%</span>` : ''}`;
  $('#q-blurb').textContent = p.blurb;
  $('#q-details').innerHTML = p.details.map((d) => `<li>${d}</li>`).join('');
  $('#q-sizes').innerHTML = SIZES.map((s) => `<button type="button" data-qsize="${s}" aria-pressed="false">${s}</button>`).join('');
  $('#q-err').textContent = '';
  const saved = savedSize();
  if (saved) { Q.size = saved; $$('#q-sizes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.qsize === saved)); $('#q-tip').textContent = `Your saved size: ${saved}`; } else $('#q-tip').textContent = '';
  $('#q-pin-msg').textContent = ''; $('#q-pin-in').value = '';
  const w = $('#q-wish'); w.dataset.id = id; w.setAttribute('aria-pressed', wish.has(id));
  drawQuickColors(); drawQuickMedia(); syncAdd();
  openDialog('quick');
}
function drawQuickColors() {
  const p = byId(Q.id), rest = p.colors.slice(1).map((c) => c.name);
  $('#q-shown').innerHTML = `<i style="--c:${p.colors[0].hex}"></i>Shown in <b>${p.colors[0].name}</b>${rest.length ? ` · also in ${rest.join(', ')}` : ''}`;
}
function syncAdd() {
  const p = byId(Q.id), b = $('#q-add span');
  b.textContent = Q.size ? `Add to bag · ${inr(p.price)}` : 'Select a size';
  $('#q-add').classList.toggle('is-wait', !Q.size);
}
function drawQuickMedia() {
  const p = byId(Q.id);
  $('#q-media').style.setProperty('--bg', p.bg);
  $('#q-media').innerHTML = `<div class="quick__stage"><img src="${p.photo}" alt="${p.name}"></div>`;
}
$('#quick').addEventListener('click', (e) => {
  const s = e.target.closest('[data-qsize]');
  if (s) { Q.size = s.dataset.qsize; saveSize(Q.size); $$('#q-sizes button').forEach((b) => b.setAttribute('aria-pressed', b === s)); $('#q-err').textContent = ''; $('#q-tip').textContent = ''; syncAdd(); return; }
});
$('#q-add').addEventListener('click', () => {
  if (!Q.size) { $('#q-err').textContent = 'Please choose a size first.'; const z = $('#q-sizes'); z.classList.remove('shake'); void z.offsetWidth; z.classList.add('shake'); $('#q-sizes button').focus(); return; }
  colorOf[Q.id] = Q.ci;
  addToBag(Q.id, Q.size, Q.ci, 1, { open: true });
  $('#quick').close();
});
$('#q-wish').addEventListener('click', () => toggleWish(Q.id));
$('#q-pin').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#q-pin-in').value.trim(), m = $('#q-pin-msg');
  m.className = /^[1-9][0-9]{5}$/.test(v) ? 'ok' : 'bad';
  m.textContent = m.className === 'ok' ? `Delivering to ${v}: usually 3 to 7 working days. Cash on delivery available.` : 'Enter a valid 6-digit PIN code.';
});

/* ───────────────────────── bag ───────────────────────── */
function addToBag(id, size, ci, qty = 1, { open = true } = {}) {
  const hit = bag.find((l) => l.id === id && l.size === size && l.ci === ci);
  hit ? (hit.qty += qty) : bag.push({ id, size, ci, qty });
  saveBag(); updateCounts(); renderBag();
  const p = byId(id);
  if (open) openDialog('bag'); else toast(`${p.name} (${size}) added to bag`);
}
const lineTotal = (l) => byId(l.id).price * l.qty;
const subtotal = () => bag.reduce((n, l) => n + lineTotal(l), 0);
const shipping = (sub) => (sub === 0 || sub >= FREE_SHIP ? 0 : SHIP);

function updateCounts() {
  const n = bag.reduce((a, l) => a + l.qty, 0);
  const bc = $('#bag-count'), wc = $('#wish-count');
  const prev = +bc.textContent;
  bc.hidden = !n; bc.textContent = n;
  if (n > prev) { bc.classList.remove('bump'); void bc.offsetWidth; bc.classList.add('bump'); }
  wc.hidden = !wish.size; wc.textContent = wish.size;
  const tb = $('#tab-bag'), tw = $('#tab-wish');
  tb.hidden = !n; tb.textContent = n; tw.hidden = !wish.size; tw.textContent = wish.size;
}

function lineArt(p) { return `<span class="line__art" style="--bg:${p.bg}"><img src="${p.photo}" alt=""></span>`; }

function renderBag() {
  const sub = subtotal(), empty = !bag.length;
  $('#bag-sub').textContent = empty ? '' : `(${bag.reduce((a, l) => a + l.qty, 0)})`;
  $('#lines').hidden = empty; $('#bag-foot').hidden = empty; $('.ship').hidden = empty; $('#bag-empty').hidden = !empty;
  if (empty) $('#empty-art').innerHTML = garmentSVG('knit', { c: '#a8531e' });
  $('#lines').innerHTML = bag.map((l, i) => {
    const p = byId(l.id), c = p.colors[l.ci];
    return `<li class="line">${lineArt(p, l.ci)}
      <div class="line__body">
        <div class="line__top"><span class="line__name">${p.name}</span><span class="price">${inr(lineTotal(l))}</span></div>
        <p class="line__var"><i style="--c:${c.hex}"></i>${c.name} · ${l.size}</p>
        <div class="line__foot">
          <div class="qty"><button data-dec="${i}" aria-label="Decrease quantity">−</button><output aria-live="polite">${l.qty}</output><button data-inc="${i}" aria-label="Increase quantity">+</button></div>
          <button class="line__rm" data-rm="${i}">Remove</button>
        </div></div></li>`;
  }).join('');
  const left = FREE_SHIP - sub;
  $('#ship-msg').innerHTML = left > 0 ? `You're <b>${inr(left)}</b> away from free shipping` : '<b>You\'ve unlocked free shipping</b> ✦';
  $('#ship-fill').parentElement.style.setProperty('--p', Math.min(1, sub / FREE_SHIP));
  $('#sub').textContent = inr(sub);
  $('#shipcost').textContent = shipping(sub) ? inr(SHIP) : 'Free';
  $('#grand').textContent = inr(sub + shipping(sub));
}
$('#lines').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  const undo = (i, l) => toast(`${byId(l.id).name} removed`, { label: 'Undo', fn: () => { bag.splice(i, 0, l); saveBag(); updateCounts(); renderBag(); } });
  if (d.inc !== undefined) bag[+d.inc].qty = Math.min(9, bag[+d.inc].qty + 1);
  else if (d.dec !== undefined) { const l = bag[+d.dec]; if (l.qty > 1) l.qty--; else { const [r] = bag.splice(+d.dec, 1); undo(+d.dec, r); } }
  else if (d.rm !== undefined) { const [r] = bag.splice(+d.rm, 1); undo(+d.rm, r); }
  else return;
  saveBag(); updateCounts(); renderBag();
});

/* ───────────────────────── checkout ───────────────────────── */
function renderCheckoutSummary() {
  const sub = subtotal(), cod = $('input[name="pay"]:checked').value === 'cod';
  $('#co-lines').innerHTML = bag.map((l) => {
    const p = byId(l.id), c = p.colors[l.ci];
    return `<li>${lineArt(p, l.ci)}<span>${p.name}<small>${c.name} · ${l.size} · ×${l.qty}</small></span><b>${inr(lineTotal(l))}</b></li>`;
  }).join('');
  $('#co-sub').textContent = inr(sub);
  $('#co-ship').textContent = shipping(sub) ? inr(SHIP) : 'Free';
  $('#co-cod-row').hidden = !cod;
  $('#co-total').textContent = inr(sub + shipping(sub) + (cod ? COD : 0));
}
$('#checkout-btn').addEventListener('click', () => {
  $('#bag').close();
  $('#co-done').hidden = true;
  renderCheckoutSummary();
  openDialog('checkout');
});
$$('input[name="pay"]').forEach((r) => r.addEventListener('change', renderCheckoutSummary));

$('#co-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  let first = null;
  $$('input[required]', f).forEach((i) => {
    const bad = !i.checkValidity();
    i.classList.toggle('bad', bad);
    i.setAttribute('aria-invalid', bad);
    if (bad && !first) first = i;
  });
  if (first) { first.focus(); toast('Please check the highlighted fields'); return; }
  const btn = $('#co-submit');
  btn.disabled = true; btn.firstElementChild.textContent = 'Placing order…';
  setTimeout(() => {
    $('#done-name').textContent = ', ' + f.name.value.trim().split(' ')[0];
    $('#done-email').textContent = f.email.value.trim();
    $('#done-no').textContent = 'LV-' + Math.floor(100000 + Math.random() * 900000);
    $('#done-art').innerHTML = garmentSVG('knit', { c: '#a8531e' });
    $('#co-done').hidden = false;
    bag = []; saveBag(); updateCounts(); renderBag(); f.reset();
    btn.disabled = false; btn.firstElementChild.textContent = 'Place order';
  }, 900);
});
$$('#co-form input').forEach((i) => i.addEventListener('input', () => i.classList.remove('bad')));

/* ───────────────────────── search ───────────────────────── */
const RECENT_KEY = 'levit.recent.v1';
const recents = () => store.get(RECENT_KEY, []);
function remember(q) { q = q.trim(); if (q.length < 2) return; store.set(RECENT_KEY, [q, ...recents().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 4)); }
function renderSearch(q) {
  const raw = q; q = q.trim().toLowerCase();
  const sug = $('#search-sug');
  sug.hidden = !!q;
  if (!q) {
    const r = recents();
    sug.innerHTML = `${r.length ? `<p>Recent</p><div>${r.map((s) => `<button type="button" data-q="${s}">${s}</button>`).join('')}</div>` : ''}<p>Popular</p><div>${['Dress', 'Kurta', 'Blouse', 'Shirt', 'Jacket', 'Lace'].map((s) => `<button type="button" data-q="${s}">${s}</button>`).join('')}</div>`;
  }
  const list = q ? PRODUCTS.filter((p) => [p.name, p.cat, p.kind, ...p.colors.map((c) => c.name)].join(' ').toLowerCase().includes(q)) : PRODUCTS.filter((p) => p.tag === 'Bestseller' || p.tag === 'New').slice(0, 4);
  $('#search-res').innerHTML = list.length
    ? `${q ? '' : '<li class="searchp__h">Trending now</li>'}${list.map((p) => `<li><button data-quick="${p.id}" data-remember="${raw.trim().replace(/"/g, '')}">${lineArt(p, 0)}<span><b>${p.name}</b><small>${p.cat}</small></span><span class="price">${inr(p.price)}</span></button></li>`).join('')}`
    : '<li class="searchp__none"></li>';
  if (!list.length) $('.searchp__none').textContent = `No matches for “${raw.trim()}”. Try “dress”, “kurta” or “lace”.`;
}
$('#search-sug').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; const i = $('#search-input'); i.value = b.dataset.q; renderSearch(i.value); i.focus(); });
$('#search-res').addEventListener('click', (e) => { const b = e.target.closest('[data-remember]'); if (b && b.dataset.remember) remember(b.dataset.remember); });
$('#search-input').addEventListener('input', (e) => renderSearch(e.target.value));
dialogs.search.addEventListener('close', () => { $('#search-input').value = ''; });
dialogs.search.addEventListener('toggle', () => dialogs.search.open && renderSearch(''));

/* ───────────────────────── newsletter ───────────────────────── */
$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const i = $('#join-email'), m = $('#join-msg');
  if (!i.checkValidity() || !i.value) { m.textContent = 'Please enter a valid email address.'; i.focus(); return; }
  m.textContent = 'Welcome to the list ✦ Your 10% code is on its way.';
  i.value = '';
});

/* ───────────────────────── page chrome ───────────────────────── */
const head = $('#head');
const onScroll = () => head.classList.toggle('is-stuck', scrollY > 8);
const totop = $('#totop');
const onScroll2 = () => { totop.hidden = scrollY < 1400; };
addEventListener('scroll', () => { onScroll(); onScroll2(); }, { passive: true }); onScroll(); onScroll2();
totop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
/* the section in view lights up in the header nav and the tab bar */
const spy = { top: 'home', shop: 'shop', collections: 'shop', story: '', craft: '', boutique: '', join: '' };
const setActive = (id) => {
  $$('.head__nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + id));
  const t = spy[id] ?? ''; $$('#tabbar [data-tab]').forEach((el) => { const on = el.dataset.tab === t; el.classList.toggle('is-on', on); on ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current'); });
};
if ('IntersectionObserver' in window) {
  const secs = ['collections', 'shop', 'story', 'craft', 'boutique', 'join'].map((id) => document.getElementById(id)).filter(Boolean);
  const vis = new Map();
  const so = new IntersectionObserver((es) => { es.forEach((en) => vis.set(en.target.id, en.intersectionRatio)); const best = [...vis.entries()].sort((a, b) => b[1] - a[1])[0]; setActive(best && best[1] > 0.12 ? best[0] : 'top'); }, { threshold: [0, .12, .3, .6] });
  secs.forEach((s) => so.observe(s));
}
setActive('top');
$('#yr').textContent = new Date().getFullYear();

/* reveal on scroll (also drives the count-up numbers) */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      $$('[data-count]', en.target).forEach(countUp);
      io.unobserve(en.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  : null;
function observeReveal(el) { io ? io.observe(el) : el.classList.add('is-in'); }
function countUp(el) {
  const end = +el.dataset.count;
  if (reduced) { el.textContent = end; return; }
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* footer wordmark letters rise in sequence */
$$('.foot__word span').forEach((s, i) => s.style.setProperty('--i', i));
observeReveal($('.foot__word'));

/* image parallax inside the arches */
const par = $$('[data-parallax]');
let parTick = false;
function parallax() {
  parTick = false;
  const vh = innerHeight;
  par.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    const k = (r.top + r.height / 2 - vh / 2) / vh;
    img.style.setProperty('--py', `${(-k * 120 * +img.dataset.parallax * 10).toFixed(1)}px`);
  });
}
if (!reduced) addEventListener('scroll', () => { if (!parTick) { parTick = true; requestAnimationFrame(parallax); } }, { passive: true });

/* magnetic buttons + follower ring — fine pointers only */
if (fine && !reduced) {
  root.classList.add('has-cursor');
  const cur = $('#cursor'), ring = $('span', cur);
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    const t = e.target;
    const drag = false;
    cur.classList.toggle('is-drag', drag);
    cur.classList.toggle('is-link', !drag && !!t.closest?.('a, button, input, select, label, [data-quick]'));
    ring.textContent = drag ? 'Drag' : '';
    cur.classList.remove('is-hide');
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.add('is-hide'));
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  (function loop() {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  })();

  document.addEventListener('pointermove', (e) => {
    const m = e.target.closest?.('[data-magnet]');
    $$('[data-magnet].is-mag').forEach((b) => { if (b !== m) { b.style.translate = ''; b.classList.remove('is-mag'); } });
    if (!m) return;
    const r = m.getBoundingClientRect();
    m.classList.add('is-mag');
    m.style.translate = `${((e.clientX - r.left) / r.width - 0.5) * 14}px ${((e.clientY - r.top) / r.height - 0.5) * 10}px`;
  });

  /* category index: a swinging garment follows the pointer */
  const prev = $('#index-preview');
  let px = 0, py = 0, qx = 0, qy = 0, shown = null, raf = 0;
  const follow = () => {
    qx += (px - qx) * 0.14; qy += (py - qy) * 0.14;
    prev.style.transform = `translate3d(${qx}px, ${qy}px, 0)`;
    if (prev.classList.contains('is-on') || Math.abs(px - qx) > 0.5) raf = requestAnimationFrame(follow); else raf = 0;
  };
  $('#index').addEventListener('pointermove', (e) => {
    const a = e.target.closest('a[data-cat]'); if (!a) return;
    px = e.clientX + 36; py = e.clientY - 150;
    if (shown !== a.dataset.cat) {
      shown = a.dataset.cat;
      const p = PRODUCTS.find((x) => x.cat === shown);
      prev.style.background = p.bg;
      prev.innerHTML = `<img src="${p.photo}" alt="">`;
      prev.classList.remove('is-on'); void prev.offsetWidth;
    }
    prev.classList.add('is-on');
    if (!raf) raf = requestAnimationFrame(follow);
  });
  $('#index').addEventListener('pointerleave', () => { prev.classList.remove('is-on'); shown = null; });
}

/* ───────────────────────── boot ───────────────────────── */
renderIndex(); renderChips(); renderGrid(); renderBag(); updateCounts();
$$('[data-reveal]').forEach(observeReveal);

async function reveal() {
  const seen = root.classList.contains('skip-pre');     // the intro plays once per visit, not on every page load
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, seen ? 600 : 1800))]);
  try { sessionStorage.setItem('levit.seen', '1'); } catch { /* storage unavailable */ }
  setTimeout(() => { root.classList.add('is-ready'); root.dispatchEvent(new Event('ready')); }, reduced || seen ? 0 : 1400);
}
reveal();

/* hero: the swipe-up reel (js/heroes/) */
initHeroes();
document.addEventListener('levit:quick', (e) => openQuick(e.detail));
document.addEventListener('levit:wish', (e) => { if (byId(e.detail) && !wish.has(e.detail)) toggleWish(e.detail); });
