'use strict';
const L = require('./_lib');

/* Public: the site tells us a page was opened. This is the whole visit counter.
   No cookies, no stored IP address, no stored user agent, nothing that identifies a person.
   Per day we keep only totals: page views, which page, where from, device size and country.
   "Visitors" are counted with a one-way code made from the address and browser plus a salt that changes every day;
   it goes straight into a counting structure (a HyperLogLog), is never stored on its own, and cannot be reversed. */

const PAGES = { '/': 1, '/products': 1, '/services': 1, '/work': 1 };
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|java\/|httpclient|facebookexternalhit|whatsapp|telegram|discord|embedly|vercel|node-fetch|axios/i;
const KEEP_SECONDS = 400 * 86400;                       /* daily totals are kept for about 13 months */
const done = (res) => { res.statusCode = 204; res.setHeader('Cache-Control', 'no-store'); res.end(); };

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method_not_allowed' });
    if (!L.storeKind()) return done(res);
    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT.test(ua)) return done(res);                                      /* crawlers, link previews, monitors */
    if (req.headers['sec-purpose'] || req.headers.purpose) return done(res);       /* browser prefetch / prerender */
    if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1') return done(res);   /* "do not track" is respected */
    const host = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (L.storeKind() !== 'memory' && !/(^|\.)dotnapps\.com$/.test(host)) return done(res);   /* not the preview deployments */
    if (L.isAdmin(req)) return done(res);                                           /* not the owner's own visits while signed in */

    const ip = L.clientIp(req);
    if ((await L.store.incr('rl:hit:' + L.sha(ip), 60)) > 40) return done(res);     /* a burst from one place is not real traffic */

    const b = await L.readBody(req, 2048);
    let p = String(b.p || '/').split(/[?#]/)[0].toLowerCase().replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    if (!PAGES[p]) p = 'other';
    let ref = String(b.r || '').trim().toLowerCase();
    if (/^https?:\/\//.test(ref)) { try { ref = new URL(ref).hostname; } catch (e) { ref = ''; } }     /* a full address is reduced to its host */
    ref = ref.replace(/^www\./, '');
    if (!/^[a-z0-9][a-z0-9.-]{2,58}$/.test(ref) || ref === host.replace(/^www\./, '')) ref = '';
    const utm = /^[a-z0-9._-]{1,30}$/i.test(String(b.u || '')) ? String(b.u).toLowerCase() : '';
    const source = utm ? 'utm:' + utm : ref || 'direct';
    const w = Number(b.w) || 0;
    const device = w && w < 700 ? 'mobile' : w && w < 1100 ? 'tablet' : 'desktop';
    const c = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
    const country = /^[A-Z]{2}$/.test(c) ? c : '??';

    const day = L.dayOf(Date.now()), dk = 'dn:d:' + day, uk = 'dn:u:' + day;
    const visitor = L.sha(ip + '|' + ua + '|' + day + '|' + L.secret());
    await L.store.multi([
      ['HINCRBY', dk, 'v', 1], ['HINCRBY', dk, 'p:' + p, 1], ['HINCRBY', dk, 's:' + source, 1], ['HINCRBY', dk, 'd:' + device, 1], ['HINCRBY', dk, 'c:' + country, 1],
      ['PFADD', uk, visitor], ['EXPIRE', dk, KEEP_SECONDS], ['EXPIRE', uk, KEEP_SECONDS]
    ]);
    return done(res);
  } catch (e) { return done(res); }                                                  /* counting must never break a page */
};
