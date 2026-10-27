import { inr } from '../products.js';
import { $, $$, reduced, scope, onReady, looks } from './util.js';

/* Wordmark windows: each letter of LEVIT is a window onto its own slow cycle of real photos. */
export function mount(hero) {
  const list = looks(), S = scope();
  hero.className = 'wn';
  hero.innerHTML = `<p class="eyebrow wn__eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p>
    <h1 class="wn__sr">LEVIT: Soft structure, every day.</h1>
    <div class="wn__art" id="wn-art"></div>
    <div class="wn__foot"><p class="wn__tag">Soft structure, <em>every day.</em></p><p class="wn__now" id="wn-now" aria-live="polite">&nbsp;</p><a class="btn btn--ink" href="#shop" data-magnet><span>Shop the edit</span></a></div>`;
  let alive = true;
  S.add(() => { alive = false; });
  (async () => {
    try { await document.fonts.load('900 100px "Playfair Display"', 'LEVIT'); } catch { /* fall back to whatever loaded */ }
    if (!alive) return;
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '900 100px "Playfair Display", serif';
    const chars = [...'LEVIT'], ws = chars.map((c) => ctx.measureText(c).width), GAP = 5;
    let x = 0; const xs = ws.map((w) => { const v = x; x += w + GAP; return v; }); const W = x - GAP;
    const per = 3, defs = [], body = [];
    chars.forEach((ch, i) => {
      defs.push(`<clipPath id="wc${i}"><text x="${xs[i]}" y="80" class="wn__t">${ch}</text></clipPath>`);
      const imgs = Array.from({ length: per }, (_, m) => { const p = list[(i * per + m * 3 + i) % list.length]; return `<image class="wn__im${m ? '' : ' is-on'}" href="${p.photo}" x="${xs[i] - 6}" y="0" width="${ws[i] + 12}" height="100" preserveAspectRatio="xMidYMid slice" data-id="${p.id}"/>`; }).join('');
      body.push(`<g class="wn__l" data-i="${i}" tabindex="0" role="button" aria-label="Open the look in letter ${ch}"><rect x="${xs[i]}" y="0" width="${ws[i]}" height="100" fill="#e9dccb" clip-path="url(#wc${i})"/><g clip-path="url(#wc${i})">${imgs}</g><text x="${xs[i]}" y="80" class="wn__t wn__o">${ch}</text></g>`);
    });
    $('#wn-art', hero).innerHTML = `<svg viewBox="-2 0 ${W + 4} 100" role="img" aria-label="LEVIT"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
    const groups = $$('.wn__l', hero), idx = groups.map(() => 0);
    const set = (i, m) => { const ims = $$('.wn__im', groups[i]); ims.forEach((im, k) => im.classList.toggle('is-on', k === m)); idx[i] = m; };
    const now = $('#wn-now', hero);
    let hot = -1;
    const label = (i) => { const id = $$('.wn__im', groups[i])[idx[i]].dataset.id; const p = list.find((q) => q.id === id); now.textContent = `${p.name} · ${inr(p.price)}`; return id; };
    groups.forEach((g, i) => {
      S.on(g, 'pointerenter', () => { hot = i; g.classList.add('is-hot'); label(i); });
      S.on(g, 'pointerleave', () => { hot = -1; g.classList.remove('is-hot'); now.innerHTML = '&nbsp;'; });
      S.on(g, 'click', () => { const id = $$('.wn__im', g)[idx[i]].dataset.id; document.dispatchEvent(new CustomEvent('levit:quick', { detail: id })); });
      S.on(g, 'keydown', (e) => { if (e.key === 'Enter') g.dispatchEvent(new Event('click')); });
    });
    if (!reduced) onReady(() => groups.forEach((_, i) => { S.timeout(() => S.interval(() => { if (i !== hot) set(i, (idx[i] + 1) % per); }, 3600), i * 650); }));
  })();
  return () => S.clear();
}
