'use strict';
/* Shared helpers for the Dotnapps admin API. Files starting with "_" are not routed by Vercel. */
const crypto = require('crypto');

/* ---------------- storage ----------------
   Production: Upstash Redis over REST (Vercel Marketplace "Upstash for Redis" or Vercel KV set these env vars).
   Local testing only: DN_STORE=memory keeps everything in process memory. */
const mem = { kv: new Map(), hash: new Map(), ctr: new Map() };

function restConf() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
function storeKind() {
  if (process.env.DN_STORE === 'memory') return 'memory';
  return restConf() ? 'upstash' : null;
}
async function rest(args) {
  const c = restConf();
  const r = await fetch(c.url, { method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'store error ' + r.status);
  return j.result;
}
const store = {
  async get(k) {
    if (storeKind() === 'memory') return mem.kv.has(k) ? mem.kv.get(k) : null;
    return rest(['GET', k]);
  },
  async set(k, v) {
    if (storeKind() === 'memory') { mem.kv.set(k, v); return 'OK'; }
    return rest(['SET', k, v]);
  },
  async hgetall(k) {
    if (storeKind() === 'memory') return Object.fromEntries(mem.hash.get(k) || []);
    const flat = (await rest(['HGETALL', k])) || [];
    const o = {};
    for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
    return o;
  },
  async hset(k, f, v) {
    if (storeKind() === 'memory') { if (!mem.hash.has(k)) mem.hash.set(k, new Map()); mem.hash.get(k).set(f, v); return 1; }
    return rest(['HSET', k, f, v]);
  },
  async hget(k, f) {
    if (storeKind() === 'memory') { const m = mem.hash.get(k); return m && m.has(f) ? m.get(f) : null; }
    return rest(['HGET', k, f]);
  },
  async hdel(k, f) {
    if (storeKind() === 'memory') { const m = mem.hash.get(k); return m && m.delete(f) ? 1 : 0; }
    return rest(['HDEL', k, f]);
  },
  /* counter that expires after `ttl` seconds — used for rate limits */
  async incr(k, ttl) {
    if (storeKind() === 'memory') {
      const now = Date.now(), e = mem.ctr.get(k);
      if (!e || e.exp < now) { mem.ctr.set(k, { n: 1, exp: now + ttl * 1000 }); return 1; }
      e.n += 1; return e.n;
    }
    const n = await rest(['INCR', k]);
    if (n === 1) await rest(['EXPIRE', k, ttl]);
    return n;
  }
};

/* ---------------- http helpers ---------------- */
function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!(headers && headers['Cache-Control'])) res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
async function readBody(req, limit = 262144) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)); } catch (e) { return {}; }
  }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return {}; }
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

/* ---------------- admin auth ----------------
   One admin password in the ADMIN_PASSWORD env var. A login sets an HttpOnly, SameSite=Strict cookie holding an
   HMAC-signed expiry. Changing the password (or ADMIN_SECRET) signs everyone out. */
