'use strict';

/*
 * /api/chats — the team side of live chat. Used by the "Chats" tab of the admin
 * dashboard (/admin). It reuses the admin's own login: the same session cookie
 * and the same guard as /api/leads and /api/admin, so there is no extra password.
 *
 *   GET    ?view=list              -> {chats:[...], waiting}   newest activity first
 *   GET    ?id=<id>&after=<n>      -> {meta, messages, next}
 *   POST   {id, text}              -> {ok}                     reply to the visitor
 *   POST   {id, action:"close"}    -> {ok}                     end the chat
 *   DELETE ?id=<id>                -> {ok}                     delete a conversation
 *
 * Conversations are created by api/live.js and kept 3 days after the last message.
 */

const A = require('./_lib');        // admin session helpers
const C = require('./_chatlib');    // chat storage helpers

const mKey = (id) => 'dn:m:' + id;
const cKey = (id) => 'dn:c:' + id;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const write = req.method !== 'GET';
    if (!A.guard(req, res, write)) return;
    if (!C.redisConfigured()) return A.send(res, 503, { error: 'chat_needs_upstash' });
    const now = Date.now();
    const q = C.query(req);

    if (req.method === 'GET') {
      if (q.view === 'list') {
        const [ids] = await C.redis([['ZREVRANGE', 'dn:idx', 0, 49], ['SET', 'dn:agent:seen', '1', 'EX', 60]]);
        const cmds = [];
        (ids || []).forEach((id) => { cmds.push(['GET', cKey(id)], ['LINDEX', mKey(id), -1]); });
        const rows = cmds.length ? await C.redis(cmds) : [];
        const chats = [], stale = [];
        (ids || []).forEach((id, i) => {
          const meta = C.parse(rows[i * 2]);
          if (!meta) { stale.push(id); return; }
          const last = C.parse(rows[i * 2 + 1]);
          chats.push({
            id, name: meta.name, email: meta.email, page: meta.page, status: meta.status,
            created: meta.created, updated: meta.updated,
            needsReply: meta.status !== 'closed' && meta.lastVisitor > meta.lastAgent,
            preview: last ? String(last.t).slice(0, 90) : ''
          });
        });
        if (stale.length) await C.redis(stale.map((id) => ['ZREM', 'dn:idx', id]));
        return A.send(res, 200, { chats, waiting: chats.filter((c) => c.needsReply).length });
      }
      if (!C.ID_RE.test(q.id || '')) return A.send(res, 400, { error: 'bad_id' });
      const after = Math.max(0, Math.min(parseInt(q.after, 10) || 0, 100000));
      const [c, list] = await C.redis([['GET', cKey(q.id)], ['LRANGE', mKey(q.id), after, -1], ['SET', 'dn:agent:seen', '1', 'EX', 60]]);
      const meta = C.parse(c);
      if (!meta) return A.send(res, 404, { error: 'not_found' });
      return A.send(res, 200, { meta, messages: (list || []).map(C.parse).filter(Boolean), next: after + (list || []).length });
    }

    if (req.method === 'DELETE') {
      if (!C.ID_RE.test(q.id || '')) return A.send(res, 400, { error: 'bad_id' });
      await C.redis([['DEL', cKey(q.id)], ['DEL', mKey(q.id)], ['ZREM', 'dn:idx', q.id]]);
      return A.send(res, 200, { ok: true });
    }

    if (req.method === 'POST') {
      const b = await A.readBody(req, 16384);
      const id = String(b.id || '');
      if (!C.ID_RE.test(id)) return A.send(res, 400, { error: 'bad_id' });
      const meta = C.parse((await C.redis([['GET', cKey(id)]]))[0]);
      if (!meta) return A.send(res, 404, { error: 'not_found' });

      if (b.action === 'close') {
        meta.status = 'closed';
        meta.updated = now;
        await C.redis([
          ['RPUSH', mKey(id), JSON.stringify({ f: 'sys', t: 'The team ended this chat.', ts: now })],
          ['SET', cKey(id), JSON.stringify(meta), 'EX', C.TTL],
          ['EXPIRE', mKey(id), C.TTL],
          ['ZADD', 'dn:idx', now, id]
        ]);
        return A.send(res, 200, { ok: true });
      }

      // eslint-disable-next-line no-control-regex
      const text = String(b.text || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 2000);
      if (!text) return A.send(res, 400, { error: 'empty' });
      if (meta.status === 'closed') return A.send(res, 410, { error: 'closed' });
      meta.status = 'open';
      meta.updated = now;
      meta.lastAgent = now;
      await C.redis([
        ['RPUSH', mKey(id), JSON.stringify({ f: 'agent', t: text, ts: now })],
        ['SET', cKey(id), JSON.stringify(meta), 'EX', C.TTL],
        ['EXPIRE', mKey(id), C.TTL],
        ['ZADD', 'dn:idx', now, id]
      ]);
      return A.send(res, 200, { ok: true });
    }

    return A.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) { return A.send(res, e.status || 500, { error: 'server_error' }); }
};
