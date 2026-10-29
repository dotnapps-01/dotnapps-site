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

  /* ─── split headings into words for the mask-rise reveal ─── */
  function split(el) {
    const label = el.textContent.trim();
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', i++);
            wi.textContent = t;
            w.append(wi);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
  }
  $$('[data-split]').forEach(split);

  /* ─── intro curtain, then everything reveals ─── */
  let seen = false;
  try { seen = !!sessionStorage.getItem('wb-intro'); } catch (e) {}
  function startSite() {
    if (body.classList.contains('is-ready')) return;
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    try { sessionStorage.setItem('wb-intro', '1'); } catch (e) {}
    setTimeout(() => body.classList.add('is-done'), 1400);
    setTimeout(initReveal, reduce ? 0 : 450);
  }
  setTimeout(startSite, reduce ? 0 : seen ? 250 : 3000);

  /* ─── reveal on scroll ─── */
  function initReveal() {
    const items = $$('[data-reveal],[data-split],[data-reveal-frame]');
    if (!('IntersectionObserver' in window)) { items.forEach((e) => e.classList.add('in')); return; }
    // A fully clipped element never "intersects", so frames are watched through their parent.
    const targets = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        (targets.get(en.target) || []).forEach((el) => el.classList.add('in'));
        io.unobserve(en.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    items.forEach((e) => {
      const t = e.hasAttribute('data-reveal-frame') ? e.parentElement : e;
      targets.set(t, [...(targets.get(t) || []), e]);
    });
    targets.forEach((_, t) => io.observe(t));
  }

  /* ─── scroll-linked: nav, thread, fab, parallax, stitch progress ─── */
  const nav = $('#nav');
  const thread = $('.thread');
  const fab = $('.fab');
  const par = $$('[data-parallax]');
  const prog = $$('[data-progress]');
  let ticking = false;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = innerHeight;
    nav.classList.toggle('stuck', y > 40);
    const max = root.scrollHeight - vh;
    thread.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    fab.classList.toggle('show', y > vh * 0.75);

    if (!reduce) {
      par.forEach((img) => {
        const box = img.parentElement.getBoundingClientRect();
        if (box.bottom < -50 || box.top > vh + 50) return;
        const p = clamp((box.top + box.height) / (vh + box.height), 0, 1);
        const extra = Math.max(0, img.offsetHeight - box.height);
        img.style.setProperty('--py', (-(1 - p) * extra).toFixed(1) + 'px');
      });
    }
    prog.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--p', clamp((vh * 0.62 - r.top) / r.height, 0, 1).toFixed(3));
      $$('li', el).forEach((li) => {
        const lr = li.getBoundingClientRect();
        li.classList.toggle('in', lr.top < vh * 0.62);
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

  /* ─── hero: mouse parallax between the layered arches ─── */
  const heroArt = $('#heroArt');
  if (heroArt && fine && !reduce) {
    const layers = $$('.layer', heroArt);
    $('#hero').addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      layers.forEach((l) => {
        const d = parseFloat(l.dataset.depth) * 1000;
        l.style.transform = `translate3d(${(nx * d).toFixed(1)}px,${(ny * d).toFixed(1)}px,0)`;
      });
    });
  }

  /* ─── 3D tilt on cards, magnetic buttons, trailing ring cursor ─── */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${(px * 7).toFixed(2)}deg) rotateX(${(-py * 7).toFixed(2)}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('.btn--solid,.btn--line').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
        b.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });

    const cur = $('.cursor');
    let cx = 0, cy = 0, tx = 0, ty = 0;
    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      cur.classList.add('on');
      cur.classList.toggle('big', !!e.target.closest('a,button,select,[data-tilt]'));
    }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('on'));
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ─── falling jasmine, rose petals & gold sparkles in the hero ─── */
  (function petals() {
    const cv = $('#petals');
    if (!cv || reduce) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, parts = [], visible = true, t = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);

    const make = (initial) => {
      const k = Math.random();
      const type = k < 0.55 ? 0 : k < 0.8 ? 1 : 2;
      return {
        type, x: rnd(0, w), y: initial ? rnd(-20, h) : rnd(-50, -10),
        s: type === 2 ? rnd(4, 9) : rnd(9, 17), r: rnd(0, 6.28), vr: rnd(-0.02, 0.02),
        vy: rnd(0.25, 0.75), ph: rnd(0, 6.28), sw: rnd(0.5, 1.2), a: rnd(0.6, 0.95)
      };
    };
    const size = () => {
      const r = cv.parentElement.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round(w / 48), 12, 30);
      parts = Array.from({ length: n }, () => make(true));
    };
    const petal = (p) => {
      const flip = Math.cos(t * 0.02 * p.sw + p.ph);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(Math.max(0.25, Math.abs(flip)), 1);
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.moveTo(0, -p.s);
      ctx.bezierCurveTo(p.s * 0.95, -p.s * 0.5, p.s * 0.7, p.s * 0.75, 0, p.s);
      ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.75, -p.s * 0.95, -p.s * 0.5, 0, -p.s);
      if (p.type === 0) {
        ctx.shadowColor = 'rgba(20,33,148,.3)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(20,33,148,.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      } else {
        ctx.fillStyle = p.s % 2 > 1 ? 'rgba(226,100,142,.8)' : 'rgba(247,226,113,.95)'; ctx.fill();
      }
      ctx.restore();
    };
    const spark = (p) => {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.03 * p.sw + p.ph));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r * 0.3);
      ctx.globalAlpha = a * p.a;
      ctx.fillStyle = '#E3B505';
      const s = p.s * (0.6 + 0.4 * a);
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.fill();
      ctx.restore();
    };
    (function frame() {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      t++;
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p, i) => {
        p.y += p.vy; p.x += Math.sin(t * 0.012 * p.sw + p.ph) * 0.7; p.r += p.vr;
        if (p.y > h + 24) parts[i] = make(false);
        p.type === 2 ? spark(p) : petal(p);
      });
    })();
    size();
    addEventListener('resize', size);
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv.parentElement);
  })();

  /* ─── lookbook: filter by type (tabs) and by colour (swatches) ─── */
  const sws = $$('.sw');
  const tabs = $$('.tab');
  const pieces = $$('.piece');
  const note = $('#filterNote');
  const state = { cat: 'all', colour: 'all' };
  const labelOf = (el) => $('span', el).textContent;

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
        if (animate && was) { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
      }
    });
    const lit = pieces.filter((p) => !p.classList.contains('gone') && !p.classList.contains('dim')).length;
    note.textContent = state.colour === 'all' ? '' :
      lit ? `${lit} of ${shown} pieces in ${labelOf($('.sw.is-on')).toLowerCase()}` : 'Nothing in this colour here yet — ask us, we can make it.';
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
  // collection cards jump to the lookbook with that type selected
  $$('#collections [data-cat]').forEach((a) => a.addEventListener('click', () => setCat(a.dataset.cat)));

  // enquiry form: piece list comes straight from the lookbook
  (function fillPieces() {
    const sel = $('#f-piece');
    const custom = sel.lastElementChild;
    pieces.forEach((p) => {
      const o = document.createElement('option');
      o.textContent = $('h3', p).textContent;
      sel.insertBefore(o, custom);
    });
  })();

  /* ─── occasions: a floating arch preview follows the cursor ─── */
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
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      const tilt = clamp((tx - x) * 0.12, -10, 10);
      prev.style.transform = `translate3d(${(x + 36).toFixed(1)}px,${(y - 150).toFixed(1)}px,0) rotate(${tilt.toFixed(1)}deg)`;
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
