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

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

const priceHTML = (p) => `${inr(p.price)}${p.was ? ` <s>${inr(p.was)}</s>` : ''}`;
const FREE_SHIP = 1999, SHIP = 99, COD = 49;

/* ───────────────────────── state ───────────────────────── */
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
  const ci = colorOf[p.id] ?? 0;
  const sale = p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
  const tag = p.tag ? `<span class="card__tag ${sale && p.tag.startsWith('-') ? 'card__tag--sale' : ''}">${p.tag}</span>` : '';
  return `<article class="card${p.real ? ' card--real' : ''}" data-id="${p.id}" data-reveal style="--i:${i % 8}">
    <div class="card__stage">
    <button class="card__media" style="--bg:${p.bg}" data-quick="${p.id}" aria-label="Quick view — ${p.name}">
      ${p.photo ? `<img class="card__photo" src="${p.photo}" alt="" loading="lazy" decoding="async">` : ''}
    </button>
    ${tag}
    <button class="card__wish" aria-pressed="${wish.has(p.id)}" aria-label="Save ${p.name} to wishlist" data-wish="${p.id}">${heart}</button>
    <div class="card__quick" role="group" aria-label="Quick add ${p.name}">${SIZES.map((s) => `<button data-qadd="${p.id}" data-size="${s}" aria-label="Add size ${s} to bag">${s}</button>`).join('')}</div>
    <button class="card__add" data-quick="${p.id}" aria-label="Quick add ${p.name}">+</button>
    </div>
    <div class="card__meta">
      <h3 class="card__name">${p.name}</h3>
      <p class="price">${priceHTML(p)}</p>
    </div>
  </article>`;
}

function renderGrid() {
  const list = visibleProducts();
  $('#grid').innerHTML = list.length
    ? list.map(cardHTML).join('')
    : `<p class="grid__empty">Nothing saved yet — tap the heart on any piece.</p>`;
  $('#shop-n').textContent = list.length;
  $$('#grid [data-reveal]').forEach(observeReveal);
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

$('#chips').addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) setFilter(c.dataset.chip); });
$('#sort').addEventListener('change', (e) => { sort = e.target.value; renderGrid(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-filter]');
  if (a) setFilter(a.dataset.filter);
});

$('#grid').addEventListener('click', (e) => {
  const w = e.target.closest('[data-wish]');
  if (w) { toggleWish(w.dataset.wish, w); return; }
  const q = e.target.closest('[data-qadd]');
  if (q) { addToBag(q.dataset.qadd, q.dataset.size, colorOf[q.dataset.qadd] ?? 0, 1, { open: false }); }
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
  let saved = null; try { saved = localStorage.getItem('levit.size'); } catch { /* storage unavailable */ }
  if (saved && SIZES.includes(saved)) { Q.size = saved; $$('#q-sizes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.qsize === saved)); }
  const w = $('#q-wish'); w.dataset.id = id; w.setAttribute('aria-pressed', wish.has(id));
  drawQuickColors(); drawQuickMedia();
  openDialog('quick');
}
function drawQuickColors() {
  const p = byId(Q.id);
  $('#q-colors').innerHTML = p.colors.map((c, k) => `<button type="button" style="--c:${c.hex}" data-qcolor="${k}" aria-label="${c.name}" aria-pressed="${k === Q.ci}"></button>`).join('');
  $('#q-colorname').textContent = p.colors[Q.ci].name;
}
function drawQuickMedia() {
  const p = byId(Q.id);
  $('#q-media').style.setProperty('--bg', p.bg);
  $('#q-media').innerHTML = `<div class="quick__stage"><img src="${p.photo}" alt="${p.name}"></div>`;
}
$('#quick').addEventListener('click', (e) => {
  const c = e.target.closest('[data-qcolor]');
  if (c) { Q.ci = +c.dataset.qcolor; drawQuickColors(); return; }
  const s = e.target.closest('[data-qsize]');
  if (s) { Q.size = s.dataset.qsize; $$('#q-sizes button').forEach((b) => b.setAttribute('aria-pressed', b === s)); $('#q-err').textContent = ''; return; }
});
$('#q-add').addEventListener('click', () => {
  if (!Q.size) { $('#q-err').textContent = 'Please choose a size.'; $('#q-sizes button').focus(); return; }
  colorOf[Q.id] = Q.ci;
  addToBag(Q.id, Q.size, Q.ci, 1, { open: true });
  $('#quick').close();
});
$('#q-wish').addEventListener('click', () => toggleWish(Q.id));

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
  if (d.inc !== undefined) bag[+d.inc].qty = Math.min(9, bag[+d.inc].qty + 1);
  else if (d.dec !== undefined) { const l = bag[+d.dec]; l.qty > 1 ? l.qty-- : bag.splice(+d.dec, 1); }
  else if (d.rm !== undefined) bag.splice(+d.rm, 1);
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
function renderSearch(q) {
  q = q.trim().toLowerCase();
  const list = q ? PRODUCTS.filter((p) => [p.name, p.cat, p.kind, ...p.colors.map((c) => c.name)].join(' ').toLowerCase().includes(q)) : PRODUCTS.filter((p) => p.tag === 'Bestseller' || p.tag === 'New');
  $('#search-res').innerHTML = list.length
    ? list.map((p) => `<li><button data-quick="${p.id}">${lineArt(p, 0)}<span><b>${p.name}</b><small>${p.cat}</small></span><span class="price">${inr(p.price)}</span></button></li>`).join('')
    : '<li class="searchp__none"></li>';
  if (!list.length) $('.searchp__none').textContent = `No matches for “${q}”. Try “knit”, “dress” or “rust”.`;
}
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
addEventListener('scroll', onScroll, { passive: true }); onScroll();
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
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1800))]);
  setTimeout(() => { root.classList.add('is-ready'); root.dispatchEvent(new Event('ready')); }, reduced ? 0 : 1400);
}
reveal();

/* hero: eight styles to try, switched with the pill at the bottom of the page (js/heroes/) */
initHeroes();
document.addEventListener('levit:quick', (e) => openQuick(e.detail));
document.addEventListener('levit:toast', (e) => toast(e.detail));
