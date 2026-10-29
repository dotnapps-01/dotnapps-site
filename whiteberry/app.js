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
  try { seen = !!sessionStorage.getItem('wb-intro-v2'); } catch (e) {}
  function startSite() {
    if (body.classList.contains('is-ready')) return;
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    try { sessionStorage.setItem('wb-intro-v2', '1'); } catch (e) {}
    setTimeout(() => body.classList.add('is-done'), 1500);
    setTimeout(initReveal, reduce ? 0 : 500);
  }
  setTimeout(startSite, reduce ? 0 : seen ? 250 : 2900);

  /* ─── reveal on scroll ─── */
  function initReveal() {
    const items = $$('[data-reveal],[data-split],.frame');
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

  /* ─── scroll-linked: nav, thread, fab, parallax, scrub, stitch progress ─── */
  const nav = $('#nav');
  const thread = $('.thread');
  const fab = $('.fab');
  const par = $$('[data-parallax]');
  const prog = $$('[data-progress]');
  const scrubs = $$('[data-scrub]').map((el) => ({ el, words: $$('.sc', el) }));
  let ticking = false;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = innerHeight;
    nav.classList.toggle('stuck', y > 40);
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
    }
    scrubs.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.85 - r.top) / (vh * 0.4 + r.height), 0, 1);
      const lit = p * words.length;
      words.forEach((w, i) => { w.style.opacity = (0.15 + 0.85 * clamp(lit - i, 0, 1)).toFixed(2); });
    });
    prog.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--p', clamp((vh * 0.78 - r.top) / (r.height * 0.7), 0, 1).toFixed(3));
      $$('li', el).forEach((li) => {
        const lr = li.getBoundingClientRect();
        li.classList.toggle('lit', lr.top < vh * 0.78);
      });
    });
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

  /* ─── hero: the two photographs drift gently against the cursor ─── */
  if (fine && !reduce) {
    const layers = $$('[data-depth]');
    $('#hero').addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      layers.forEach((l) => {
        const d = parseFloat(l.dataset.depth) * 1000;
        l.style.transform = `translate3d(${(nx * d).toFixed(1)}px,${(ny * d).toFixed(1)}px,0)`;
      });
    });
  }

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
