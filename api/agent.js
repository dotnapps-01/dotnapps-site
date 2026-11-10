"use strict";

/*
 * /api/agent — the team side of human chat, used by /agent (agent.html).
 * Every request needs   Authorization: Bearer <AGENT_TOKEN>.
 *
 *   GET  ?view=list                -> {chats:[...]}   newest activity first
 *   GET  ?id=<id>&after=<n>        -> {meta, messages, next}
 *   POST {id, text}                -> {ok}            reply to the visitor
 *   POST {id, action:"close"}      -> {ok}            end the chat
 *
 * Needs AGENT_TOKEN (a long random string you choose) plus the Redis vars
 * described in live.js.
 */

const L = require("./_lib");

const failLimited = L.limiter([[15 * 60 * 1000, 10]]);
const mKey = (id) => "dn:m:" + id;
const cKey = (id) => "dn:c:" + id;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const send = (status, obj) => res.status(status).json(obj);

  const token = process.env.AGENT_TOKEN;
  if (!token || !L.redisConfigured()) return send(503, { error: "Agent chat isn't configured." });

  const ip = L.clientIp(req);
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!given || !L.sameSecret(given, token)) {
    if (failLimited(ip)) return send(429, { error: "Too many attempts. Try again later." });
    return send(401, { error: "Wrong token." });
  }

  try {
    const now = Date.now();

    if (req.method === "GET") {
      const q = L.query(req);

      if (q.view === "list") {
        const [ids] = await L.redis([["ZREVRANGE", "dn:idx", 0, 49], ["SET", "dn:agent:seen", "1", "EX", 60]]);
        const cmds = [];
        (ids || []).forEach((id) => { cmds.push(["GET", cKey(id)], ["LINDEX", mKey(id), -1]); });
        const rows = cmds.length ? await L.redis(cmds) : [];
        const chats = [];
        const stale = [];
        (ids || []).forEach((id, i) => {
          const meta = L.parse(rows[i * 2]);
          if (!meta) { stale.push(id); return; }
          const last = L.parse(rows[i * 2 + 1]);
          chats.push({
            id, name: meta.name, email: meta.email, page: meta.page, status: meta.status,
            updated: meta.updated, needsReply: meta.status !== "closed" && meta.lastVisitor > meta.lastAgent,
            preview: last ? String(last.t).slice(0, 90) : ""
          });
        });
        if (stale.length) await L.redis(stale.map((id) => ["ZREM", "dn:idx", id]));
        return send(200, { chats });
      }

      if (!L.ID_RE.test(q.id || "")) return send(400, { error: "Bad request." });
      const after = Math.max(0, Math.min(parseInt(q.after, 10) || 0, 100000));
      const [c, list] = await L.redis([["GET", cKey(q.id)], ["LRANGE", mKey(q.id), after, -1], ["SET", "dn:agent:seen", "1", "EX", 60]]);
      const meta = L.parse(c);
      if (!meta) return send(404, { error: "Chat not found (it may have expired)." });
      return send(200, { meta, messages: (list || []).map(L.parse).filter(Boolean), next: after + (list || []).length });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(405, { error: "Method not allowed." });
    }

    const b = req.body || {};
    const id = String(b.id || "");
    if (!L.ID_RE.test(id)) return send(400, { error: "Bad request." });
    const meta = L.parse((await L.redis([["GET", cKey(id)]]))[0]);
    if (!meta) return send(404, { error: "Chat not found (it may have expired)." });

    if (b.action === "close") {
      meta.status = "closed";
      meta.updated = now;
      await L.redis([
        ["RPUSH", mKey(id), JSON.stringify({ f: "sys", t: "The team ended this chat.", ts: now })],
        ["SET", cKey(id), JSON.stringify(meta), "EX", L.TTL],
        ["EXPIRE", mKey(id), L.TTL],
        ["ZADD", "dn:idx", now, id]
      ]);
      return send(200, { ok: true });
    }

    // eslint-disable-next-line no-control-regex
    const text = String(b.text || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, 2000);
    if (!text) return send(400, { error: "Type a message first." });
    if (meta.status === "closed") return send(410, { error: "This chat is closed." });
    meta.status = "open";
    meta.updated = now;
    meta.lastAgent = now;
    await L.redis([
      ["RPUSH", mKey(id), JSON.stringify({ f: "agent", t: text, ts: now })],
      ["SET", cKey(id), JSON.stringify(meta), "EX", L.TTL],
      ["EXPIRE", mKey(id), L.TTL],
      ["ZADD", "dn:idx", now, id]
    ]);
    return send(200, { ok: true });
  } catch (e) {
    console.error("agent: failed:", e && e.message);
    return send(503, { error: "Storage error. Try again." });
  }
};
