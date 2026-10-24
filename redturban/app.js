/* ==========================================================================
   The Red Turban — site behaviour. No dependencies, no build step.

   ▸ To go live, fill in CONFIG below (WhatsApp number / email).
   ▸ RATES is a SAMPLE rate card for the budget estimator — replace with real
     numbers before launch (or delete the estimator's "Indicative" copy).
   ▸ Concept boards in EXPERIENCES are illustrative art; swap in real event
     photos by adding an `img` field (see renderTiles).
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- CONFIG ---------- */
  const CONFIG = {
    whatsapp: '',   // digits only with country code, e.g. '919876543210'
    email: '',      // e.g. 'hello@redturbanevents.com'
    brand: 'The Red Turban',
  };

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => (s ? new Date(s + 'T00:00:00') : null);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const fmtDate = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const trimZeros = s => s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  const inr = n => {
    if (n >= 1e7) return '₹' + trimZeros((n / 1e7).toFixed(2)) + ' Cr';
    if (n >= 1e5) return '₹' + trimZeros((n / 1e5).toFixed(1)) + ' L';
    return '₹' + Math.round(n / 1000) + 'K';
  };
  const scrollToId = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); };

  /* ---------- shared data ---------- */
  const TYPES = [
    { id: 'wedding', label: 'Wedding', hint: 'Muhurtham, rituals & celebration' },
    { id: 'reception', label: 'Reception', hint: 'The grand evening' },
    { id: 'corporate', label: 'Corporate', hint: 'Launches, annual days, offsites' },
    { id: 'birthday', label: 'Birthday', hint: 'First birthdays to big milestones' },
    { id: 'family', label: 'Family function', hint: 'Half-saree, baby shower, housewarming' },
  ];
  const STYLES = [
    { id: 'indoor', label: 'Hall / indoor' },
    { id: 'outdoor', label: 'Lawn / outdoor' },
    { id: 'destination', label: 'Destination' },
  ];
  const ADDONS = [
    { id: 'entry', label: 'Traditional entry' },
    { id: 'decor', label: 'Stage & décor' },
    { id: 'photo', label: 'Photo & film' },
    { id: 'music', label: 'DJ / live music' },
    { id: 'stay', label: 'Guest stay' },
    { id: 'invites', label: 'Invitations & gifting' },
  ];
  const SLOTS = [{ id: 'Morning', label: 'Morning' }, { id: 'Afternoon', label: 'Afternoon' }, { id: 'Evening', label: 'Evening' }];
  const label = (list, id) => (list.find(x => x.id === id) || {}).label || id;

  /* SAMPLE rate card (₹). Replace with real figures. */
  const RATES = {
    types: {
      wedding:   { base: 150000, perGuest: 900 },
      reception: { base: 100000, perGuest: 800 },
      corporate: { base: 90000,  perGuest: 700 },
      birthday:  { base: 30000,  perGuest: 450 },
      family:    { base: 40000,  perGuest: 500 },
    },
    style: { indoor: 1, outdoor: 1.15, destination: 1.5 },
    addons: {
      entry:   { flat: 35000 },
      decor:   { flat: 50000, perGuest: 220 },
      photo:   { flat: 60000 },
      music:   { flat: 35000 },
      stay:    { perGuest: 350 },
      invites: { flat: 8000, perGuest: 60 },
    },
    low: 0.88, high: 1.2,
  };

  /* ---------- brief (single source of truth shared by every tool) ---------- */
  const DEFAULT_BRIEF = {
    type: 'wedding', guests: 300, style: 'indoor', addons: ['decor', 'photo'],
    date: '', city: '', budget: '', pkg: '', inspo: '', notes: '', name: '', phone: '', email: '', slot: '',
  };
  let brief = Object.assign({}, DEFAULT_BRIEF, store.get('rt_brief', {}));
  if (!TYPES.some(t => t.id === brief.type)) brief.type = DEFAULT_BRIEF.type;
  if (!STYLES.some(t => t.id === brief.style)) brief.style = DEFAULT_BRIEF.style;
  brief.guests = clamp(parseInt(brief.guests, 10) || DEFAULT_BRIEF.guests, 10, 5000);
  brief.addons = Array.isArray(brief.addons) ? brief.addons.filter(a => ADDONS.some(x => x.id === a)) : [];
  const listeners = [];
  function setBrief(patch, source) {
    brief = Object.assign({}, brief, patch);
    store.set('rt_brief', brief);
    listeners.forEach(fn => fn(brief, source));
  }

  /* ---------- reusable pill group ---------- */
  function pillGroup(el, name, items, kind, onChange) {
    el.innerHTML = items.map(it =>
      `<label class="pill${kind === 'checkbox' ? ' multi-pill' : ''}"><input type="${kind}" name="${name}" value="${esc(it.id)}"><span>${esc(it.label)}</span></label>`
    ).join('');
    el.addEventListener('change', () => {
      const vals = $$('input:checked', el).map(i => i.value);
      onChange(kind === 'radio' ? vals[0] : vals);
    });
    return {
      set(v) { $$('input', el).forEach(i => { i.checked = Array.isArray(v) ? v.includes(i.value) : i.value === v; }); },
    };
  }

  /* ==========================================================================
     Chrome: theme, language, nav, progress, reveal, intro
     ========================================================================== */
  const raw = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } } };

  $('#theme-btn').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    raw.set('rt_theme', next);
  });

  /* Language: English / தமிழ். English copy is read from the DOM, so it is never duplicated. */
  const TA = {
    'nav.services': 'சேவைகள்', 'nav.exp': 'அனுபவங்கள்', 'nav.plan': 'திட்டமிடல்', 'nav.packages': 'தொகுப்புகள்',
    'nav.process': 'வழிமுறை', 'nav.faq': 'கேள்விகள்', 'nav.cta': 'திட்டமிடுங்கள்',
    'hero.eyebrow': 'நிகழ்வு மேலாண்மை · தமிழ்நாடு & இந்தியா முழுவதும்',
    'hero.title': 'மகுடத்துக்குரிய <em>கொண்டாட்டங்கள்</em>.',
    'hero.sub': 'குதிரை ரதத்துடன் மணமகன் வரவேற்பு முதல் நிறுவனக் கூட்டங்கள் வரை — ஒவ்வொரு நிகழ்வையும் தி ரெட் டர்பன் திட்டமிட்டு, அலங்கரித்து, அழகாக நடத்தி முடிக்கிறது.',
    'hero.cta1': 'நிகழ்வை திட்டமிடுங்கள்', 'hero.cta2': 'செலவு மதிப்பீடு',
    'about.eyebrow': 'எங்கள் எண்ணம்', 'about.title': 'டர்பன் என்பது ஒரு வாக்குறுதி.',
    'about.p': 'இந்தியப் பாரம்பரியத்தில் தலைப்பாகை மரியாதையின் அடையாளம். அதே மரியாதையுடன் ஒவ்வொரு விருந்தினரையும் வரவேற்று, உங்களை நிகழ்வின் நாயகனாக உணர வைப்பதே எங்கள் வேலை.',
    'svc.eyebrow': 'எங்கள் சேவைகள்', 'svc.title': 'ஒவ்வொரு கொண்டாட்டத்திற்கும் ஒரே குழு.',
    'svc.sub': 'ஒரு சேவை போதுமா, முழு நிகழ்வையும் ஒப்படைக்கவா — முதல் யோசனை முதல் கடைசி விருந்தினர் விடைபெறும் வரை.',
    'exp.eyebrow': 'கருத்து வடிவங்கள்', 'exp.title': 'கற்பனை தொடங்கும் இடம்.',
    'exp.sub': 'உங்கள் கொண்டாட்டம் எப்படி இருக்கலாம் என்பதற்கான சில கருத்துப் பலகைகள். பிடித்ததைத் தேர்ந்தெடுங்கள்; உங்களைச் சுற்றி அதை உருவாக்குவோம்.',
    'plan.eyebrow': 'இப்போதே திட்டமிடுங்கள்', 'plan.title': 'எங்களை அழைக்கும் முன்பே உங்கள் திட்டத்தை வடிவமையுங்கள்.',
    'plan.sub': 'உங்கள் விருந்தினர் எண்ணிக்கைக்கான மதிப்பீட்டையும், நிகழ்வு நாள் வரையிலான மாதவாரி பட்டியலையும் பாருங்கள்.',
    'pkg.eyebrow': 'தொகுப்புகள்', 'pkg.title': 'உங்களுக்கு ஏற்ற அளவு பராமரிப்பைத் தேர்ந்தெடுங்கள்.',
    'pkg.sub': 'ஒவ்வொரு தொகுப்பும் தனித்தனியாக வடிவமைக்கப்படும்; இவை தொடக்கப் புள்ளிகள் மட்டுமே.',
    'proc.eyebrow': 'எங்கள் வழிமுறை', 'proc.title': 'முதல் யோசனை முதல் கடைசி விடைபெறல் வரை.',
    'reach.title': 'நாங்கள் கொண்டாடும் இடங்கள்',
    'faq.eyebrow': 'நல்ல கேள்விகள்', 'faq.title': 'நீங்கள் கேட்கும் முன்பே.',
    'enq.eyebrow': 'தொடங்கலாம்', 'enq.title': 'உங்கள் கொண்டாட்டத்தைப் பற்றிச் சொல்லுங்கள்.',
    'enq.sub': 'நான்கு சிறிய படிகள். படிவக் கடிதம் அல்ல, யோசனைகளுடன் பதில் தருவோம்.',
  };
  const i18nEls = $$('[data-i18n], [data-i18n-html]').map(el => {
    const isHtml = el.hasAttribute('data-i18n-html');
    const key = el.getAttribute(isHtml ? 'data-i18n-html' : 'data-i18n');
    return { el, key, isHtml, en: isHtml ? el.innerHTML : el.textContent };
  });
  function applyLang(lang) {
    html.setAttribute('lang', lang);
    i18nEls.forEach(({ el, key, isHtml, en }) => {
      const v = lang === 'ta' && TA[key] ? TA[key] : en;
      if (isHtml) el.innerHTML = v; else el.textContent = v;
    });
    $('#lang-btn').setAttribute('aria-label', lang === 'ta' ? 'Switch language to English' : 'Switch language to Tamil');
    requestAnimationFrame(positionInk);
  }
  $('#lang-btn').addEventListener('click', () => {
    const next = html.getAttribute('lang') === 'ta' ? 'en' : 'ta';
    raw.set('rt_lang', next);
    applyLang(next);
  });
  if (raw.get('rt_lang') === 'ta') applyLang('ta');

  /* Nav */
  const nav = $('#nav'), links = $('#nav-links'), burger = $('#burger');
  function setMenu(open) {
    links.classList.toggle('is-open', open);
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
  links.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('is-open')) setMenu(false); });
  matchMedia('(min-width: 921px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  const navMap = new Map($$('a', links).map(a => [a.getAttribute('href').slice(1), a]));
  const sectionIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navMap.forEach(a => a.classList.remove('is-on'));
      const a = navMap.get(en.target.id); if (a) a.classList.add('is-on');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navMap.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionIO.observe(s); });

  /* Scroll-driven: progress bar, sticky nav, process line, mobile CTA bar */
  const bar = $('#progress'), steps = $('#steps'), mbar = $('#mbar');
  let enquireVisible = false, ticking = false;
  function onScroll() {
    const y = scrollY, h = html.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? clamp(y / h, 0, 1) : 0})`;
    nav.classList.toggle('is-stuck', y > 10);
    if (steps) {
      const r = steps.getBoundingClientRect();
      steps.style.setProperty('--prog', clamp((innerHeight * 0.75 - r.top) / Math.max(r.height, 1), 0, 1).toFixed(3));
    }
    mbar.classList.toggle('is-hidden', y < 500 || enquireVisible);
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  new IntersectionObserver(([e]) => { enquireVisible = e.isIntersecting; onScroll(); }, { threshold: 0.15 }).observe($('#enquire'));
  onScroll();

  /* Reveal on scroll, staggered by sibling order */
  $$('.reveal').forEach(el => {
    const sibs = $$(':scope > .reveal', el.parentElement);
    el.style.setProperty('--rd', (Math.max(0, sibs.indexOf(el)) % 6) * 0.08 + 's');
  });
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* Intro (first visit per session) */
  if (html.classList.contains('intro-play')) {
    try { sessionStorage.setItem('rt_intro', '1'); } catch (e) { /* noop */ }
    setTimeout(() => { const i = $('#intro'); if (i) i.remove(); }, 3100);
  }

  /* Hero pointer parallax (fine pointers only) */
  const heroArt = $('#hero-art');
  if (heroArt && !reduce && matchMedia('(pointer: fine)').matches) {
    const layers = $$('[data-depth]', heroArt);
    const hero = heroArt.closest('.hero');
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(l => { const d = +l.dataset.depth; l.style.transform = `translate(${(nx * d).toFixed(1)}px, ${(ny * d).toFixed(1)}px)`; });
    });
    hero.addEventListener('pointerleave', () => layers.forEach(l => { l.style.transform = ''; }));
  }

  $('#year').textContent = new Date().getFullYear();

  /* ==========================================================================
     Experiences: filterable concept boards + lightbox
     ========================================================================== */
  const EXPERIENCES = [
    { id: 'baraat', cat: 'traditional', catLabel: 'Traditional', title: 'The Royal Baraat', event: 'wedding', c: ['#6E0A19', '#E4152C'], motif: 'mandala', tall: true,
      text: 'A horse-chariot arrival with nadaswaram and melam, a marigold-lined route and a welcome arch that makes the whole street turn around.', tags: ['Horse chariot', 'Nadaswaram & melam', 'Welcome arch', 'Pyro entry'] },
    { id: 'lanterns', cat: 'weddings', catLabel: 'Weddings', title: 'Sangeet Under Lanterns', event: 'wedding', c: ['#2B1740', '#B03A6B'], motif: 'lanterns',
      text: 'Hundreds of hanging lanterns, a live band and a dance floor that never empties — an evening staged for the family’s big performance.', tags: ['Stage & lighting', 'Live band', 'Performance slots'] },
    { id: 'marigold', cat: 'weddings', catLabel: 'Weddings', title: 'Haldi in Marigold', event: 'wedding', c: ['#B85C00', '#F2B01E'], motif: 'marigold', wide: true,
      text: 'A sun-soaked morning of turmeric, marigold swings and laughter, styled so every candid photograph glows.', tags: ['Floral styling', 'Swing & props', 'Photo corners'] },
    { id: 'annual', cat: 'corporate', catLabel: 'Corporate', title: 'Annual Day, Reimagined', event: 'corporate', c: ['#0F2236', '#2F6F95'], motif: 'lines',
      text: 'A branded evening with a crisp run-of-show, stage production, awards and entertainment — and nobody checking their watch.', tags: ['Stage production', 'Awards', 'Entertainment', 'AV'] },
    { id: 'palki', cat: 'traditional', catLabel: 'Traditional', title: 'Palki & Doli Welcome', event: 'wedding', c: ['#4D0F2A', '#C2185B'], motif: 'arches',
      text: 'A bride’s arrival by palki or doli, carried to the sound of live music and showered with petals.', tags: ['Palki / doli', 'Live music', 'Petal showers'] },
    { id: 'garden', cat: 'family', catLabel: 'Family', title: 'First Birthday Garden', event: 'birthday', c: ['#1D5638', '#86BF7C'], motif: 'balloons',
      text: 'Pastel balloons, little-guest activity corners and a cake moment framed for the family album.', tags: ['Theme décor', 'Activity corners', 'Cake setup'] },
    { id: 'gold', cat: 'weddings', catLabel: 'Weddings', title: 'Reception in Gold', event: 'reception', c: ['#33260A', '#C9A24B'], motif: 'mandala',
      text: 'A grand evening of warm gold lighting, a statement stage and a seamless flow from welcome to dinner.', tags: ['Stage design', 'Lighting', 'Guest flow'] },
    { id: 'hills', cat: 'corporate', catLabel: 'Corporate', title: 'Offsite in the Hills', event: 'corporate', c: ['#1F3B2D', '#6D9461'], motif: 'lines',
      text: 'Two days away from desks: travel, stay, team-building and a campfire evening, handled end to end.', tags: ['Travel & stay', 'Team-building', 'Evening programme'] },
    { id: 'halfsaree', cat: 'family', catLabel: 'Family', title: 'Half-Saree Ceremony', event: 'family', c: ['#4A1450', '#D1558F'], motif: 'arches',
      text: 'A traditional ceremony styled with silk drapes, floral arches and a thoughtful flow for elders and guests.', tags: ['Silk & floral styling', 'Ritual flow', 'Photography'] },
  ];
  const FILTERS = [{ id: 'all', label: 'All' }, { id: 'weddings', label: 'Weddings' }, { id: 'traditional', label: 'Traditional' }, { id: 'corporate', label: 'Corporate' }, { id: 'family', label: 'Family' }];

  function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function motifSVG(kind, id) {
    const r = rng([...id].reduce((s, ch) => s + ch.charCodeAt(0), 7));
    let g = '';
    if (kind === 'mandala') {
      for (let i = 0; i < 16; i++) g += `<ellipse cx="100" cy="46" rx="9" ry="34" transform="rotate(${i * 22.5} 100 100)"/>`;
      g += '<circle cx="100" cy="100" r="22"/><circle cx="100" cy="100" r="60"/><circle cx="100" cy="100" r="94"/><circle cx="100" cy="100" r="8" fill="#fff" fill-opacity=".25"/>';
    } else if (kind === 'lanterns') {
      for (let i = 0; i < 8; i++) { const x = 14 + i * 25, len = 30 + ((i * 37) % 5) * 22; g += `<line x1="${x}" y1="-4" x2="${x}" y2="${len}"/><ellipse cx="${x}" cy="${len + 14}" rx="10" ry="15" fill="#fff" fill-opacity=".22"/><path d="M${x - 6} ${len + 14}h12"/>`; }
    } else if (kind === 'marigold') {
      for (let k = 0; k < 7; k++) { const cx = 20 + r() * 160, cy = 20 + r() * 160, s = 10 + r() * 14; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g += `<circle cx="${(cx + Math.cos(a) * s).toFixed(1)}" cy="${(cy + Math.sin(a) * s).toFixed(1)}" r="${(s * 0.55).toFixed(1)}" fill="#fff" fill-opacity=".1"/>`; } g += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(s * 0.4).toFixed(1)}" fill="#fff" fill-opacity=".25"/>`; }
    } else if (kind === 'lines') {
      for (let i = 0; i < 14; i++) g += `<line x1="${-40 + i * 22}" y1="0" x2="${i * 22 + 60}" y2="200"/>`;
      for (let i = 0; i < 6; i++) g += `<circle cx="${20 + r() * 160}" cy="${20 + r() * 160}" r="${4 + r() * 6}" fill="#fff" fill-opacity=".3"/>`;
    } else if (kind === 'arches') {
      [86, 68, 50, 32, 14].forEach(w => { g += `<path d="M${100 - w} 215V${112} A${w} ${w} 0 0 1 ${100 + w} 112V215"/>`; });
    } else if (kind === 'balloons') {
      for (let i = 0; i < 9; i++) { const x = 15 + r() * 170, y = 20 + r() * 110, s = 14 + r() * 10; g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${s.toFixed(1)}" ry="${(s * 1.2).toFixed(1)}" fill="#fff" fill-opacity=".16"/><path d="M${x.toFixed(1)} ${(y + s * 1.2).toFixed(1)}q-6 30 4 60"/>`; }
    }
    return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="1.2" aria-hidden="true">${g}</svg>`;
  }
  const artHTML = e => `<span class="tile-art" style="--c1:${e.c[0]};--c2:${e.c[1]}">${e.img ? `<img src="${esc(e.img)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : motifSVG(e.motif, e.id)}</span>`;

  const filtersEl = $('#exp-filters'), gridEl = $('#exp-grid');
  let activeFilter = 'all';
  filtersEl.innerHTML = FILTERS.map(f => `<button class="filter" type="button" data-f="${f.id}" aria-pressed="${f.id === 'all'}">${f.label}</button>`).join('');
  filtersEl.addEventListener('click', e => {
    const b = e.target.closest('.filter'); if (!b) return;
    activeFilter = b.dataset.f;
    $$('.filter', filtersEl).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderTiles();
  });
  const visibleExp = () => EXPERIENCES.filter(e => activeFilter === 'all' || e.cat === activeFilter);
  function renderTiles() {
    gridEl.innerHTML = visibleExp().map((e, i) => `
      <button class="tile" type="button" data-id="${e.id}" style="--c1:${e.c[0]};--c2:${e.c[1]};animation-delay:${i * 0.05}s">
        ${artHTML(e)}
        <span class="tile-body"><span class="tile-cat">${esc(e.catLabel)}</span><span class="tile-title">${esc(e.title)}</span><span class="tile-more">View concept →</span></span>
      </button>`).join('');
  }
  renderTiles();

  const lb = $('#lightbox');
  let lbIndex = 0;
  function openLB(id) {
    const list = visibleExp(); lbIndex = Math.max(0, list.findIndex(e => e.id === id));
    fillLB(list[lbIndex]);
    if (!lb.open) lb.showModal();
  }
  function fillLB(e) {
    $('#lb-art').innerHTML = artHTML(e);
    $('#lb-cat').textContent = e.catLabel;
    $('#lb-title').textContent = e.title;
    $('#lb-text').textContent = e.text;
    $('#lb-tags').innerHTML = e.tags.map(t => `<li>${esc(t)}</li>`).join('');
    lb.dataset.id = e.id;
  }
  function stepLB(d) { const list = visibleExp(); lbIndex = (lbIndex + d + list.length) % list.length; fillLB(list[lbIndex]); }
  gridEl.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) openLB(t.dataset.id); });
  $('#lb-prev').addEventListener('click', () => stepLB(-1));
  $('#lb-next').addEventListener('click', () => stepLB(1));
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') stepLB(-1); if (e.key === 'ArrowRight') stepLB(1); });
  $('#lb-plan').addEventListener('click', () => {
    const e = EXPERIENCES.find(x => x.id === lb.dataset.id);
    lb.close();
    setBrief({ type: e.event, inspo: e.title }, 'lb');
    wiz.goto(1); scrollToId('enquire');
  });

  /* ==========================================================================
     Tabs
     ========================================================================== */
  const tabs = $$('.tab'), ink = $('.tab-ink');
  function positionInk() {
    const on = $('.tab.is-on'); if (!on || !ink) return;
    ink.style.width = on.offsetWidth + 'px';
    ink.style.transform = `translateX(${on.offsetLeft - ink.parentElement.clientLeft - 4.8}px)`;
  }
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    positionInk(); if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length], true);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
  });
  addEventListener('resize', positionInk);
  addEventListener('load', positionInk);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionInk);
  positionInk();

  /* ==========================================================================
     Budget estimator
     ========================================================================== */
  const est = (() => {
    const guestsEl = $('#est-guests'), outEl = $('#est-guests-out'), rangeEl = $('#est-range'), perEl = $('#est-per'), barsEl = $('#est-bars');
    const types = pillGroup($('#est-types'), 'e-type', TYPES, 'radio', v => setBrief({ type: v }, 'est'));
    const style = pillGroup($('#est-style'), 'e-style', STYLES, 'radio', v => setBrief({ style: v }, 'est'));
    const addons = pillGroup($('#est-addons'), 'e-addons', ADDONS, 'checkbox', v => setBrief({ addons: v }, 'est'));
    guestsEl.addEventListener('input', () => setBrief({ guests: +guestsEl.value }, 'est'));
    $('#est-go').addEventListener('click', () => { wiz.goto(2); scrollToId('enquire'); });

    function compute(b) {
      const t = RATES.types[b.type], g = b.guests, m = RATES.style[b.style] || 1;
      const parts = [
        { k: 'Planning & coordination', v: t.base * m },
        { k: 'On-ground team & logistics', v: t.perGuest * g * m },
      ];
      b.addons.forEach(id => { const a = RATES.addons[id]; parts.push({ k: label(ADDONS, id), v: ((a.flat || 0) + (a.perGuest || 0) * g) * m }); });
      const mid = parts.reduce((s, p) => s + p.v, 0);
      const round5k = n => Math.round(n / 5000) * 5000;
      return { parts, lo: round5k(mid * RATES.low), hi: round5k(mid * RATES.high) };
    }

    let shown = { lo: 0, hi: 0 }, raf = 0;
    function tween(to) {
      cancelAnimationFrame(raf);
      const from = { ...shown }, t0 = performance.now(), dur = reduce ? 0 : 450;
      const step = now => {
        const p = dur ? clamp((now - t0) / dur, 0, 1) : 1, e = 1 - Math.pow(1 - p, 3);
        shown = { lo: from.lo + (to.lo - from.lo) * e, hi: from.hi + (to.hi - from.hi) * e };
        rangeEl.textContent = `${inr(shown.lo)} – ${inr(shown.hi)}`;
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    const barEls = new Map();
    function renderBars(parts) {
      const sorted = parts.slice().sort((a, b) => b.v - a.v);
      const top = sorted.slice(0, 5), rest = sorted.slice(5);
      if (rest.length) top.push({ k: 'Everything else', v: rest.reduce((s, p) => s + p.v, 0) });
      const max = Math.max(...top.map(p => p.v)), seen = new Set();
      top.forEach(p => {
        let li = barEls.get(p.k);
        if (!li) { li = document.createElement('li'); li.innerHTML = '<span></span><b></b><i></i>'; barEls.set(p.k, li); }
        li.children[0].textContent = p.k; li.children[1].textContent = inr(p.v);
        li.children[2].style.setProperty('--w', (p.v / max * 100).toFixed(1) + '%');
        barsEl.appendChild(li); seen.add(p.k);
      });
      barEls.forEach((li, k) => { if (!seen.has(k)) { li.remove(); barEls.delete(k); } });
    }

    function sync(b) {
      types.set(b.type); style.set(b.style); addons.set(b.addons);
      if (+guestsEl.value !== b.guests) guestsEl.value = b.guests;
      outEl.textContent = b.guests.toLocaleString('en-IN');
      guestsEl.style.setProperty('--pct', ((clamp(b.guests, 20, 2000) - 20) / 1980 * 100).toFixed(1) + '%');
      const r = compute(b);
      tween(r);
      perEl.textContent = `About ₹${Math.round(r.lo / b.guests).toLocaleString('en-IN')} – ₹${Math.round(r.hi / b.guests).toLocaleString('en-IN')} per guest`;
      renderBars(r.parts);
    }
    return { sync, compute };
  })();

  /* ==========================================================================
     Planning timeline
     ========================================================================== */
  const tl = (() => {
    const MILESTONES = [
      [-365, 'Set your budget, rough guest list and preferred season or muhurtham window'],
      [-300, 'Shortlist and book the venue or hall'],
      [-270, 'Lock your planner, photographer and key vendors'],
      [-180, 'Finalise theme, décor concept and entry style'],
      [-150, 'Send save-the-dates; plan guest stay and travel'],
      [-120, 'Menu tasting and invitation design sign-off'],
      [-90, 'Outfits, makeup and music or band bookings'],
      [-60, 'Send invitations and start RSVP tracking'],
      [-30, 'Final headcount, seating and run-of-show'],
      [-14, 'Confirm every vendor; schedule final payments'],
      [-7, 'On-site walkthrough and rehearsal'],
      [-1, 'Décor set-up, welcome kits and team briefing'],
    ];
    const SCALE = { wedding: 1, reception: 0.6, corporate: 0.45, birthday: 0.25, family: 0.3 };
    const OVERRIDE = {
      corporate: { 0: 'Define objectives, audience, budget and attendee list', 3: 'Finalise theme, agenda and branding', 4: 'Open registrations; plan attendee travel and stay', 6: 'Book speakers, entertainment and AV production' },
      birthday: { 0: 'Pick a theme, date and guest list', 1: 'Book the venue or plan the home set-up', 4: 'Order the cake and plan games or activities', 6: 'Plan outfits, return gifts and photographer' },
      family: { 0: 'Fix the muhurtham or date, guest list and budget', 4: 'Plan elders’ travel and stay; arrange priest or officiant', 6: 'Outfits, jewellery and ritual items checklist' },
    };

    const typeEl = $('#tl-type'), dateEl = $('#tl-date'), listEl = $('#tl-list'), noteEl = $('#tl-note'), ringEl = $('#tl-ring');
    typeEl.innerHTML = TYPES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
    const minDate = toISO(today());
    dateEl.min = minDate;
    const fallbackDate = toISO(addDays(today(), 150));
    let items = [], current = null;

    typeEl.addEventListener('change', () => setBrief({ type: typeEl.value }, 'tl'));
    dateEl.addEventListener('change', () => { if (dateEl.value) setBrief({ date: dateEl.value }, 'tl'); });

    function build(type, eventDate) {
      const k = SCALE[type] || 1, ov = OVERRIDE[type] || {};
      const out = MILESTONES.map(([off, text], i) => {
        const days = Math.min(-1, Math.round(off * k));
        return { days, text: ov[i] || text, date: addDays(eventDate, days) };
      });
      out.push({ days: 0, text: 'The celebration — enjoy every moment', date: eventDate, day: true });
      return out;
    }

    function render(b) {
      const ds = b.date || fallbackDate;
      if (typeEl.value !== b.type) typeEl.value = b.type;
      if (dateEl.value !== ds) dateEl.value = ds;
      const eventDate = parseISO(ds), t0 = today();
      const key = `rt_tl_${b.type}_${ds}`;
      const done = new Set(store.get(key, []));
      items = build(b.type, eventDate);
      current = { key, done };
      const away = Math.round((eventDate - t0) / 864e5);
      const span = Math.abs(items[0].days);
      noteEl.textContent = away < 0
        ? 'That date has already passed — pick an upcoming date to see your countdown.'
        : away < span
          ? `Your date is ${away} day${away === 1 ? '' : 's'} away, so the earlier steps are marked “Do now”. Tackle those first — or let us carry some of them for you.`
          : `${away} days to go. Tick items off as you go — your progress is saved on this device.`;

      listEl.innerHTML = items.map((it, i) => {
        const isDone = done.has(i), late = !it.day && it.date < t0 && !isDone;
        const rel = it.day ? `${away > 0 ? away + ' days to go' : away === 0 ? 'Today!' : ''}` : isDone ? 'Done' : late ? 'Do now' : `in ${Math.round((it.date - t0) / 864e5)} days`;
        return `<li class="tl-item${isDone ? ' is-done' : ''}${late ? ' is-late' : ''}${it.day ? ' is-day' : ''}">
          <label>${it.day ? '<span></span>' : `<input type="checkbox" data-i="${i}"${isDone ? ' checked' : ''}>`}
            <span class="t">${esc(it.text)}</span>
            <span class="d">${fmtDate(it.date)}<em>${rel}</em></span>
          </label></li>`;
      }).join('');
      progress();
    }
    function progress() {
      const total = items.length - 1, n = [...current.done].filter(i => i < total).length;
      const pct = total ? Math.round(n / total * 100) : 0;
      ringEl.style.setProperty('--p', pct);
      $('#tl-pct').textContent = pct + '%';
      $('#tl-count').textContent = `${n} of ${total}`;
      ringEl.setAttribute('aria-label', `Checklist progress: ${n} of ${total} done`);
    }
    listEl.addEventListener('change', e => {
      const cb = e.target.closest('input[data-i]'); if (!cb) return;
      const i = +cb.dataset.i;
      cb.checked ? current.done.add(i) : current.done.delete(i);
      store.set(current.key, [...current.done]);
      const li = cb.closest('.tl-item'), it = items[i];
      li.classList.toggle('is-done', cb.checked);
      li.classList.toggle('is-late', !cb.checked && it.date < today());
      const em = $('em', li);
      if (em) em.textContent = cb.checked ? 'Done' : it.date < today() ? 'Do now' : `in ${Math.round((it.date - today()) / 864e5)} days`;
      progress();
    });

    $('#tl-ics').addEventListener('click', () => {
      const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
      const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const ics = s => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Red Turban//Planner//EN', 'CALSCALE:GREGORIAN'];
      items.forEach((it, i) => lines.push('BEGIN:VEVENT', `UID:rt-${stamp}-${i}@redturban`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(it.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(it.date, 1))}`,
        `SUMMARY:${ics((it.day ? '★ ' : 'Plan: ') + it.text)}`, 'END:VEVENT'));
      lines.push('END:VCALENDAR');
      download('red-turban-plan.ics', lines.join('\r\n'), 'text/calendar');
    });
    return { sync: render };
  })();

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ==========================================================================
     Packages
     ========================================================================== */
  $$('[data-pkg]').forEach(b => b.addEventListener('click', () => {
    setBrief({ pkg: b.dataset.pkg }, 'pkg');
    wiz.goto(1); scrollToId('enquire');
  }));

  /* ==========================================================================
     Enquiry wizard
     ========================================================================== */
  const wiz = (() => {
    const form = $('#wiz'), errEl = $('#wiz-err'), nextBtn = $('#wiz-next'), backBtn = $('#wiz-back'), navEl = $('#wiz-nav');
    const panes = $$('.wiz-step', form), stepLis = $$('.wiz-steps li', form), barFill = $('#wiz-bar'), done = $('#wiz-done');
    const f = { date: $('#w-date'), city: $('#w-city'), guests: $('#w-guests'), budget: $('#w-budget'), notes: $('#w-notes'), name: $('#w-name'), phone: $('#w-phone'), email: $('#w-email') };
    let step = 1;
    f.date.min = toISO(today());

    /* step 1: occasion cards */
    const typesEl = $('#wiz-types');
    typesEl.innerHTML = TYPES.map(t => `<label class="type-card"><input type="radio" name="w-type" value="${t.id}"><span><b>${esc(t.label)}</b><small>${esc(t.hint)}</small></span></label>`).join('');
    typesEl.addEventListener('change', e => setBrief({ type: e.target.value }, 'wiz'));

    const style = pillGroup($('#w-style'), 'w-style', STYLES, 'radio', v => setBrief({ style: v }, 'wiz'));
    const addons = pillGroup($('#w-addons'), 'w-addons', ADDONS, 'checkbox', v => setBrief({ addons: v }, 'wiz'));
    const slot = pillGroup($('#w-slot'), 'w-slot', SLOTS, 'radio', v => setBrief({ slot: v }, 'wiz'));

    /* text-ish fields write straight into the brief */
    Object.entries(f).forEach(([key, el]) => {
      el.addEventListener('input', () => {
        const v = key === 'guests' ? (parseInt(el.value, 10) || 0) : el.value;
        if (key === 'guests' && v < 1) return;
        setBrief({ [key]: key === 'guests' ? clamp(v, 1, 5000) : v }, 'wiz');
        el.removeAttribute('aria-invalid');
      });
    });
    const bump = d => setBrief({ guests: clamp(brief.guests + d * (brief.guests >= 500 ? 50 : 10), 10, 5000) }, 'wiz-step');
    $('#w-g-minus').addEventListener('click', () => bump(-1));
    $('#w-g-plus').addEventListener('click', () => bump(1));

    /* removable chips */
    const inspoEl = $('#wiz-inspo'), pkgEl = $('#wiz-pkg');
    const chip = (el, text, key) => {
      el.hidden = !text;
      el.innerHTML = text ? `<span>${esc(text)}</span><button type="button" aria-label="Remove">✕</button>` : '';
      const btn = $('button', el); if (btn) btn.onclick = () => setBrief({ [key]: '' }, 'wiz-chip');
    };

    function sync(b) {
      $$('input', typesEl).forEach(i => { i.checked = i.value === b.type; });
      style.set(b.style); addons.set(b.addons); slot.set(b.slot);
      Object.entries(f).forEach(([k, el]) => { const v = String(b[k] ?? ''); if (el.value !== v) el.value = v; });
      chip(inspoEl, b.inspo ? `Inspired by: ${b.inspo}` : '', 'inspo');
      chip(pkgEl, b.pkg ? `Package: ${b.pkg}` : '', 'pkg');
    }

    function show(n) {
      step = clamp(n, 1, 4);
      panes.forEach((p, i) => { p.hidden = i + 1 !== step; });
      stepLis.forEach((li, i) => { li.classList.toggle('is-on', i + 1 === step); li.classList.toggle('is-done', i + 1 < step); });
      barFill.style.width = step * 25 + '%';
      backBtn.hidden = step === 1;
      nextBtn.textContent = step === 4 ? 'Prepare my brief ✓' : 'Continue →';
      errEl.textContent = '';
    }
    function fail(msg, el) {
      errEl.textContent = msg;
      if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
      return false;
    }
    function validate() {
      if (step === 2) {
        if (!(brief.guests >= 10)) return fail('Please enter at least 10 guests.', f.guests);
        if (brief.date && parseISO(brief.date) < today()) return fail('That date is in the past — pick an upcoming date.', f.date);
      }
      if (step === 4) {
        if ((brief.name || '').trim().length < 2) return fail('Please tell us your name.', f.name);
        const digits = (brief.phone || '').replace(/[\s\-()+]/g, '');
        if (!/^(91|0)?[6-9]\d{9}$/.test(digits)) return fail('Please enter a valid 10-digit mobile number.', f.phone);
        if (brief.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(brief.email)) return fail('That email doesn’t look right.', f.email);
      }
      return true;
    }
    function next() { if (!validate()) return; if (step < 4) { show(step + 1); form.scrollIntoView({ block: 'nearest' }); } else finish(); }
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', () => show(step - 1));
    form.addEventListener('submit', e => { e.preventDefault(); next(); });

    /* summary + hand-off */
    function briefText() {
      const r = est.compute(brief), b = brief;
      const rows = [
        `New enquiry — ${CONFIG.brand}`, '',
        `Occasion: ${label(TYPES, b.type)}`,
        `Date: ${b.date ? fmtDate(parseISO(b.date)) : 'Not fixed yet'}`,
        `City: ${b.city || '—'}`,
        `Guests: about ${b.guests}`,
        `Setting: ${label(STYLES, b.style)}`,
        `Services wanted: ${b.addons.length ? b.addons.map(a => label(ADDONS, a)).join(', ') : 'Not sure yet'}`,
        `Budget: ${b.budget || 'Not sure yet'}`,
        `Estimator range: ${inr(r.lo)} – ${inr(r.hi)} (indicative)`,
      ];
      if (b.pkg) rows.push(`Package interest: ${b.pkg}`);
      if (b.inspo) rows.push(`Inspired by: ${b.inspo}`);
      if (b.notes.trim()) rows.push(`Notes: ${b.notes.trim()}`);
      rows.push('', `Name: ${b.name.trim()}`, `Phone: ${b.phone.trim()}`);
      if (b.email) rows.push(`Email: ${b.email.trim()}`);
      if (b.slot) rows.push(`Best time to call: ${b.slot}`);
      return rows.join('\n');
    }
    function finish() {
      const text = briefText();
      $('#brief-text').textContent = text;
      const wa = $('#send-wa'), mail = $('#send-mail');
      if (CONFIG.whatsapp) { wa.hidden = false; wa.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`; }
      if (CONFIG.email) { mail.hidden = false; mail.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Enquiry — ' + label(TYPES, brief.type))}&body=${encodeURIComponent(text)}`; }
      $('.wiz-top', form).hidden = true; panes.forEach(p => { p.hidden = true; }); navEl.hidden = true; errEl.textContent = ''; done.hidden = false;
      form.scrollIntoView({ block: 'nearest' });
    }
    $('#copy-brief').addEventListener('click', async () => {
      const text = $('#brief-text').textContent, note = $('#copied');
      try { await navigator.clipboard.writeText(text); note.textContent = 'Copied — paste it into WhatsApp or email.'; }
      catch (e) {
        const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); note.textContent = 'Copied — paste it into WhatsApp or email.'; } catch (err) { note.textContent = 'Select the text above and copy it.'; }
        ta.remove();
      }
    });
    $('#dl-brief').addEventListener('click', () => download('red-turban-brief.txt', $('#brief-text').textContent, 'text/plain'));
    $('#wiz-reset').addEventListener('click', () => {
      done.hidden = true; $('.wiz-top', form).hidden = false; navEl.hidden = false;
      setBrief({ ...DEFAULT_BRIEF }, 'reset'); show(1);
    });

    function goto(n) {
      if (!done.hidden) { done.hidden = true; $('.wiz-top', form).hidden = false; navEl.hidden = false; }
      show(n);
    }
    show(1);
    return { sync, goto };
  })();

  /* ---------- wire everything to the shared brief ---------- */
  listeners.push(b => { est.sync(b); tl.sync(b); wiz.sync(b); });
  est.sync(brief); tl.sync(brief); wiz.sync(brief);

  if (!CONFIG.whatsapp && !CONFIG.email) console.info('[Red Turban] Set CONFIG.whatsapp / CONFIG.email in app.js to enable one-tap sending of enquiries.');
})();
