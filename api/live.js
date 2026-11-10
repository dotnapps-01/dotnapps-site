"use strict";

/*
 * /api/live — the visitor side of human chat.
 *
 *   POST {action:"start", name?, email, page?, transcript?:[{role,content}]}
 *        -> {id, next, online}      creates the conversation, emails the team
 *   POST {action:"send", id, text} -> {ok, next}
 *   POST {action:"end",  id}       -> {ok}
 *   GET  ?id=<id>&after=<n>        -> {messages, next, status}   (polled by the widget)
 *
 * The conversation id is an unguessable 128-bit token created here; whoever
 * holds it can read and write that one conversation.
 *
 * Needs UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (storage).
 * RESEND_API_KEY (+ NOTIFY_EMAIL, RESEND_FROM, SITE_URL) enables the email
 * notifications; without it the team only sees chats on the /agent page.
 */

const crypto = require("crypto");
const L = require("./_lib");

const MAX_TEXT = 1000;
const MAX_MESSAGES = 300; // per conversation
const RENOTIFY_MS = 3 * 60 * 1000; // at most one email per 3 minutes per chat

const startLimited = L.limiter([[60 * 60 * 1000, 3], [24 * 60 * 60 * 1000, 8]]);
const sendLimited = L.limiter([[60 * 1000, 20], [24 * 60 * 60 * 1000, 400]]);
const pollLimited = L.limiter([[60 * 1000, 40]]);

const clean = (s, n) =>
  // eslint-disable-next-line no-control-regex
  String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, n);

const mKey = (id) => "dn:m:" + id;
const cKey = (id) => "dn:c:" + id;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (status, obj) => res.status(status).json(obj);

  if (!L.redisConfigured()) return send(503, { error: "Live chat isn't available right now." });
  const ip = L.clientIp(req);

  try {
    if (req.method === "GET") {
      if (pollLimited(ip)) return send(429, { error: "Too many requests." });
      const q = L.query(req);
      if (!L.ID_RE.test(q.id || "")) return send(400, { error: "Bad request." });
      const after = Math.max(0, Math.min(parseInt(q.after, 10) || 0, 100000));
      const [c, list] = await L.redis([["GET", cKey(q.id)], ["LRANGE", mKey(q.id), after, -1]]);
      const meta = L.parse(c);
      if (!meta) return send(404, { gone: true, error: "This chat has expired." });
      const messages = (list || []).map(L.parse).filter(Boolean);
      return send(200, { messages, next: after + (list || []).length, status: meta.status });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(405, { error: "Method not allowed." });
    }
    if (!L.originAllowed(req)) return send(403, { error: "Not allowed." });

    const b = req.body || {};
    const now = Date.now();

    // ---- start ----
    if (b.action === "start") {
      if (startLimited(ip)) return send(429, { error: "You've started several chats already. Please email hello@dotnapps.com." });
      const email = clean(b.email, 120);
      if (!L.EMAIL_RE.test(email)) return send(400, { error: "Please enter a valid email address." });
      const name = clean(b.name, 60);
      const page = clean(b.page, 100);
      const ctx = (Array.isArray(b.transcript) ? b.transcript : [])
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-10)
        .map((m) => ({ f: m.role === "user" ? "visitor" : "bot", t: clean(m.content, 500), ts: now }))
        .filter((m) => m.t);

      const id = crypto.randomBytes(16).toString("hex");
      const meta = { id, name, email, page, status: "waiting", created: now, updated: now, lastVisitor: now, lastAgent: 0, lastNotify: now };
      const first = ctx.concat([{ f: "sys", t: "Visitor asked to talk to a human.", ts: now }]);
      const [, , , , online] = await L.redis([
        ["SET", cKey(id), JSON.stringify(meta), "EX", L.TTL],
        ["RPUSH", mKey(id)].concat(first.map((m) => JSON.stringify(m))),
        ["EXPIRE", mKey(id), L.TTL],
        ["ZADD", "dn:idx", now, id],
        ["EXISTS", "dn:agent:seen"]
      ]);

      const lines = ctx.map((m) => (m.f === "visitor" ? "Visitor: " : "AI: ") + m.t).join("\n");
      await L.notifyTeam({
        subject: "New live chat on dotnapps.com" + (name ? " - " + name : ""),
        text:
          "A visitor wants to talk to a person.\n\n" +
          "Name: " + (name || "(not given)") + "\nEmail: " + email + "\nPage: " + (page || "/") + "\n\n" +
          (lines ? "Conversation so far:\n" + lines + "\n\n" : "") +
          "Reply here: " + L.SITE_URL() + "/agent#" + id + "\n" +
          "(You can also reply to this email to write to the visitor directly.)",
        replyTo: email
      });
      return send(200, { id, next: first.length, online: online === 1 });
    }

    // ---- send / end need an existing conversation ----
    const id = String(b.id || "");
    if (!L.ID_RE.test(id)) return send(400, { error: "Bad request." });
    if (sendLimited(ip)) return send(429, { error: "You're sending messages quickly. Please wait a moment." });

    const [c, len] = await L.redis([["GET", cKey(id)], ["LLEN", mKey(id)]]);
    const meta = L.parse(c);
    if (!meta) return send(404, { gone: true, error: "This chat has expired." });
    if (meta.status === "closed") return send(410, { closed: true, error: "This chat has ended." });

    if (b.action === "end") {
      meta.status = "closed";
      meta.updated = now;
      const m = { f: "sys", t: "Visitor ended the chat.", ts: now };
      await L.redis([
        ["RPUSH", mKey(id), JSON.stringify(m)],
        ["SET", cKey(id), JSON.stringify(meta), "EX", L.TTL],
        ["EXPIRE", mKey(id), L.TTL],
        ["ZADD", "dn:idx", now, id]
      ]);
      return send(200, { ok: true });
    }

    if (b.action === "send") {
      const text = clean(b.text, MAX_TEXT);
      if (!text) return send(400, { error: "Please type a message." });
      if (len >= MAX_MESSAGES) return send(429, { error: "This chat is full. Please email hello@dotnapps.com." });

      const shouldNotify = now - (meta.lastNotify || 0) > RENOTIFY_MS && now - (meta.lastAgent || 0) > RENOTIFY_MS;
      meta.updated = now;
      meta.lastVisitor = now;
      if (shouldNotify) meta.lastNotify = now;
      await L.redis([
        ["RPUSH", mKey(id), JSON.stringify({ f: "visitor", t: text, ts: now })],
        ["SET", cKey(id), JSON.stringify(meta), "EX", L.TTL],
        ["EXPIRE", mKey(id), L.TTL],
        ["ZADD", "dn:idx", now, id]
      ]);
      if (shouldNotify) {
        await L.notifyTeam({
          subject: "New message in live chat" + (meta.name ? " - " + meta.name : ""),
          text:
            (meta.name || meta.email) + " wrote:\n\n" + text + "\n\n" +
            "Reply here: " + L.SITE_URL() + "/agent#" + id,
          replyTo: meta.email
        });
      }
      return send(200, { ok: true, next: len + 1 });
    }

    return send(400, { error: "Bad request." });
  } catch (e) {
    console.error("live: failed:", e && e.message);
    return send(503, { error: "Live chat isn't available right now." });
  }
};
