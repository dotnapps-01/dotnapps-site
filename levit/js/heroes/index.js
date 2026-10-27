import { $, $$, root } from './util.js';
import * as magazine from './magazine.js';
import * as curtain from './curtain.js';
import * as runway from './runway.js';
import * as windows from './windows.js';
import * as rail from './rail.js';
import * as flythrough from './flythrough.js';
import * as stories from './stories.js';
import * as pile from './pile.js';
import * as slats from './slats.js';
import * as bento from './bento.js';
import * as spotlight from './spotlight.js';
import * as cylinder from './cylinder.js';
import * as booth from './booth.js';
import * as collage from './collage.js';

/* Fourteen hero styles to try. The pill at the bottom of the page switches between them (also ?hero=1..14). */
export const HEROES = [
  { id: 'curtain', name: 'Sand curtain', mod: curtain },
  { id: 'runway', name: 'Runway scroll', mod: runway },
  { id: 'windows', name: 'Wordmark windows', mod: windows },
  { id: 'magazine', name: 'Magazine cover', mod: magazine },
  { id: 'rail', name: 'Clothes rail', mod: rail },
  { id: 'fly', name: 'Fly through', mod: flythrough },
  { id: 'stories', name: 'Story reel', mod: stories },
  { id: 'pile', name: 'Draggable prints', mod: pile },
  { id: 'slats', name: 'Venetian blinds', mod: slats },
  { id: 'bento', name: 'Bento grid', mod: bento },
  { id: 'spotlight', name: 'Spotlight', mod: spotlight },
  { id: 'cylinder', name: 'Cylinder', mod: cylinder },
  { id: 'booth', name: 'Photo booth', mod: booth },
  { id: 'collage', name: 'Collage', mod: collage },
];

export function initHeroes() {
  const host = $('#hero');
  if (!host) return;
  let cur = -1, destroy = null;
  const store = { get: () => { try { return localStorage.getItem('levit-hero'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('levit-hero', v); } catch { /* ignore */ } } };
  const want = () => { const q = new URLSearchParams(location.search).get('hero'); const n = parseInt(q || store.get() || '4', 10); return Number.isFinite(n) ? Math.min(HEROES.length, Math.max(1, n)) - 1 : 3; };

  const pill = document.createElement('nav');
  pill.className = 'hsw'; pill.setAttribute('aria-label', 'Hero style');
  pill.innerHTML = `<span class="hsw__label">Hero style</span><button class="hsw__step" type="button" data-step="-1" aria-label="Previous hero style">‹</button><span class="hsw__btns">${HEROES.map((h, k) => `<button type="button" data-h="${k}" aria-label="${h.name}" title="${h.name}">${k + 1}</button>`).join('')}</span><span class="hsw__cur" id="hsw-cur"></span><button class="hsw__step" type="button" data-step="1" aria-label="Next hero style">›</button><span class="hsw__name" id="hsw-name"></span>`;
  document.body.append(pill);

  const go = (k, fromUser) => {
    if (k === cur) return;
    destroy?.(); destroy = null;
    host.className = 'hero'; host.innerHTML = ''; host.removeAttribute('style');
    window.scrollTo(0, 0);
    cur = k; const h = HEROES[k];
    host.dataset.style = h.id;
    destroy = h.mod.mount(host) || null;
    $$('button', pill).forEach((b, m) => b.setAttribute('aria-pressed', m === k));
    $('#hsw-name', pill).textContent = `${k + 1}. ${h.name}`; $('#hsw-cur', pill).textContent = `${k + 1}/${HEROES.length}`;
    if (fromUser) { store.set(String(k + 1)); const u = new URL(location.href); u.searchParams.set('hero', k + 1); history.replaceState(null, '', u); }
  };
  pill.addEventListener('pointerenter', () => pill.classList.add('is-peek')); pill.addEventListener('pointerleave', () => pill.classList.remove('is-peek'));
  pill.addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]'); if (b) go(+b.dataset.h, true);
    const s = e.target.closest('[data-step]'); if (s) { go((cur + +s.dataset.step + HEROES.length) % HEROES.length, true); pill.classList.add('is-peek'); setTimeout(() => pill.classList.remove('is-peek'), 1600); }
  });
  addEventListener('keydown', (e) => { if (e.altKey && /^[1-9]$/.test(e.key)) { go(+e.key - 1, true); e.preventDefault(); } });
  go(want(), false);
}
