'use strict';
const L = require('./_lib');

const SOURCES = ['brief', 'contact', 'enquiry', 'businessos', 'careers'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/* Public: the site's forms post here. Saves the lead, then forwards it to the CRM webhook if one is set. */
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method_not_allowed' });
    if (!L.storeKind()) return L.send(res, 503, { error: 'not_configured' });
    const b = await L.readBody(req, 32768);
    if (b.website) return L.send(res, 200, { ok: true });            /* honeypot: bots fill the hidden field */
    const n = await L.store.incr('rl:lead:' + L.sha(L.clientIp(req)), 600);
    if (n > 8) return L.send(res, 429, { error: 'too_many' });
    const source = SOURCES.indexOf(b.source) >= 0 ? b.source : 'contact';
    const name = L.str(b.name, 120), email = L.str(b.email, 254);
    let message = L.str(b.message, 4000);
    /* a careers application can be sent without the optional note: use the role as the message so it is still saved */
    if (!message && source === 'careers') message = ('Application' + (L.str(b.role, 120) ? ' for ' + L.str(b.role, 120) : '')).trim();
    if (!name || !EMAIL.test(email) || !message) return L.send(res, 400, { error: 'invalid' });
    const priv = await L.getPrivate();
    if (priv.forms && priv.forms[source] && priv.forms[source].open === false) return L.send(res, 403, { error: 'form_paused' });   /* paused in the admin: the site falls back to email */
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const lead = {
      id, createdAt: new Date().toISOString(), source, name, email, message,
      company: L.str(b.company, 160), role: L.str(b.role, 120), link: L.str(b.link, 300), page: L.str(b.page, 120),
      phone: L.str(b.phone, 40).replace(/[^0-9+()\-.\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24),
      status: 'new', notes: '', crm: { status: 'off' }
    };
    if (priv.crm && priv.crm.enabled && priv.crm.url) lead.crm = await L.forward(priv.crm, lead, 'lead.created');
    await L.store.hset(L.K_LEADS, id, JSON.stringify(lead));
    return L.send(res, 200, { ok: true });
  } catch (e) { return L.send(res, e.status || 500, { error: 'server_error' }); }
};
