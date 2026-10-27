import { $, $$ } from './util.js';
import * as deck from './deck.js';
import * as reel from './reel.js';
import * as tilt from './tilt.js';
import * as sheet from './sheet.js';
import * as scratch from './scratch.js';
import * as pins from './pins.js';
import * as flick from './flick.js';
import * as dial from './dial.js';
import * as stories from './stories.js';

/* Hero styles built for phones first. The control at the bottom (a side dock on desktop) switches between
   them; ?hero=1..9 and Alt+1..9 also work. Once one is chosen, delete the rest and this file. */
export const HEROES = [
  { id: 'deck', name: 'Swipe deck', mod: deck },
  { id: 'reel', name: 'Reel feed', mod: reel },
  { id: 'tilt', name: 'Tilt to peek', mod: tilt },
  { id: 'sheet', name: 'Bottom sheet', mod: sheet },
  { id: 'scratch', name: 'Scratch to reveal', mod: scratch },
  { id: 'pins', name: 'Look pins', mod: pins },
  { id: 'flick', name: 'Flick stack', mod: flick },
  { id: 'dial', name: 'Thumb dial', mod: dial },
  { id: 'stories', name: 'Story reel (current)', mod: stories },
];

export function initHeroes() {
  const host = $('#hero');
  if (!host) return;
  let cur = -1, destroy = null;
  const mem = { get: () => { try { return localStorage.getItem('levit-hero'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('levit-hero', v); } catch { /* ignore */ } } };
  const want = () => { const q = new URLSearchParams(location.search).get('hero'); const n = parseInt(q || mem.get() || '1', 10); return Number.isFinite(n) ? Math.min(HEROES.length, Math.max(1, n)) - 1 : 0; };

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
    if (fromUser) { mem.set(String(k + 1)); const u = new URL(location.href); u.searchParams.set('hero', k + 1); history.replaceState(null, '', u); }
  };
  pill.addEventListener('pointerenter', () => pill.classList.add('is-peek')); pill.addEventListener('pointerleave', () => pill.classList.remove('is-peek'));
  pill.addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]'); if (b) go(+b.dataset.h, true);
    const s = e.target.closest('[data-step]'); if (s) { go((cur + +s.dataset.step + HEROES.length) % HEROES.length, true); pill.classList.add('is-peek'); setTimeout(() => pill.classList.remove('is-peek'), 1600); }
  });
  addEventListener('keydown', (e) => { if (e.altKey && /^[1-9]$/.test(e.key)) { go(+e.key - 1, true); e.preventDefault(); } });
  go(want(), false);
}
