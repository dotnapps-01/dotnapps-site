import { $ } from './util.js';
import * as stories from './stories.js';

/* The hero is the story reel. (Thirteen other styles were tried; they live in git history.) */
export function initHeroes() {
  const host = $('#hero');
  if (host) stories.mount(host);
}
