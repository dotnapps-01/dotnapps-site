'use strict';
const L = require('./_lib');

/* GET = who am I · POST {password} = log in · DELETE = log out */
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      if (!process.env.ADMIN_PASSWORD || !L.storeKind()) return L.send(res, 503, { error: 'not_configured', password: !!process.env.ADMIN_PASSWORD, store: !!L.storeKind() });
      return L.isAdmin(req) ? L.send(res, 200, { ok: true, store: L.storeKind() }) : L.send(res, 401, { error: 'unauthorized' });
    }
    if (req.method === 'POST') {
      if (!process.env.ADMIN_PASSWORD || !L.storeKind()) return L.send(res, 503, { error: 'not_configured', password: !!process.env.ADMIN_PASSWORD, store: !!L.storeKind() });
      const n = await L.store.incr('rl:login:' + L.sha(L.clientIp(req)), 600);
      if (n > 8) return L.send(res, 429, { error: 'too_many_attempts' });
      const b = await L.readBody(req, 4096);
      if (!L.passwordOk(b.password)) { await new Promise((r) => setTimeout(r, 500)); return L.send(res, 401, { error: 'wrong_password' }); }
      L.setSession(req, res);
      return L.send(res, 200, { ok: true, store: L.storeKind() });
    }
    if (req.method === 'DELETE') { L.clearSession(res); return L.send(res, 200, { ok: true }); }
    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) { return L.send(res, e.status || 500, { error: 'server_error' }); }
};
