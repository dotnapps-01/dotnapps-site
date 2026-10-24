(() => {
  'use strict';

  /* ---- Studio settings: edit these, nothing else needs to change ---- */
  const CONFIG = {
    instagram: 'sv_fashions._',
    // WhatsApp number with country code, digits only (e.g. '919876543210').
    // Leave empty to hide every WhatsApp button until the client shares one.
    whatsapp: '',
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

  /* ---- Language (English / Tamil) ---- */
  const i18n = $$('[data-ta]');
  const phs = $$('[data-ta-ph]');
  i18n.forEach(el => { el.dataset.en = el.innerHTML; });
  phs.forEach(el => { el.dataset.enPh = el.placeholder; });

  function setLang(lang) {
    const ta = lang === 'ta';
    document.documentElement.lang = ta ? 'ta' : 'en';
    i18n.forEach(el => { el.innerHTML = ta ? el.dataset.ta : el.dataset.en; });
    phs.forEach(el => { el.placeholder = ta ? el.dataset.taPh : el.dataset.enPh; });
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    store.set('sv-lang', lang);
  }
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  if (store.get('sv-lang') === 'ta') setLang('ta');

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

  /* ---- WhatsApp (only when a number is configured) ---- */
  const wa = CONFIG.whatsapp.replace(/\D/g, '');
  const waLink = text => `https://wa.me/${wa}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  if (wa) {
    $('#send-wa').hidden = false;
    $('#dock-wa').hidden = false;
    $('#dock-wa').href = waLink('Hi SV Fashions! I would like to place an order.');
    const line = $('[data-wa-line]');
    line.hidden = false;
    const num = $('#wa-num');
    num.href = waLink('');
    num.textContent = `+${wa}`;
  }

  /* ---- Order brief: writes the DM for the customer ---- */
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

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = buildMessage();
    const ok = await copy(text);
    const ta = document.documentElement.lang === 'ta';
    msg.textContent = ok
      ? (ta ? 'செய்தி நகலெடுக்கப்பட்டது — Instagram DM-இல் ஒட்டி அனுப்புங்கள்.' : 'Message copied — paste it into the Instagram DM and send.')
      : (ta ? 'தயவுசெய்து செய்தியை நகலெடுத்து DM-இல் அனுப்புங்கள்: ' : 'Please copy this message into the DM: ') + text;
    window.open(`https://ig.me/m/${CONFIG.instagram}`, '_blank', 'noopener');
  });
  if (wa) {
    const waBtn = $('#send-wa');
    ['input', 'change'].forEach(ev => form.addEventListener(ev, () => { waBtn.href = waLink(buildMessage()); }));
    waBtn.href = waLink(buildMessage());
  }

  $('#year').textContent = new Date().getFullYear();
})();
