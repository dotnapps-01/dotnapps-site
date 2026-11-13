"use strict";

/*
 * Shared helpers for the chat functions (files starting with "_" are not
 * exposed as API routes).
 */

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

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

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
  EMAIL_RE, query, ID_RE, TTL
};
