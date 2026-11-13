'use strict';
const L = require('./_lib');

/* Admin: GET ?days=7|30|90 -> the visit totals for the Analytics tab, plus how many forms were sent each day */
module.exports = async (req, res) => {
  try {
    if (!L.guard(req, res, false)) return;
    if (req.method !== 'GET') return L.send(res, 405, { error: 'method_not_allowed' });
    const n = [7, 30, 90].indexOf(Number(new URL(req.url, 'http://x').searchParams.get('days'))) >= 0 ? Number(new URL(req.url, 'http://x').searchParams.get('days')) : 30;
    const now = Date.now(), days = [];
    for (let i = n - 1; i >= 0; i--) days.push(L.dayOf(now - i * 864e5));

    const cmds = [];
    days.forEach((d) => { cmds.push(['HGETALL', 'dn:d:' + d]); cmds.push(['PFCOUNT', 'dn:u:' + d]); });
    const out = await L.store.multi(cmds);

    const sum = { pages: {}, sources: {}, devices: {}, countries: {} }, perDay = [];
    let views = 0, visitors = 0, firstSeen = '';
    days.forEach((d, i) => {
      const flat = out[i * 2] || [], uniq = Number(out[i * 2 + 1]) || 0;
      let v = 0;
      for (let j = 0; j < flat.length; j += 2) {
        const key = String(flat[j]), val = Number(flat[j + 1]) || 0, kind = key.slice(0, 2), name = key.slice(2);
        if (key === 'v') v = val;
        else if (kind === 'p:') sum.pages[name] = (sum.pages[name] || 0) + val;
        else if (kind === 's:') sum.sources[name] = (sum.sources[name] || 0) + val;
        else if (kind === 'd:') sum.devices[name] = (sum.devices[name] || 0) + val;
        else if (kind === 'c:') sum.countries[name] = (sum.countries[name] || 0) + val;
      }
      if (v && !firstSeen) firstSeen = d;
      views += v; visitors += uniq;
      perDay.push({ d, views: v, visitors: uniq, forms: 0 });
    });

    /* forms sent: from the saved leads, by day and by form */
    const raw = await L.store.hgetall(L.K_LEADS), byForm = {}, idx = {};
    perDay.forEach((x, i) => { idx[x.d] = i; });
    let forms = 0;
    Object.values(raw).forEach((s) => {
      let l; try { l = JSON.parse(s); } catch (e) { return; }
      const i = idx[L.dayOf(Date.parse(l.createdAt) || 0)];
      if (i === undefined) return;
      perDay[i].forms += 1; forms += 1; byForm[l.source] = (byForm[l.source] || 0) + 1;
    });

    const top = (o, max) => Object.keys(o).map((k) => ({ k, n: o[k] })).sort((a, b) => b.n - a.n).slice(0, max);
    return L.send(res, 200, {
      days: n, firstSeen, totals: { views, visitors, forms },
      perDay, pages: top(sum.pages, 12), sources: top(sum.sources, 12), devices: top(sum.devices, 4), countries: top(sum.countries, 12), formsByForm: top(byForm, 8)
    });
  } catch (e) { return L.send(res, e.status || 500, { error: 'server_error' }); }
};
