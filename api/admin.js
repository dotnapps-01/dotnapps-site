'use strict';
const L = require('./_lib');

/* Admin settings: GET = public + private (secret masked) · PUT = save both · POST ?action=test = send a test lead to the CRM */
module.exports = async (req, res) => {
  try {
    const write = req.method !== 'GET';
    if (!L.guard(req, res, write)) return;
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET') {
      return L.send(res, 200, { public: await L.getPublic(), private: L.maskPrivate(await L.getPrivate()), store: L.storeKind() });
    }
    if (req.method === 'PUT') {
      const b = await L.readBody(req, 262144);
      const prev = await L.getPrivate();
      const pub = L.cleanPublic(b.public), priv = L.cleanPrivate(b.private, prev);
      if (priv.crm.enabled && !priv.crm.url) return L.send(res, 400, { error: 'crm_url_needed' });
      await L.store.set(L.K_PUBLIC, JSON.stringify(pub));
      await L.store.set(L.K_PRIVATE, JSON.stringify(priv));
      return L.send(res, 200, { ok: true, public: pub, private: L.maskPrivate(priv) });
    }
    if (req.method === 'POST' && url.searchParams.get('action') === 'test') {
      const b = await L.readBody(req, 65536);
      const prev = await L.getPrivate();
      const c = L.cleanPrivate(b.private || { crm: prev.crm }, prev).crm;      /* test what is on screen, even before saving */
      c.enabled = true;
      if (!c.url) return L.send(res, 400, { error: 'crm_url_needed' });
      const r = await L.forward(c, { id: 'test', createdAt: new Date().toISOString(), source: 'contact', name: 'Test Lead', email: 'test@example.com', message: 'This is a test lead sent from the Dotnapps admin.', company: '', role: '', link: '', page: '/admin' }, 'lead.test');
      return L.send(res, 200, r);
    }
    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) { return L.send(res, e.status || 500, { error: 'server_error' }); }
};
