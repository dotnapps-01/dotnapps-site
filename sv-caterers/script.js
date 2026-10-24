(() => {
  'use strict';

  /* ---- Settings: edit these, nothing else needs to change ---- */
  const CONFIG = {
    whatsapp: '919150099500',        // WhatsApp number with country code, digits only
    bookingEndpoint: '',             // optional: Google Apps Script web-app URL that saves each booking to a Sheet (see README)
    blockedDates: [],                // dates already full, e.g. ['2026-12-05', '2026-12-06']
    leadDays: 1,                     // earliest bookable date = today + this many days
    monthsAhead: 12,                 // how far ahead the calendar goes
    minGuests: 10,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const longDate = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const waLink = text => `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  function openWhatsApp(text) {
    const url = waLink(text);
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;   // popup blocked: go there in this tab
  }

  /* ---- Photos: fall back to the built-in drawing if a photo can't load ---- */
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

  /* ---- Tabs (menu, and booking / quick question) ---- */
  function initTabs(list) {
    const tabs = $$('[role="tab"]', list);
    const select = tab => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        const p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
  }
  $$('[role="tablist"]').forEach(initTabs);

  /* ---- Gallery viewer ---- */
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

  /* =====================  BOOKING  ===================== */
  const form = $('#booking');
  const steps = $$('.step', form);
  const STEP_NAMES = ['Function', 'Date & meals', 'Guests & menu', 'Your details', 'Review'];
  const errEl = $('#err');
  const nextBtn = $('#next');
  const backBtn = $('#back');
  const card = $('.book-card');
  let step = 1;
  let pickedDate = null;                       // 'YYYY-MM-DD'

  /* calendar */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + CONFIG.leadDays);
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + CONFIG.monthsAhead, 1);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const blocked = new Set(CONFIG.blockedDates);
  let view = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  function renderCal() {
    $('#cal-title').textContent = view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const first = view.getDay();
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let html = '<span></span>'.repeat(first);
    for (let d = 1; d <= count; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const key = ymd(date);
      const isFull = blocked.has(key);
      const off = date < minDate || isFull;
      const cls = [isFull ? 'full' : '', key === ymd(today) ? 'today' : ''].filter(Boolean).join(' ');
      html += `<button type="button" data-date="${key}" class="${cls}" ${off ? 'disabled' : ''} aria-pressed="${key === pickedDate}" aria-label="${longDate(date)}${isFull ? ', fully booked' : ''}">${d}</button>`;
    }
    $('#cal-days').innerHTML = html;
    $('#cal-prev').disabled = view <= new Date(minDate.getFullYear(), minDate.getMonth(), 1) || view <= thisMonth;
    $('#cal-next').disabled = view >= maxMonth;
  }
  $('#cal-prev').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  $('#cal-next').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
  $('#cal-days').addEventListener('click', e => {
    const b = e.target.closest('button[data-date]');
    if (!b || b.disabled) return;
    pickedDate = b.dataset.date;
    $('#picked').textContent = `Selected: ${longDate(fromYmd(pickedDate))}`;
    $$('#cal-days button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    clearErr();
  });

  /* guests */
  const guests = $('#guests');
  const syncPresets = () => $$('#presets button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === Number(guests.value))));
  const setGuests = n => { guests.value = Math.max(CONFIG.minGuests, Math.min(10000, Math.round(n))); guests.classList.remove('bad'); syncPresets(); };
  $('#g-minus').addEventListener('click', () => setGuests((Number(guests.value) || 0) - 10));
  $('#g-plus').addEventListener('click', () => setGuests((Number(guests.value) || 0) + 10));
  $('#presets').addEventListener('click', e => { const b = e.target.closest('button[data-n]'); if (b) setGuests(Number(b.dataset.n)); });
  guests.addEventListener('input', syncPresets);
  guests.min = CONFIG.minGuests;

  /* helpers */
  const checked = name => $$(`input[name="${name}"]:checked`, form).map(i => i.value);
  const normPhone = raw => {
    let d = String(raw).replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  };
  const showPhone = d => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  const clearErr = () => { errEl.textContent = ''; $$('.bad', form).forEach(x => x.classList.remove('bad')); };
  const fail = (msg, el) => { errEl.textContent = msg; if (el) { el.classList.add('bad'); el.focus(); } return false; };

  function collect() {
    return {
      event: checked('event')[0] || '',
      date: pickedDate,
      meals: checked('meals'),
      guests: Number(guests.value),
      menu: checked('menu')[0] || '',
      sweets: checked('sweets'),
      name: $('#b-name').value.trim(),
      phone: normPhone($('#b-phone').value),
      area: $('#b-area').value.trim(),
      notes: $('#b-notes').value.trim(),
    };
  }

  function validate(n) {
    clearErr();
    const b = collect();
    if (n === 1 && !b.event) return fail('Please choose the occasion.');
    if (n === 2) {
      if (!b.date) return fail('Please pick a date on the calendar.');
      if (!b.meals.length) return fail('Please choose at least one meal.');
    }
    if (n === 3) {
      if (!(b.guests >= CONFIG.minGuests)) return fail(`Please enter at least ${CONFIG.minGuests} guests.`, guests);
      if (!b.menu) return fail('Please choose a menu style.');
    }
    if (n === 4) {
      if (b.name.length < 2) return fail('Please enter your name.', $('#b-name'));
      if (!b.phone) return fail('Please enter a valid 10-digit mobile number.', $('#b-phone'));
      if (b.area.length < 2) return fail('Please enter the venue or area.', $('#b-area'));
    }
    return true;
  }

  function summaryHtml() {
    const b = collect();
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = [['Function', b.event], ['Date', longDate(fromYmd(b.date))], ['Meals', b.meals.join(', ')], ['Guests', `about ${b.guests}`],
      ['Menu', b.menu + (b.sweets.length ? ` + ${b.sweets.join(', ')}` : '')], ['Venue / area', b.area], ['Name', b.name], ['Mobile', showPhone(b.phone)]];
    if (b.notes) rows.push(['Notes', b.notes]);
    return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  }

  function message(b, ref) {
    return [`Hi SV Caterers! New booking request (Ref ${ref})`,
      `Function: ${b.event}`, `Date: ${longDate(fromYmd(b.date))}`, `Meals: ${b.meals.join(', ')}`, `Guests: about ${b.guests}`,
      `Menu: ${b.menu}${b.sweets.length ? ` + ${b.sweets.join(', ')}` : ''}`, `Venue / area: ${b.area}`,
      `Name: ${b.name}`, `Mobile: ${showPhone(b.phone)}`, b.notes ? `Notes: ${b.notes}` : ''].filter(Boolean).join('\n');
  }

  function makeRef() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return `SVC-${String(today.getFullYear()).slice(2)}${pad(today.getMonth() + 1)}${pad(today.getDate())}-${s}`;
  }

  function goto(n, scroll = true) {
    step = n;
    steps.forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    $('#pstep').textContent = `Step ${n} of 5 · ${STEP_NAMES[n - 1]}`;
    $('#pfill').style.width = `${n * 20}%`;
    backBtn.hidden = n === 1;
    nextBtn.innerHTML = n === 5 ? `${$('.wa-ic', $('#panel-quick')).outerHTML} Send booking request` : (n === 4 ? 'Review' : 'Next');
    if (n === 2) renderCal();
    if (n === 5) $('#summary').innerHTML = summaryHtml();
    clearErr();
    if (!scroll) return;
    const top = card.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * .5) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitBooking() {
    const b = collect();
    const ref = makeRef();
    const payload = { ref, ...b, submitted: new Date().toISOString() };
    if (CONFIG.bookingEndpoint) {
      try {
        await fetch(CONFIG.bookingEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      } catch (_) { /* the WhatsApp message below still carries everything */ }
    }
    const text = message(b, ref);
    $('#done-ref').textContent = ref;
    $('#done-wa').href = waLink(text);
    form.hidden = true;
    $('#done').hidden = false;
    $('#done').focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    openWhatsApp(text);
  }

  const advance = () => {
    if (!validate(step)) return;
    if (step < 5) goto(step + 1); else submitBooking();
  };
  form.addEventListener('submit', e => { e.preventDefault(); advance(); });   // Enter key
  nextBtn.addEventListener('click', advance);
  backBtn.addEventListener('click', () => step > 1 && goto(step - 1));
  form.addEventListener('input', clearErr);
  form.addEventListener('change', clearErr);
  $('#again').addEventListener('click', () => {
    form.reset(); pickedDate = null; $('#picked').textContent = 'No date selected yet.';
    setGuests(100); $('#done').hidden = true; form.hidden = false; goto(1);
  });
  setGuests(100);
  goto(1, false);

  /* quick question → WhatsApp */
  const quick = $('#quick');
  quick.addEventListener('submit', e => {
    e.preventDefault();
    const msg = $('#q-msg').value.trim();
    const name = $('#q-name').value.trim();
    const phone = normPhone($('#q-phone').value);
    if (msg.length < 3) { $('#q-err').textContent = 'Please type your question.'; $('#q-msg').focus(); return; }
    $('#q-err').textContent = '';
    openWhatsApp(`Hi SV Caterers! ${name ? `I'm ${name}${phone ? ` (${showPhone(phone)})` : ''}. ` : ''}${msg}`);
  });

  /* ---- Hero slideshow: real photos, slow zoom, crossfade; pauses when the tab is hidden ---- */
  const hero = $('.hero');
  const slides = $$('.slide', hero);
  const segs = $$('.seg', hero);
  const now = $('.now', hero);
  const SLIDE_MS = 6200;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sIdx = 0;
  let sTimer = null;
  function showSlide(i) {
    sIdx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('on', k === sIdx));
    segs.forEach((g, k) => {
      g.classList.remove('run');
      g.classList.toggle('done', k < sIdx);
      g.setAttribute('aria-current', String(k === sIdx));
    });
    void hero.offsetWidth;                               // restart the progress animation
    if (!reduceMotion) { segs[sIdx].style.setProperty('--dur', `${SLIDE_MS}ms`); segs[sIdx].classList.add('run'); } else { segs[sIdx].classList.add('done'); }
    const s = slides[sIdx];
    $('#now-name').textContent = s.dataset.name;
    $('#now-ta').textContent = s.dataset.ta;
    now.classList.remove('swap'); void now.offsetWidth; now.classList.add('swap');
  }
  const queue = () => { clearTimeout(sTimer); if (!reduceMotion && !document.hidden && heroVisible && !hoverPause) sTimer = setTimeout(() => { showSlide(sIdx + 1); queue(); }, SLIDE_MS); };
  let heroVisible = true;
  let hoverPause = false;
  segs.forEach((g, k) => g.addEventListener('click', () => { showSlide(k); queue(); }));
  if (slides.length) {
    showSlide(0);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(sTimer); else { showSlide(sIdx); queue(); } });
    $('.hero-media', hero).addEventListener('mouseenter', () => { hoverPause = true; clearTimeout(sTimer); segs[sIdx].style.animationPlayState = 'paused'; });
    $('.hero-media', hero).addEventListener('mouseleave', () => { hoverPause = false; segs[sIdx].style.animationPlayState = ''; showSlide(sIdx); queue(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; if (heroVisible) { showSlide(sIdx); queue(); } else clearTimeout(sTimer); }).observe(hero);
    else queue();
    // gentle parallax on larger screens
    const layer = $('.slides', hero);
    if (!reduceMotion && matchMedia('(min-width: 700px)').matches) {
      let ticking = false;
      addEventListener('scroll', () => {
        if (ticking || !heroVisible) return;
        ticking = true;
        requestAnimationFrame(() => { layer.style.transform = `translate3d(0, ${Math.min(scrollY * .1, layer.offsetHeight * .045)}px, 0)`; ticking = false; });
      }, { passive: true });
    }
  }

  /* ---- Bottom bar (phones): after the hero buttons scroll away, hidden at the booking form ---- */
  const dock = $('#dock');
  const heroCta = $('.hero-cta');
  const bookSec = $('#book');
  if (dock && heroCta && 'IntersectionObserver' in window) {
    let pastHero = false, atForm = false;
    const sync = () => dock.classList.toggle('show', pastHero && !atForm);
    new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting && en.boundingClientRect.top < 0; sync(); }).observe(heroCta);
    new IntersectionObserver(([en]) => { atForm = en.isIntersecting; sync(); }, { threshold: .2 }).observe(bookSec);
  } else if (dock) {
    dock.classList.add('show');
  }

  /* ---- Preloader ---- */
  const pre = $('#pre');
  const unlock = () => document.documentElement.classList.remove('pre-lock');
  if (pre) {
    const t0 = performance.now();
    const min = matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2000;
    const finish = () => { pre.classList.add('done'); unlock(); setTimeout(() => pre.remove(), 1200); };
    const wait = () => setTimeout(finish, Math.max(0, min - (performance.now() - t0)));
    if (document.readyState === 'complete') wait(); else window.addEventListener('load', wait, { once: true });
  } else {
    unlock();
  }

  $('#year').textContent = new Date().getFullYear();
})();
