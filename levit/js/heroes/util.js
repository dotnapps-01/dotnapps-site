import { byId } from '../products.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const root = document.documentElement;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad = (n) => String(n).padStart(2, '0');

/** The eight looks every hero draws from (all real photographs). */
export const LOOK_IDS = ['ruby-ruffle-dress', 'smocked-bow-top', 'black-bell-sleeve-kurta', 'tissue-dupatta-kurta', 'red-polka-midi', 'lace-crochet-top', 'navy-zip-jacket', 'ruby-cape-dress'];
export const looks = (ids = LOOK_IDS) => ids.map(byId).filter(Boolean);

/** Run once the preloader has lifted (immediately if it already has). */
export function onReady(fn) {
  if (root.classList.contains('is-ready')) { fn(); return () => {}; }
  root.addEventListener('ready', fn, { once: true });
  return () => root.removeEventListener('ready', fn);
}

/** Collects listeners, timers and frame loops so a hero can be torn down cleanly. */
export function scope() {
  const offs = [];
  return {
    on(t, e, f, o) { t.addEventListener(e, f, o); offs.push(() => t.removeEventListener(e, f, o)); },
    timeout(f, ms) { const id = setTimeout(f, ms); offs.push(() => clearTimeout(id)); return id; },
    interval(f, ms) { const id = setInterval(f, ms); offs.push(() => clearInterval(id)); return id; },
    /** requestAnimationFrame loop; fn(dt seconds, t seconds). Returns stop(). */
    loop(fn) {
      let id = 0, last = performance.now(), on = true;
      const tick = (now) => { if (!on) return; fn(Math.min(0.05, (now - last) / 1000), now / 1000); last = now; id = requestAnimationFrame(tick); };
      id = requestAnimationFrame(tick);
      const stop = () => { on = false; cancelAnimationFrame(id); };
      offs.push(stop); return stop;
    },
    add(f) { offs.push(f); },
    clear() { offs.splice(0).forEach((f) => f()); },
  };
}

/** Progress (0..1) of a tall pinned section as the page scrolls through it. */
export function pinProgress(el) {
  const head = parseFloat(getComputedStyle(root).getPropertyValue('--head-h')) || 72;
  const r = el.getBoundingClientRect();
  const dist = Math.max(1, r.height - (innerHeight - head));
  return clamp((head - r.top) / dist);
}