const COOKIE = 'dn_admin';
const SESSION_SECONDS = 12 * 3600;
function secret() {
  return process.env.ADMIN_SECRET || crypto.createHash('sha256').update('dn|' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
}
function b64u(s) { return Buffer.from(s).toString('base64url'); }
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function cookies(req) {
  const o = {};
  String(req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return o;
}
function passwordOk(pw) {
  const want = process.env.ADMIN_PASSWORD;
  if (!want || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest(), b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
function setSession(req, res) {
  const secure = !(req.headers['x-forwarded-proto'] === 'http' || process.env.DN_STORE === 'memory');
  const tok = sign({ exp: Date.now() + SESSION_SECONDS * 1000 });
  res.setHeader('Set-Cookie', COOKIE + '=' + tok + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_SECONDS + (secure ? '; Secure' : ''));
}
function clearSession(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}
function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  return !!verify(cookies(req)[COOKIE]);
}
/* Guard for admin endpoints. Writes also need our custom header and a same-site origin (CSRF defence in depth). */
function guard(req, res, write) {
  if (!process.env.ADMIN_PASSWORD || !storeKind()) { send(res, 503, { error: 'not_configured', password: !!process.env.ADMIN_PASSWORD, store: !!storeKind() }); return false; }
  if (!isAdmin(req)) { send(res, 401, { error: 'unauthorized' }); return false; }
  if (write) {
    const o = req.headers.origin;
    if (req.headers['x-dn-admin'] !== '1' || (o && new URL(o).host !== req.headers.host)) { send(res, 403, { error: 'forbidden' }); return false; }
  }
  return true;
}

/* ---------------- config (public and private) ---------------- */
const K_PUBLIC = 'dn:public', K_PRIVATE = 'dn:private', K_LEADS = 'dn:leads';
async function getJson(k, dflt) {
  try { const v = await store.get(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
}
const getPublic = () => getJson(K_PUBLIC, {});
const getPrivate = () => getJson(K_PRIVATE, {});

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s);
function urlOk(u, allowRelative) {
  if (!u) return '';
  if (allowRelative && /^\/[^/\\]/.test(u)) return u;
  try { const x = new URL(u); return x.protocol === 'https:' ? x.toString() : ''; } catch (e) { return ''; }
}
function cleanPublic(p) {
  p = p && typeof p === 'object' ? p : {};
  const out = { v: 1 };
  if (Array.isArray(p.taglines)) {
    out.taglines = p.taglines.slice(0, 12).map((t) => ({ a: str(t && t.a, 90), b: str(t && t.b, 90), on: !(t && t.on === false) })).filter((t) => t.a || t.b);
  }
  out.services = {};
  if (p.services && typeof p.services === 'object') {
    Object.keys(p.services).slice(0, 60).forEach((k) => {
      if (!slugOk(k)) return; const s = p.services[k] || {};
      const o = {};
      if (typeof s.lead === 'string') o.lead = str(s.lead, 700);
      if (Array.isArray(s.inc)) o.inc = s.inc.slice(0, 8).map((x) => str(x, 140)).filter(Boolean);
      if (typeof s.fit === 'string') o.fit = str(s.fit, 240);
      if (Object.keys(o).length) out.services[k] = o;
    });
  }
  out.products = {};
  if (p.products && typeof p.products === 'object') {
    Object.keys(p.products).slice(0, 40).forEach((k) => {
      if (!slugOk(k)) return; const d = str((p.products[k] || {}).desc, 200);
      if (d) out.products[k] = { desc: d };
    });
  }
  const s = p.settings && typeof p.settings === 'object' ? p.settings : {};
  const soc = s.social && typeof s.social === 'object' ? s.social : {};
  const em = str(s.email, 120);
  out.settings = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : '',
    social: { instagram: urlOk(str(soc.instagram, 300)), linkedin: urlOk(str(soc.linkedin, 300)), whatsapp: urlOk(str(soc.whatsapp, 300)), pinterest: urlOk(str(soc.pinterest, 300)) },
    banner: { on: !!(s.banner && s.banner.on), text: str(s.banner && s.banner.text, 200), link: urlOk(str(s.banner && s.banner.link, 300), true) }
  };
  return out;
}
const MASK = '********';
const FORMS = ['brief', 'contact', 'businessos', 'careers'];
function cleanPrivate(p, prev) {
  p = p && typeof p === 'object' ? p : {};
  const c = p.crm && typeof p.crm === 'object' ? p.crm : {};
  const old = (prev && prev.crm) || {};
  const header = str(c.headerName, 60).replace(/[^A-Za-z0-9-]/g, '');
  return {
    crm: {
      enabled: !!c.enabled,
      url: urlOk(str(c.url, 500)) || (devOk(str(c.url, 500)) ? str(c.url, 500) : ''),
      format: c.format === 'form' ? 'form' : c.format === 'flat' ? 'flat' : 'json',
      headerName: header,
      secret: c.secret === MASK ? (old.secret || '') : str(c.secret, 400),
      sources: Array.isArray(c.sources) ? c.sources.filter((s) => FORMS.indexOf(s) >= 0).filter((s, i, a) => a.indexOf(s) === i) : undefined
    }
  };
}
function devOk(u) { return process.env.DN_STORE === 'memory' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u); }
function maskPrivate(p) {
  const c = (p && p.crm) || {};
  return { crm: { enabled: !!c.enabled, url: c.url || '', format: c.format || 'json', headerName: c.headerName || '', secret: c.secret ? MASK : '', sources: Array.isArray(c.sources) ? c.sources : undefined } };
}

/* ---------------- CRM webhook ---------------- */
function blockedHost(host) {
  host = host.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '::1' || host.startsWith('[')) return true;
  return false;
}
async function forward(crm, lead, event) {
  const at = new Date().toISOString();
  if (!crm || !crm.enabled || !crm.url) return { status: 'off', at };
  if (event !== 'lead.test' && Array.isArray(crm.sources) && crm.sources.indexOf(lead.source) < 0) return { status: 'skipped', error: 'this form is not sent to the CRM', at };
  let u;
  try { u = new URL(crm.url); } catch (e) { return { status: 'failed', error: 'bad url', at }; }
  if (!devOk(crm.url) && (u.protocol !== 'https:' || blockedHost(u.hostname))) return { status: 'failed', error: 'url not allowed', at };
  const flat = { id: lead.id, created_at: lead.createdAt, source: lead.source, name: lead.name, email: lead.email, company: lead.company || '', message: lead.message || '', role: lead.role || '', link: lead.link || '', page: lead.page || '' };
  const headers = {};
  let body;
  if (crm.format === 'form') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(Object.assign({ event: event || 'lead.created' }, flat)).toString(); }
  else if (crm.format === 'flat') {
    /* the Dotnapps CRM's own website-form shape: name, email, company, message, page at the top level (the key goes in the header) */
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ name: flat.name, email: flat.email, company: flat.company, message: (flat.message + (flat.source ? '\n\n[Website form: ' + flat.source + ']' : '')).trim(), page: flat.page });
  }
  else { headers['Content-Type'] = 'application/json'; body = JSON.stringify({ event: event || 'lead.created', lead: flat }); }
  if (crm.headerName && crm.secret) headers[crm.headerName] = crm.secret;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(crm.url, { method: 'POST', headers, body, signal: ctl.signal, redirect: 'manual' });
    clearTimeout(t);
    if (r.status >= 200 && r.status < 300) return { status: 'sent', code: r.status, at };
    /* say why the CRM refused it: its own message, and whether a key header was sent at all */
    let why = '';
    try { const tx = (await r.text()).slice(0, 400); try { const j = JSON.parse(tx); why = String(j.error || j.message || ''); } catch (e2) { why = ''; } } catch (e3) { why = ''; }
    why = why.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 140).trim();
    const sent = crm.headerName && crm.secret ? ' [key header sent: ' + crm.headerName + ', ' + String(crm.secret).length + ' characters]' : ' [no key header was sent: fill in the header name and value]';
    return { status: 'failed', error: 'HTTP ' + r.status + (why ? ' - ' + why : '') + sent, code: r.status, at };
  } catch (e) { clearTimeout(t); return { status: 'failed', error: e.name === 'AbortError' ? 'timed out' : 'network error', at }; }
}

module.exports = { store, storeKind, send, readBody, clientIp, sha, secret, sign, verify, cookies, passwordOk, setSession, clearSession, isAdmin, guard, K_PUBLIC, K_PRIVATE, K_LEADS, getPublic, getPrivate, cleanPublic, cleanPrivate, maskPrivate, MASK, forward, str };
