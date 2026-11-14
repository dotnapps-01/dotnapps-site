"use strict";

/*
 * POST /api/chat — Dotnapps website assistant.
 *
 * Request : { messages: [{ role: "user" | "assistant", content: string }, ...] }
 * Response: { reply: string }   or   { error: string }  with a non-200 status
 *
 * Tries free LLM tiers in order and moves to the next on any failure
 * (rate limit, outage, retired model, empty answer):
 *   1. Groq models, newest first: GROQ_MODEL, GROQ_FALLBACK_MODEL (if set), then
 *      openai/gpt-oss-120b, llama-3.3-70b-versatile, openai/gpt-oss-20b,
 *      llama-3.1-8b-instant. At most 3 Groq models are tried per request, and a
 *      model Groq says no longer exists is skipped until the instance restarts.
 *   2. Gemini  GEMINI_MODEL (default gemini-2.5-flash)
 * A provider is skipped when its API key is not set. If all fail, the widget
 * shows a "contact us" message instead. Failures are logged (provider, HTTP
 * status and the provider's error text, never the visitor's message), so
 * Vercel -> Logs shows exactly why.
 *
 * Environment variables (Vercel -> Settings -> Environment Variables):
 *   GROQ_API_KEY, GEMINI_API_KEY  (set at least one)
 *   GROQ_MODEL, GROQ_FALLBACK_MODEL, GEMINI_MODEL  (optional overrides)
 */

const { buildPrompt } = require("./_knowledge");
const { clientIp, originAllowed, limiter } = require("./_chatlib");

const MAX_HISTORY = 8; // messages sent to the model (keeps token use low)
const MAX_CHARS = 500; // per user message
const MAX_OUT_TOKENS = 400;
const ATTEMPT_TIMEOUT_MS = 8000;
const DEADLINE_MS = 25000;

// Per-IP limits (in-memory, best-effort: each serverless instance counts separately).
const limited = limiter([[60 * 1000, 10], [24 * 60 * 60 * 1000, 80]]);

// Validate and trim the client-supplied conversation.
function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  let msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      // eslint-disable-next-line no-control-regex
      content: m.content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, MAX_CHARS)
    }))
    .filter((m) => m.content);
  msgs = msgs.slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift(); // must start with the visitor
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

async function post(url, headers, body, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    if (!r.ok) {
      let body = "";
      try { body = (await r.text()).slice(0, 300); } catch (e) { /* ignore */ }
      const err = new Error("HTTP " + r.status + (body ? " " + body.replace(/\s+/g, " ") : ""));
      err.status = r.status;
      err.body = body;
      throw err;
    }
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function askGroq(model, msgs, ms) {
  const body = {
    model,
    messages: [{ role: "system", content: buildPrompt(msgs) }].concat(msgs),
    temperature: 0.3
  };
  if (/gpt-oss/.test(model)) {
    // Reasoning models count their thinking against the output budget, so keep
    // the effort low and leave room for the visible answer.
    body.reasoning_effort = "low";
    body.max_completion_tokens = 1000;
  } else {
    body.max_tokens = MAX_OUT_TOKENS;
  }
  const data = await post(
    "https://api.groq.com/openai/v1/chat/completions",
    { Authorization: "Bearer " + process.env.GROQ_API_KEY },
    body,
    ms
  );
  return data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

async function askGemini(model, msgs, ms) {
  const generationConfig = { temperature: 0.3, maxOutputTokens: MAX_OUT_TOKENS };
  // 2.5 Flash "thinks" by default and thinking tokens eat the output budget.
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const data = await post(
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
    { "x-goog-api-key": process.env.GEMINI_API_KEY },
    {
      systemInstruction: { parts: [{ text: buildPrompt(msgs) }] },
      contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig
    },
    ms
  );
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return parts && parts.map((p) => p.text || "").join("");
}

// Groq retires models from time to time. A model that reports "not found" or
// "decommissioned" is remembered and skipped, so every request isn't slowed down.
const deadModels = new Set();
const modelGone = (e) =>
  !!e && (e.status === 404 || /model_not_found|model_decommissioned|decommission|does not exist|no longer supported/i.test(e.body || ""));
const GROQ_DEFAULTS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
const MAX_GROQ_TRIES = 3;

function providers() {
  const list = [];
  if (process.env.GROQ_API_KEY) {
    const names = [process.env.GROQ_MODEL, process.env.GROQ_FALLBACK_MODEL].concat(GROQ_DEFAULTS)
      .filter((m, i, a) => m && a.indexOf(m) === i && !deadModels.has(m))
      .slice(0, MAX_GROQ_TRIES);
    names.forEach((model) => {
      list.push({
        name: "groq:" + model,
        run: (m, ms) => askGroq(model, m, ms).catch((e) => {
          if (modelGone(e)) deadModels.add(model);
          throw e;
        })
      });
    });
  }
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    list.push({ name: "gemini:" + model, run: (m, ms) => askGemini(model, m, ms) });
  }
  return list;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (status, obj) => res.status(status).json(obj);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(405, { error: "Method not allowed." });
  }
  if (!originAllowed(req)) return send(403, { error: "Not allowed." });
  if (limited(clientIp(req))) {
    res.setHeader("Retry-After", "60");
    return send(429, { error: "You're sending messages quickly. Please wait a minute and try again." });
  }

  const msgs = cleanMessages(req.body && req.body.messages);
  if (!msgs) return send(400, { error: "Please type a message." });

  const list = providers();
  if (!list.length) {
    console.error("chat: no GROQ_API_KEY or GEMINI_API_KEY configured");
    return send(503, { error: "The assistant isn't available right now." });
  }

  const started = Date.now();
  for (const p of list) {
    const left = DEADLINE_MS - (Date.now() - started);
    if (left < 1500) break;
    try {
      const text = await p.run(msgs, Math.min(ATTEMPT_TIMEOUT_MS, left));
      const reply = typeof text === "string" ? text.trim().slice(0, 1200) : "";
      if (reply) return send(200, { reply });
      console.error("chat: empty reply from", p.name);
    } catch (e) {
      // Log the provider and reason only — never the visitor's message.
      console.error("chat: provider failed:", p.name, e && e.message);
    }
  }
  return send(503, { error: "The assistant is busy right now." });
};
