(() => {
  'use strict';

  /* ---- Studio settings: edit these, nothing else needs to change ---- */
  const CONFIG = {
    // WhatsApp number with country code, digits only.
    whatsapp: '919150099500',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  /* ---- Sub-path hosting (see <base> script in index.html) ----
     A <base> makes "#work" and the SVG "#circ" point at a different URL than the
     current page, so resolve those two cases against the page itself. */
  const pageUrl = location.href.split('#')[0];
  if (document.baseURI.split('#')[0] !== pageUrl) {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView();
      history.replaceState(null, '', pageUrl + a.getAttribute('href'));
    });
    const tp = $('textPath');
    if (tp) tp.setAttribute('href', `${location.pathname}${location.search}#circ`);
  }

  /* ---- Header + mobile menu ---- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger');
  const nav = $('#nav');
  const closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

  /* ---- Work filter ---- */
  const tiles = $$('.tile');
  $$('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    tiles.forEach(t => { t.hidden = !(f === 'all' || t.dataset.cat.split(' ').includes(f)); });
  }));

  /* ---- Lightbox ---- */
  const lb = $('#lightbox');
  const lbImg = $('#lb-img');
  const lbCap = $('#lb-cap');
  let current = 0;
  let lastFocus = null;
  const visible = () => tiles.filter(t => !t.hidden);

  function show(i) {
    const list = visible();
    current = (i + list.length) % list.length;
    const t = list[current];
    const img = $('img', t);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = $('figcaption b', t).textContent;
  }
  function openLb(tile) {
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show(visible().indexOf(tile));
    $('.lb-close', lb).focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  tiles.forEach(t => $('.tile-btn', t).addEventListener('click', () => openLb(t)));
  $('.lb-close', lb).addEventListener('click', closeLb);
  $('.lb-prev', lb).addEventListener('click', () => show(current - 1));
  $('.lb-next', lb).addEventListener('click', () => show(current + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
  });

  /* ---- Scroll reveal ---- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    reveals.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  /* ---- Order brief: opens WhatsApp with the message already written ---- */
  const waLink = text => `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  const form = $('#brief');
  const msg = $('#brief-msg');
  const dateInput = $('#f-date');
  dateInput.min = new Date().toISOString().slice(0, 10);

  function buildMessage() {
    const name = $('#f-name').value.trim();
    const what = $('#f-what').value;
    const date = dateInput.value;
    const note = $('#f-note').value.trim();
    let t = `Hi SV Fashions! ${name ? `I'm ${name}. ` : ''}I'd like to enquire about ${what}.`;
    if (date) {
      const d = new Date(date + 'T00:00:00');
      t += ` I need it by ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
    }
    if (note) t += ` ${note}`;
    return t;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const url = waLink(buildMessage());
    msg.textContent = 'Opening WhatsApp…';
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;   // popup blocked: go there in this tab
  });

  /* ---- Preloader ---- */
  const pre = $('#pre');
  const unlock = () => document.documentElement.classList.remove('pre-lock');
  if (pre) {
    const t0 = performance.now();
    const min = matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2500;
    const finish = () => {
      pre.classList.add('done');
      unlock();
      setTimeout(() => pre.remove(), 1200);
    };
    const wait = () => setTimeout(finish, Math.max(0, min - (performance.now() - t0)));
    if (document.readyState === 'complete') wait(); else window.addEventListener('load', wait, { once: true });
  } else {
    unlock();
  }

  $('#year').textContent = new Date().getFullYear();
})();
