import { $ } from './util.js';
import * as reel from './reel.js';

/* The hero is a swipe-up reel of looks. The rest of the page is the normal shop. */
export function initHeroes() {
  const host = $('#hero');
  if (host) reel.mount(host);
}
