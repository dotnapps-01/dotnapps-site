'use strict';
const L = require('./_lib');

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'];
const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';

/* Admin: GET list (?format=csv to export) · PATCH {id,status,notes} · DELETE ?id= · POST {action:'resend',id} */
module.exports = async (req, res) => {
  try {
    const write = req.method !== 'GET';
    if (!L.guard(req, res, write)) return;
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET') {
      const raw = await L.store.hgetall(L.K_LEADS);
      const all = Object.values(raw).map((v) => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const week = Date.now() - 7 * 864e5;
      const counts = { total: all.length, new: all.filter((l) => l.status === 'new').length, week: all.filter((l) => Date.parse(l.createdAt) > week).length, crm: all.filter((l) => l.crm && l.crm.status === 'sent').length };
      if (url.searchParams.get('format') === 'csv') {
        const head = ['id', 'created_at', 'status', 'source', 'name', 'email', 'company', 'role', 'link', 'message', 'notes', 'crm'];
        const only = /^[a-z]{3,20}$/.test(url.searchParams.get('source') || '') ? url.searchParams.get('source') : '';   /* one form's submissions */
        const rows = all.filter((l) => !only || l.source === only).map((l) => [l.id, l.createdAt, l.status, l.source, l.name, l.email, l.company, l.role, l.link, l.message, l.notes, l.crm && l.crm.status].map(csvCell).join(','));
        return L.send(res, 200, [head.join(',')].concat(rows).join('\n'), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="dotnapps-leads' + (only ? '-' + only : '') + '.csv"' });
      }
      return L.send(res, 200, { leads: all, counts });
    }
    const b = req.method === 'DELETE' ? {} : await L.readBody(req, 16384);
    const id = req.method === 'DELETE' ? url.searchParams.get('id') : b.id;
    if (!id || !/^[a-z0-9]{3,40}$/.test(id)) return L.send(res, 400, { error: 'bad_id' });
    const cur = await L.store.hget(L.K_LEADS, id);
    if (!cur) return L.send(res, 404, { error: 'not_found' });
    let lead = JSON.parse(cur);
    if (req.method === 'DELETE') { await L.store.hdel(L.K_LEADS, id); return L.send(res, 200, { ok: true }); }
    if (req.method === 'PATCH') {
      if (b.status !== undefined) { if (STATUSES.indexOf(b.status) < 0) return L.send(res, 400, { error: 'bad_status' }); lead.status = b.status; }
      if (b.notes !== undefined) lead.notes = L.str(b.notes, 4000);
      await L.store.hset(L.K_LEADS, id, JSON.stringify(lead));
      return L.send(res, 200, { ok: true, lead });
    }
    if (req.method === 'POST' && b.action === 'resend') {
      const priv = await L.getPrivate();
      lead.crm = await L.forward(priv.crm, lead, 'lead.resent');
      await L.store.hset(L.K_LEADS, id, JSON.stringify(lead));
      return L.send(res, 200, { ok: true, lead });
    }
    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) { return L.send(res, e.status || 500, { error: 'server_error' }); }
};
