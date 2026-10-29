/* Whiteberry — interactions & motion. No dependencies. */
(() => {
  'use strict';

  /* ─── Fill these in to switch the enquiry form + contact list on ───
     whatsapp: country code + number, digits only  e.g. '919876543210'
     instagram: handle without @                   e.g. 'whiteberry'
     email / address: plain text                                          */
  const CONFIG = { whatsapp: '', instagram: '', email: '', address: '' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const body = document.body;
  const root = document.documentElement;

  /* ─── split text into words (headlines rise; the statement brightens) ─── */
  function split(el, cls, wrap) {
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.append(' '); return; }
            const inner = document.createElement('span');
            inner.className = cls;
            inner.textContent = t;
            if (wrap) {
              inner.style.setProperty('--i', i++);
              const w = document.createElement('span');
              w.className = 'w';
              w.append(inner);
              frag.append(w);
            } else frag.append(inner);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
  }
  $$('[data-split]').forEach((el) => split(el, 'wi', true));
  $$('[data-scrub]').forEach((el) => split(el, 'sc', false));

  /* ─── intro veil, then everything reveals ─── */
  let seen = false;
  try { seen = !!sessionStorage.getItem('wb-intro-v3'); } catch (e) {}
  function startSite() {
    if (body.classList.contains('is-ready')) return;
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    try { sessionStorage.setItem('wb-intro-v3', '1'); } catch (e) {}
    setTimeout(() => body.classList.add('is-done'), 1500);
    setTimeout(initReveal, reduce ? 0 : 500);
    setTimeout(countUp, reduce ? 0 : 1200);
  }
  setTimeout(startSite, reduce ? 0 : seen ? 250 : 2900);

  /* ─── reveal on scroll ─── */
  function initReveal() {
    const items = $$('[data-reveal],[data-split],.frame,.fin');
    if (!('IntersectionObserver' in window)) { items.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    items.forEach((e) => io.observe(e));
  }

  /* ─── hero numbers count up ─── */
  function countUp() {
    $$('[data-to]').forEach((el) => {
      const to = +el.dataset.to;
      if (reduce) { el.textContent = to; return; }
      const t0 = performance.now(), dur = 1700;
      (function step(t) {
        const p = clamp((t - t0) / dur, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ─── scroll-linked: nav, thread, fab, parallax, scrub, atelier, wall ─── */
  const nav = $('#nav');
  const thread = $('.thread');
  const fab = $('.fab');
  const par = $$('[data-parallax]');
  const scrubs = $$('[data-scrub]').map((el) => ({ el, words: $$('.sc', el) }));
  const wall = $('#wall');
  const cols = $$('.wcol');
  const steps = $$('.step');
  const atlImgs = $$('#atlStage img');
  const atlCap = $('#atlCap');
  const caps = ['N° I — Fabric & print', 'N° II — Your measure', 'N° III — Stitched & finished', 'N° IV — Worn with joy'];
  let curStep = 0;
  let ticking = false;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = innerHeight;
    nav.classList.toggle('stuck', y > 60);
    const max = root.scrollHeight - vh;
    thread.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    fab.classList.toggle('show', y > vh * 0.8);

    if (!reduce) {
      par.forEach((img) => {
        const box = img.parentElement.getBoundingClientRect();
        if (box.bottom < -60 || box.top > vh + 60) return;
        const p = clamp((box.top + box.height) / (vh + box.height), 0, 1);
        const extra = Math.max(0, img.offsetHeight - box.height);
        img.style.setProperty('--py', (-(1 - p) * extra).toFixed(1) + 'px');
      });
      if (wall) {
        const r = wall.getBoundingClientRect();
        if (r.bottom > -200 && r.top < vh + 200) {
          const p = clamp((vh / 2 - (r.top + r.height / 2)) / (r.height / 2 + vh / 2), -1, 1);
          cols.forEach((c) => { c.style.transform = `translate3d(0,${(p * parseFloat(c.dataset.speed)).toFixed(1)}px,0)`; });
        }
      }
    }
    scrubs.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.85 - r.top) / (vh * 0.4 + r.height), 0, 1);
      const lit = p * words.length;
      words.forEach((w, i) => { w.style.opacity = (0.15 + 0.85 * clamp(lit - i, 0, 1)).toFixed(2); });
    });
    if (steps.length) {
      let best = 0, bd = 1e9;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - vh * 0.5);
        if (d < bd) { bd = d; best = i; }
      });
      if (best !== curStep) {
        curStep = best;
        steps.forEach((s, i) => s.classList.toggle('is-on', i === best));
        atlImgs.forEach((m, i) => m.classList.toggle('on', i === best));
        atlCap.textContent = caps[best];
      }
    }
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  onScroll();

  /* ─── mobile menu ─── */
  const burger = $('#burger');
  const menu = $('#navmenu');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ─── hero: the three arches drift at different depths with the cursor ─── */
  if (fine && !reduce) {
    const layers = $$('[data-depth]');
    $('#hero').addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      layers.forEach((l) => {
        const d = parseFloat(l.dataset.depth) * 1000;
        l.style.transform = `translate3d(${(nx * d).toFixed(1)}px,${(ny * d * 0.6).toFixed(1)}px,0)`;
      });
    });
  }

  /* ─── gold dust rising through the hero ─── */
  (function sparkles() {
    const cv = $('#sparkles');
    if (!cv || reduce) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, parts = [], visible = true, t = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const make = (init) => ({
      x: rnd(0, w), y: init ? rnd(0, h) : h + rnd(5, 40),
      s: rnd(0.8, 2.6), vy: rnd(0.12, 0.5), ph: rnd(0, 6.28), sw: rnd(0.5, 1.3),
      star: Math.random() < 0.22, a: rnd(0.35, 0.9)
    });
    const size = () => {
      const r = cv.parentElement.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: clamp(Math.round(w / 22), 24, 70) }, () => make(true));
    };
    (function frame() {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      t++;
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p, i) => {
        p.y -= p.vy; p.x += Math.sin(t * 0.01 * p.sw + p.ph) * 0.25;
        if (p.y < -20) parts[i] = make(false);
        const a = p.a * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.03 * p.sw + p.ph)));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#E8D49A';
        if (p.star) {
          const s = p.s * 3.2;
          ctx.save(); ctx.translate(p.x, p.y); ctx.beginPath();
          ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.restore();
        } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
      });
    })();
    size();
    addEventListener('resize', size);
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv.parentElement);
  })();

  /* ─── collections: the list drives one large photograph ─── */
  (function collections() {
    const rows = $$('.coll-row');
    const imgs = $$('#collStage img');
    if (!rows.length) return;
    let cur = 0, timer = null, hovering = false;
    const show = (i) => {
      cur = i;
      rows.forEach((r, k) => r.classList.toggle('is-on', k === i));
      imgs.forEach((m, k) => m.classList.toggle('on', k === i));
    };
    rows.forEach((r, i) => {
      r.addEventListener('pointerenter', () => { if (fine) { hovering = true; show(i); } });
      r.addEventListener('pointerleave', () => { hovering = false; });
      r.addEventListener('focus', () => show(i));
      r.addEventListener('click', () => show(i));
    });
    if (!reduce) {
      const list = $('#collList');
      const tick = () => { if (!hovering && !document.hidden) show((cur + 1) % rows.length); };
      new IntersectionObserver((e) => {
        clearInterval(timer);
        if (e[0].isIntersecting) timer = setInterval(tick, 5200);
      }, { threshold: 0.35 }).observe(list);
      list.addEventListener('pointerdown', () => clearInterval(timer));
    }
  })();

  /* ─── weaves & prints carousel: arrows, drag, progress ─── */
  (function carousel() {
    const car = $('#car');
    if (!car) return;
    const bar = $('#carBar').parentElement;
    const step = () => ($('.wv', car).getBoundingClientRect().width + 32);
    const upd = () => {
      const max = car.scrollWidth - car.clientWidth;
      bar.style.setProperty('--bx', ((max > 0 ? car.scrollLeft / max : 0) * 300).toFixed(1) + '%');
    };
    car.addEventListener('scroll', upd, { passive: true });
    $('#carNext').addEventListener('click', () => car.scrollBy({ left: step(), behavior: 'smooth' }));
    $('#carPrev').addEventListener('click', () => car.scrollBy({ left: -step(), behavior: 'smooth' }));
    car.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') car.scrollBy({ left: step(), behavior: 'smooth' });
      if (e.key === 'ArrowLeft') car.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    let down = false, sx = 0, sl = 0;
    car.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; sx = e.clientX; sl = car.scrollLeft; car.classList.add('drag');
    });
    addEventListener('pointermove', (e) => { if (down) car.scrollLeft = sl - (e.clientX - sx); });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false; car.classList.remove('drag');
      const s = step(); // settle on the nearest card
      car.scrollTo({ left: Math.round(car.scrollLeft / s) * s, behavior: 'smooth' });
    });
    upd();
  })();

  /* ─── lookbook: filter by type (tabs) and by colour (swatches) ─── */
  const sws = $$('.sw');
  const tabs = $$('.tab');
  const pieces = $$('.piece');
  const note = $('#filterNote');
  const state = { cat: 'all', colour: 'all' };

  tabs.forEach((t) => {
    const n = t.dataset.cat === 'all' ? pieces.length : pieces.filter((p) => p.dataset.cat === t.dataset.cat).length;
    $('[data-count]', t).textContent = n;
  });

  function applyFilter(animate) {
    let shown = 0;
    pieces.forEach((p) => {
      const inCat = state.cat === 'all' || p.dataset.cat === state.cat;
      const inCol = state.colour === 'all' || p.dataset.colors.split(' ').includes(state.colour);
      const was = p.classList.contains('gone');
      p.classList.toggle('gone', !inCat);
      p.classList.toggle('dim', inCat && !inCol);
      if (inCat) {
        shown++;
        p.classList.add('in');
        $$('.frame', p).forEach((f) => f.classList.add('in'));
        if (animate && was) { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
      }
    });
    const lit = pieces.filter((p) => !p.classList.contains('gone') && !p.classList.contains('dim')).length;
    note.textContent = state.colour === 'all' ? '' :
      lit ? `${lit} of ${shown} pieces in ${$('span', $('.sw.is-on')).textContent.toLowerCase()}` :
        'Nothing in this colour here yet — ask us, we can make it.';
  }
  function setCat(cat, animate = true) {
    state.cat = cat;
    tabs.forEach((t) => { const on = t.dataset.cat === cat; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
    applyFilter(animate);
  }
  tabs.forEach((t) => t.addEventListener('click', () => setCat(t.dataset.cat)));
  sws.forEach((sw) => sw.addEventListener('click', () => {
    state.colour = sw.dataset.filter;
    sws.forEach((s) => s.classList.toggle('is-on', s === sw));
    applyFilter(false);
  }));
  $$('#collections a[data-cat]').forEach((a) => a.addEventListener('click', () => setCat(a.dataset.cat)));

  // enquiry form: the piece list comes straight from the lookbook
  (function fillPieces() {
    const sel = $('#f-piece');
    const custom = sel.lastElementChild;
    pieces.forEach((p) => {
      const o = document.createElement('option');
      o.textContent = $('h3', p).textContent;
      sel.insertBefore(o, custom);
    });
  })();

  /* ─── occasions: a photograph follows the cursor ─── */
  (function occasions() {
    const list = $('#occ');
    const prev = $('#occPreview');
    if (!list || !prev || !fine || reduce) return;
    const img = $('img', prev);
    let x = 0, y = 0, tx = 0, ty = 0, on = false;
    list.addEventListener('pointerover', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      if (img.getAttribute('src') !== li.dataset.img) img.src = li.dataset.img;
      if (!on) { x = tx = e.clientX; y = ty = e.clientY; }
      on = true; prev.classList.add('on');
    });
    list.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    list.addEventListener('pointerleave', () => { on = false; prev.classList.remove('on'); });
    (function loop() {
      requestAnimationFrame(loop);
      if (!on) return;
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      prev.style.transform = `translate3d(${(x + 40).toFixed(1)}px,${(y - 150).toFixed(1)}px,0)`;
    })();
  })();

  /* ─── enquiry buttons prefill the form ─── */
  const form = $('#enquiry');
  const fNote = $('#formNote');
  const selectValue = (sel, val) => {
    if (!val) return;
    const o = [...sel.options].find((o) => o.textContent.trim() === val.trim());
    if (o) sel.value = o.value || o.textContent;
  };
  $$('[data-enquire]').forEach((el) => el.addEventListener('click', (e) => {
    selectValue($('#f-piece'), el.dataset.enquire);
    selectValue($('#f-occ'), el.dataset.occasion);
    if (el.tagName === 'BUTTON') {
      e.preventDefault();
      $('#contact').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
  }));

  /* ─── contact details from CONFIG ─── */
  (function contact() {
    let any = false;
    $$('[data-cfg]').forEach((li) => {
      const v = CONFIG[li.dataset.cfg];
      if (!v) { li.hidden = true; return; }
      any = true;
      const a = $('[data-cfg-link]', li);
      const b = $('[data-cfg-text]', li);
      if (b) b.textContent = v;
      if (!a) return;
      const k = li.dataset.cfg;
      if (k === 'whatsapp') { a.href = 'https://wa.me/' + v.replace(/\D/g, ''); a.textContent = '+' + v.replace(/\D/g, ''); }
      if (k === 'instagram') { a.href = 'https://instagram.com/' + v; a.textContent = '@' + v; }
      if (k === 'email') { a.href = 'mailto:' + v; a.textContent = v; }
    });
    if (!any) $('.contact-list').hidden = true;
  })();

  /* ─── enquiry form → WhatsApp (or email) ─── */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.name || !d.name.trim()) {
      fNote.textContent = 'Please tell us your name so we can say hello.';
      $('#f-name').focus();
      return;
    }
    const msg = [
      `Hello Whiteberry! I'm ${d.name.trim()}.`,
      d.occasion && `Occasion: ${d.occasion}`,
      d.piece && `Piece: ${d.piece}`,
      d.message && `Notes: ${d.message.trim()}`,
      d.phone && `Phone: ${d.phone.trim()}`
    ].filter(Boolean).join('\n');
    if (CONFIG.whatsapp) {
      open('https://wa.me/' + CONFIG.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      fNote.textContent = 'Opening WhatsApp — we’ll be in touch soon.';
    } else if (CONFIG.email) {
      location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Whiteberry enquiry') + '&body=' + encodeURIComponent(msg);
      fNote.textContent = 'Opening your email app…';
    } else {
      fNote.textContent = 'Enquiry form is ready — add the WhatsApp number in app.js (CONFIG) to start receiving messages.';
    }
  });

  $('#yr').textContent = new Date().getFullYear();
})();
