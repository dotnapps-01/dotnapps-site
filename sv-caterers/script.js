(() => {
  'use strict';

  const CONFIG = {
    // WhatsApp number with country code, digits only.
    whatsapp: '919150099500',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---- Photos: fall back to the built-in illustration if a photo can't load ---- */
  const fallback = img => {
    if (img.dataset.fb && !img.dataset.fbDone) { img.dataset.fbDone = '1'; img.src = img.dataset.fb; }
  };
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') fallback(e.target); }, true);
  $$('img[data-fb]').forEach(i => { if (i.complete && i.naturalWidth === 0) fallback(i); });

  /* ---- Mobile menu ---- */
  const burger = $('.burger');
  const nav = $('#nav');
  const closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

  /* ---- Menu tabs ---- */
  const tabs = $$('[role="tab"]');
  const panels = $$('[role="tabpanel"]');
  function selectTab(tab) {
    tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    panels.forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); selectTab(n);
    });
  });

  /* ---- Lightbox ---- */
  const tiles = $$('.tile');
  const lb = $('#lightbox');
  const lbImg = $('#lb-img');
  const lbCap = $('#lb-cap');
  let current = 0;
  let lastFocus = null;
  function show(i) {
    current = (i + tiles.length) % tiles.length;
    const t = tiles[current];
    const img = $('img', t);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = $('figcaption', t).textContent;
  }
  function openLb(i) {
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    show(i);
    $('.lb-close', lb).focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  tiles.forEach((t, i) => $('.tile-btn', t).addEventListener('click', () => openLb(i)));
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
  let x0 = null;
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---- Scroll reveal ---- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    reveals.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  /* ---- Enquiry form: opens WhatsApp with the message already written ---- */
  const waLink = text => `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  const form = $('#brief');
  const msg = $('#brief-msg');
  const dateInput = $('#f-date');
  dateInput.min = new Date().toISOString().slice(0, 10);

  function buildMessage() {
    const name = $('#f-name').value.trim();
    const event = $('#f-event').value;
    const date = dateInput.value;
    const guests = $('#f-guests').value.trim();
    const area = $('#f-area').value.trim();
    const note = $('#f-note').value.trim();
    let t = `Hi SV Caterers! ${name ? `I'm ${name}. ` : ''}I'd like to enquire about catering for ${event}.`;
    if (date) {
      const d = new Date(date + 'T00:00:00');
      t += ` The date is ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
    }
    if (guests) t += ` About ${guests} guests.`;
    if (area) t += ` Venue / area: ${area}.`;
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

  /* ---- Bottom order bar (phones): only once the hero buttons are out of view, and not over the form ---- */
  const dock = $('#dock');
  const heroCta = $('.hero-cta');
  const enquire = $('#enquire');
  if (dock && heroCta && 'IntersectionObserver' in window) {
    let pastHero = false, atForm = false;
    const sync = () => dock.classList.toggle('show', pastHero && !atForm);
    new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting && en.boundingClientRect.top < 0; sync(); }).observe(heroCta);
    new IntersectionObserver(([en]) => { atForm = en.isIntersecting; sync(); }, { threshold: .25 }).observe(enquire);
  } else if (dock) {
    dock.classList.add('show');
  }

  /* ---- Preloader ---- */
  const pre = $('#pre');
  const unlock = () => document.documentElement.classList.remove('pre-lock');
  if (pre) {
    const t0 = performance.now();
    const min = matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 1900;
    const finish = () => { pre.classList.add('done'); unlock(); setTimeout(() => pre.remove(), 1200); };
    const wait = () => setTimeout(finish, Math.max(0, min - (performance.now() - t0)));
    if (document.readyState === 'complete') wait(); else window.addEventListener('load', wait, { once: true });
  } else {
    unlock();
  }

  $('#year').textContent = new Date().getFullYear();
})();
