"use strict";

/*
 * Shared helpers for the chat functions (files starting with "_" are not
 * exposed as API routes).
 */

const crypto = require("crypto");

const ALLOWED_HOSTS = /^(www\.dotnapps\.com|dotnapps\.com|localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+\.vercel\.app)$/i;

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
}

// Browsers always send Origin on cross-origin and on same-origin POSTs.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return ALLOWED_HOSTS.test(new URL(origin).host);
  } catch (e) {
    return false;
  }
}

/*
 * limiter([[windowMs, max], ...]) -> (key) => true when the key is over a
 * limit. In-memory, so each serverless instance counts separately:
 * best-effort protection only.
 */
function limiter(rules) {
  const hits = new Map();
  const longest = Math.max.apply(null, rules.map((r) => r[0]));
  return function limited(key) {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const times = (hits.get(key) || []).filter((t) => now - t < longest);
    const over = rules.some((r) => times.filter((t) => now - t < r[0]).length >= r[1]);
    if (!over) times.push(now);
    hits.set(key, times);
    return over;
  };
}

// ---- Upstash Redis over REST (free tier; no npm package needed) -----------
function redisUrl() {
  return (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/+$/, "");
}
function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
}
function redisConfigured() {
  return !!(redisUrl() && redisToken());
}

// Run several commands in one round trip. Returns the array of results.
async function redis(commands) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(redisUrl() + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + redisToken(), "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error("redis HTTP " + r.status);
    const out = await r.json();
    return out.map((o) => {
      if (o && o.error) throw new Error("redis: " + o.error);
      return o ? o.result : null;
    });
  } finally {
    clearTimeout(timer);
  }
}

function parse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

// ---- Email notifications via Resend (free tier) ---------------------------
const SITE_URL = () => (process.env.SITE_URL || "https://www.dotnapps.com").replace(/\/+$/, "");
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/*
 * Sends the team an email, unless the hourly/daily cap is hit (protects the
 * free quota from being burned by spam). Resolves true when an email was sent.
 */
async function notifyTeam(opts) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const d = new Date().toISOString();
    const hour = "dn:mail:h:" + d.slice(0, 13);
    const day = "dn:mail:d:" + d.slice(0, 10);
    const r = await redis([["INCR", hour], ["EXPIRE", hour, 3600], ["INCR", day], ["EXPIRE", day, 86400]]);
    if (r[0] > 20 || r[2] > 60) {
      console.error("chat: email cap reached, not sending");
      return false;
    }
    const body = {
      from: process.env.RESEND_FROM || "Dotnapps Chat <onboarding@resend.dev>",
      to: [process.env.NOTIFY_EMAIL || "hello@dotnapps.com"],
      subject: opts.subject,
      text: opts.text
    };
    if (opts.replyTo && EMAIL_RE.test(opts.replyTo)) body.reply_to = opts.replyTo;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal
      });
      if (!res.ok) throw new Error("resend HTTP " + res.status);
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error("chat: notify failed:", e && e.message);
    return false;
  }
}

function sameSecret(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function query(req) {
  try {
    return Object.fromEntries(new URL(req.url, "http://x").searchParams);
  } catch (e) {
    return {};
  }
}

const ID_RE = /^[a-f0-9]{32}$/;
const TTL = 3 * 24 * 3600; // conversations expire 3 days after the last message

module.exports = {
  clientIp, originAllowed, limiter,
  redis, redisConfigured, parse,
  notifyTeam, SITE_URL, EMAIL_RE,
  sameSecret, query, ID_RE, TTL
};
