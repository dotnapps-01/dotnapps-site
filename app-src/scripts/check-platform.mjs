// Platform over HTTP: settings & data, API keys + the /v1 API, signed webhooks, serialized product codes
// (batches, authenticity, warranty), the admin console and plan gating.
//
// Start the DEV server with an admin number:
//   ADMIN_PHONES=+919000000001 npm run dev
// and, to test real webhook delivery to a receiver this script starts on localhost, also WEBHOOK_ALLOW_PRIVATE=1.
// Without that variable the script checks the opposite: that private and internal addresses are refused.
//   npm run check:platform [baseUrl]
// Set DATABASE_URL (the server's database) to also run the checks that need to reach into it (retention purge,
// workspace deletion leaving nothing behind).
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const B = process.argv[2] ?? "http://localhost:3000";
let pass = 0, fail = 0, skipped = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const skip = (msg) => { skipped++; console.log("SKIP", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar?.h ?? "", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar?.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };
const page = async (jar, path, headers = {}) => { const r = await fetch(B + path, { headers: { cookie: jar?.h ?? "", ...headers }, redirect: "manual" }); return { s: r.status, html: await r.text() }; };
const waitFor = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; };

async function signUp(name, phone = rnd()) {
  const jar = new Jar();
  for (let i = 0; i < 4; i++) {
    const x = await call(jar, "POST", "/api/auth/otp/send", { mode: "signup", phone, businessName: name });
    if (x.r.status === 429) { await sleep((x.j.retryAfter ?? 30) * 1000 + 500); continue; }
    if (!x.j.devCode) throw new Error(`could not sign up ${name}: ${x.r.status} ${JSON.stringify(x.j)}`);
    await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
    break;
  }
  await call(jar, "POST", "/api/onboarding", { industry: "retail", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
const UA = (n, city) => ({ "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36", "x-forwarded-for": `203.0.113.${n}`, ...(city ? { "x-vercel-ip-city": city } : {}) });
const anon = null;
const ymd = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dayPlus = (n) => ymd(new Date(Date.now() + n * 86400e3));
const addMonths = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const hasDb = !!process.env.DATABASE_URL;
let db = null;
if (hasDb) { const { default: pgmod } = await import("pg"); db = new pgmod.Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); }

const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
const admin = await signUp("Skanor Staff", ADMIN_PHONE);
const A = await signUp("Aqua Corp");        // gets Enterprise from the admin
const E = await signUp("Spare Works");      // a second Enterprise tenant, for isolation
const F = await signUp("Free Shop");        // stays Free
const tenantId = async (name) => { const p = await page(admin, `/app/admin?q=${encodeURIComponent(name)}`); return (p.html.match(new RegExp(`data-tenant="([0-9a-f-]{36})" data-name="${name}"`)) ?? [])[1]; };

/* =============================== ADMIN GATING =============================== */
let x = await page(F, "/app/admin"); t(x.s === 404, "admin: a normal owner gets a 404 for the console");
x = await page(anon, "/app/admin"); t(x.s === 404 || x.s === 307 || x.s === 302, "admin: logged out can't see the console");
x = await call(F, "PATCH", "/api/admin/tenants/00000000-0000-0000-0000-000000000000", { plan: "enterprise" }); t(x.r.status === 404, "admin: a normal owner can't change a plan");
x = await call(F, "PUT", "/api/admin/flags", { key: "signups_open", enabled: false }); t(x.r.status === 404, "admin: ...or a platform switch");
x = await call(F, "POST", "/api/admin/impersonate", { workspaceId: "00000000-0000-0000-0000-000000000000" }); t(x.r.status === 404, "admin: ...or view as a tenant");
x = await call(anon, "POST", "/api/admin/impersonate", {}); t(x.r.status === 404, "admin: logged out can't view as a tenant either");
const adminPage = await page(admin, "/app/admin");
t(adminPage.s === 200 && adminPage.html.includes("Admin console") && adminPage.html.includes("Aqua Corp") && /Plan mix/.test(adminPage.html) && /System health/.test(adminPage.html), "admin: staff see tenants, plan mix and system health");
t(/₹\[0\.00\] L/.test(adminPage.html), "admin: MRR keeps its placeholder until billing exists");
const sidebar = await page(admin, "/app/dashboard"); t(sidebar.html.includes('href="/app/admin"'), "admin: the console link is in staff's sidebar");
const sidebarF = await page(F, "/app/dashboard"); t(!sidebarF.html.includes('href="/app/admin"'), "admin: ...and not in anyone else's");
const idA = await tenantId("Aqua Corp"), idE = await tenantId("Spare Works"), idF = await tenantId("Free Shop");
t(!!idA && !!idE && !!idF, "admin: each tenant row carries its id");
x = await page(admin, "/app/admin?q=aqua"); t(x.html.includes("Aqua Corp") && !x.html.includes("Free Shop"), "admin: search narrows the tenant list");
x = await page(admin, "/app/admin?filter=suspended"); t(!x.html.includes('data-name="Aqua Corp"'), "admin: the suspended filter hides active tenants");

/* =============================== PLAN GATING =============================== */
x = await call(F, "POST", "/api/keys", { name: "Packaging line", scope: "read" }); t(x.r.status === 403 && x.j.error === "plan_required", "plans: API keys need Enterprise");
x = await call(F, "POST", "/api/webhooks", { url: "https://example.com/hook", events: ["lead.created"] }); t(x.r.status === 403 && x.j.error === "plan_required", "plans: webhooks need Enterprise");
x = await call(F, "POST", "/api/products", { name: "Water purifier" }); t(x.r.status === 403 && x.j.error === "plan_required", "plans: product codes need Enterprise");
x = await page(F, "/app/products"); t(x.s === 200 && /part of the Enterprise plan/.test(x.html), "plans: the Products screen explains the plan");
x = await page(F, "/app/integrations?tab=api"); t(x.s === 200 && /part of the Enterprise plan/.test(x.html), "plans: the API tab explains the plan");
x = await call(admin, "PATCH", `/api/admin/tenants/${idA}`, { plan: "platinum" }); t(x.r.status === 422, "admin: an unknown plan is refused");
x = await call(admin, "PATCH", "/api/admin/tenants/nope", { plan: "enterprise" }); t(x.r.status === 404, "admin: an unknown tenant is not found");
for (const id of [idA, idE]) { x = await call(admin, "PATCH", `/api/admin/tenants/${id}`, { plan: "enterprise" }); t(x.r.status === 200, "admin: plan set to Enterprise"); }
x = await page(A, "/app/settings"); t(/Enterprise/.test(x.html) && x.html.includes("Plan changed") && x.html.includes("free → enterprise") && x.html.includes("Skanor admin"), "admin: the plan change is in the tenant's own audit log, attributed to Skanor staff");

/* =============================== SETTINGS =============================== */
x = await call(F, "PATCH", "/api/settings/profile", { name: "F", gstin: "bad", industry: "nope", defaultLang: "fr" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.gstin && x.j.fields.industry && x.j.fields.defaultLang, "settings: invalid profile refused field by field");
x = await call(F, "PATCH", "/api/settings/profile", { name: "Free Shop & Co", industry: "salon", gstin: "33abcde1234f1z5", defaultLang: "ta" }); t(x.r.status === 200, "settings: profile saved (GSTIN upper-cased)");
x = await page(F, "/app/settings"); t(x.html.includes("Free Shop &amp; Co") && x.html.includes("33ABCDE1234F1Z5") && /Business profile updated/.test(x.html), "settings: the screen shows the saved profile and logs the change");
x = await call(anon, "PATCH", "/api/settings/profile", { name: "Nope Nope" }); t(x.r.status === 401, "settings: logged out -> 401");
x = await call(F, "POST", "/api/locations", { name: "R" }); t(x.r.status === 422, "locations: a short name is refused");
x = await call(F, "POST", "/api/locations", { name: "Peelamedu", address: "Coimbatore" }); t(x.r.status === 201, "locations: a second location added"); const loc2 = x.j.id;
x = await call(F, "PATCH", `/api/locations/${loc2}`, { name: "Peelamedu Main", address: "Coimbatore 641004" }); t(x.r.status === 200, "locations: renamed");
x = await call(E, "PATCH", `/api/locations/${loc2}`, { name: "Hijack" }); t(x.r.status === 404, "isolation: another workspace can't edit a location");
x = await page(F, "/app/settings"); const primaryId = (x.html.match(/aria-label="Edit ([^"]+)"/g) ?? []).length; t(primaryId >= 2 && x.html.includes("Peelamedu Main"), "locations: both are listed");
x = await call(F, "DELETE", `/api/locations/${loc2}`); t(x.r.status === 200, "locations: a non-primary location can be removed");
x = await call(F, "POST", "/api/locations", { name: "Saibaba Colony" }); const loc3 = x.j.id;
x = await call(F, "PATCH", `/api/locations/${loc3}`, { primary: true }); t(x.r.status === 200, "locations: make another location primary");
x = await call(F, "DELETE", `/api/locations/${loc3}`); t(x.r.status === 409, "locations: the primary location can't be removed");
x = await call(F, "PUT", "/api/settings/retention", { keep: "6" }); t(x.r.status === 422, "retention: an unknown period is refused");
if (db) {
  const w = (await db.query("select id from workspaces where id = $1", [idF])).rows[0];
  const q = await call(F, "POST", "/api/qr", { name: "Old scans", type: "url", config: { url: "https://example.com" }, publish: true });
  const qrId = (await db.query("select id from qr_codes where short_code = $1", [q.j.shortCode])).rows[0].id;
  await db.query("insert into scans (qr_id, workspace_id, visitor, scanned_at) values ($1,$2,'v1', now() - interval '30 months'), ($1,$2,'v2', now() - interval '2 months')", [qrId, w.id]);
  x = await call(F, "PUT", "/api/settings/retention", { keep: "12" }); t(x.r.status === 200 && x.j.removed.scans === 1, "retention: choosing 12 months deletes the 30-month-old scan and keeps the recent one", JSON.stringify(x.j));
  const left = (await db.query("select count(*)::int as n from scans where workspace_id = $1", [w.id])).rows[0].n; t(left === 1, "retention: one scan is left");
  x = await call(F, "PUT", "/api/settings/retention", { keep: "forever" }); t(x.r.status === 200 && x.j.removed.scans === 0, "retention: forever keeps everything");
} else skip("retention purge (set DATABASE_URL)");
// exports
await call(F, "POST", "/api/tickets", { title: "=cmd|' /C calc'!A0 broken", category: "Other" });
for (const k of ["contacts", "leads", "tickets", "bookings", "reviews", "scans"]) {
  const r = await fetch(`${B}/api/export/${k}`, { headers: { cookie: F.h } }); const body = await r.text();
  t(r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && body.split("\n")[0].includes(","), `export: ${k} downloads as CSV`);
}
const tk = await (await fetch(`${B}/api/export/tickets`, { headers: { cookie: F.h } })).text();
t(tk.includes("'=cmd") && !/(^|,|\n)=cmd/.test(tk), "export: a title that looks like a formula is neutralised");
const other = await (await fetch(`${B}/api/export/tickets`, { headers: { cookie: E.h } })).text();
t(!other.includes("cmd"), "isolation: another workspace's export has none of it");
x = await fetch(`${B}/api/export/passwords`, { headers: { cookie: F.h } }); t(x.status === 404, "export: an unknown dataset is not found");
x = await fetch(`${B}/api/export/contacts`); t(x.status === 401, "export: logged out -> 401");

/* =============================== API KEYS & /v1 =============================== */
x = await call(A, "POST", "/api/keys", { name: "x", scope: "read" }); t(x.r.status === 422 && x.j.fields.name, "keys: a short name is refused");
x = await call(A, "POST", "/api/keys", { name: "Packaging line", scope: "root" }); t(x.r.status === 422 && x.j.fields.scope, "keys: an unknown scope is refused");
const mk = async (name, scope, jar = A) => (await call(jar, "POST", "/api/keys", { name, scope })).j.key;
x = await call(A, "POST", "/api/keys", { name: "Reader", scope: "read" }); t(x.r.status === 201 && /^sk_live_[\w-]{30,}$/.test(x.j.key), "keys: a read key is created and shown once");
const readKey = x.j.key, readId = x.j.id;
const writeKey = await mk("Packaging line", "qr:write"), allKey = await mk("ERP", "all"), rlKey = await mk("Rate test", "read");
x = await page(A, "/app/integrations?tab=api"); t(x.html.includes("Reader") && x.html.includes(`••••••${readKey.slice(-4)}`) && !x.html.includes(readKey), "keys: the screen shows the last 4 only, never the key");
const H = (k) => ({ authorization: `Bearer ${k}` });
x = await call(anon, "GET", "/v1/qr"); t(x.r.status === 401 && x.j.error?.code === "unauthorized", "v1: no key -> 401");
x = await call(anon, "GET", "/v1/qr", undefined, H("sk_live_" + "x".repeat(32))); t(x.r.status === 401, "v1: a wrong key -> 401");
x = await call(anon, "GET", "/v1/qr", undefined, { authorization: "Basic abc" }); t(x.r.status === 401, "v1: a non-bearer header -> 401");
x = await call(anon, "GET", "/v1/qr", undefined, H(readKey)); t(x.r.status === 200 && Array.isArray(x.j.data), "v1: GET /v1/qr works (the /v1 path is rewritten)");
x = await call(anon, "POST", "/v1/qr", { name: "From API", type: "url", config: { url: "https://example.com" } }, H(readKey)); t(x.r.status === 403 && x.j.error.code === "insufficient_scope", "v1: a read key can't create");
x = await call(anon, "POST", "/v1/qr", { name: "From API", type: "url", config: { url: "javascript:alert(1)" }, publish: true }, H(writeKey)); t(x.r.status === 422 && x.j.error.fields["config.url"], "v1: a bad field -> 422 with the field");
x = await call(anon, "POST", "/v1/qr", { name: "From API", type: "url", config: { url: "https://example.com/menu" }, publish: true }, H(writeKey)); t(x.r.status === 201 && x.j.data.short_url?.includes(x.j.data.short_code), "v1: a write key creates a QR code with its short URL");
const apiQr = x.j.data;
x = await call(anon, "GET", `/v1/qr/${apiQr.id}`, undefined, H(readKey)); t(x.r.status === 200 && x.j.data.name === "From API" && x.j.data.scans_30d === 0, "v1: GET one QR code");
x = await call(anon, "GET", "/v1/qr", undefined, H(readKey)); t(x.j.data.some((q) => q.id === apiQr.id), "v1: it appears in the list");
x = await call(anon, "GET", `/v1/qr/${apiQr.id}`, undefined, H(await mk("Other tenant", "read", E))); t(x.r.status === 404, "isolation: another tenant's key can't read it");
x = await call(anon, "GET", "/v1/qr/not-an-id", undefined, H(readKey)); t(x.r.status === 404, "v1: a malformed id -> 404");
x = await page(A, "/app/settings"); t(/QR code created through the API/.test(x.html) && /API key/.test(x.html), "v1: creating through the API is in the audit log");
x = await call(A, "DELETE", `/api/keys/${readId}`); t(x.r.status === 200, "keys: a key is revoked");
x = await call(anon, "GET", "/v1/qr", undefined, H(readKey)); t(x.r.status === 401, "v1: a revoked key stops working at once");
x = await call(E, "DELETE", `/api/keys/${readId}`); t(x.r.status === 404, "isolation: another workspace can't revoke a key");
let limited = 0; for (let i = 0; i < 125; i++) { x = await call(anon, "GET", "/v1/qr/not-an-id", undefined, H(rlKey)); if (x.r.status === 429) limited++; }
t(limited >= 3 && x.j.error?.retry_after === 60, `v1: more than 120 requests a minute on one key are refused (${limited} of 125)`);

/* =============================== PRODUCTS =============================== */
x = await call(A, "POST", "/api/products", { name: "A" }); t(x.r.status === 422 && x.j.fields.name, "products: a short name is refused");
x = await call(A, "POST", "/api/products", { name: "AquaPure RO 8L", warrantyMonths: 200 }); t(x.r.status === 422 && x.j.fields.warrantyMonths, "products: warranty over 120 months refused");
x = await call(A, "POST", "/api/products", { name: "AquaPure RO 8L", buyUrl: "javascript:alert(1)" }); t(x.r.status === 422 && x.j.fields.buyUrl, "products: a javascript: link is refused");
x = await call(A, "POST", "/api/products", { name: "AquaPure RO 8L", model: "RO 8L", madeIn: "Chennai", warrantyMonths: 12, manualUrl: "example.com/manual.pdf", buyUrl: "https://example.com/filters" }); t(x.r.status === 201, "products: created"); const prod = x.j.id;
x = await call(A, "POST", "/api/products/batches", { productId: prod, quantity: 0, prefix: "AQ-26-" }); t(x.r.status === 422 && x.j.fields.quantity, "batches: zero codes refused");
x = await call(A, "POST", "/api/products/batches", { productId: prod, quantity: 20001, prefix: "AQ-26-" }); t(x.r.status === 422 && x.j.fields.quantity, "batches: over 20,000 refused");
x = await call(A, "POST", "/api/products/batches", { productId: prod, quantity: 10, prefix: "a b" }); t(x.r.status === 422 && x.j.fields.prefix, "batches: a prefix with spaces refused");
x = await call(A, "POST", "/api/products/batches", { productId: "00000000-0000-0000-0000-000000000000", quantity: 10, prefix: "AQ-" }); t(x.r.status === 404, "batches: an unknown product is not found");
x = await call(E, "POST", "/api/products/batches", { productId: prod, quantity: 10, prefix: "AQ-26-" }); t(x.r.status === 404, "isolation: another workspace can't make codes for the product");
x = await call(A, "POST", "/api/products/batches", { productId: prod, quantity: 100, prefix: "aq-26-", format: "a4" }); t(x.r.status === 201 && x.j.label === "B-01" && x.j.firstSerial === "AQ-26-000001" && x.j.lastSerial === "AQ-26-000100", "batches: 100 codes, prefix upper-cased, B-01");
const b1 = x.j;
x = await call(A, "POST", "/api/products/batches", { productId: prod, quantity: 50, prefix: "AQ-26-" }); t(x.j.label === "B-02" && x.j.firstSerial === "AQ-26-000101", "batches: numbering continues after the last serial with that prefix");
const csvRes = await fetch(`${B}/api/products/batches/${b1.id}/export`, { headers: { cookie: A.h } }); const csv = await csvRes.text(); const rows = csv.trim().split("\n");
t(csvRes.status === 200 && rows[0] === "serial,url" && rows.length === 101 && /^AQ-26-000001,https?:\/\/[^/]+\/p\/[0-9a-f]{16}$/.test(rows[1]), "batches: CSV has a header and one URL per serial");
const tokens = rows.slice(1).map((r) => r.split("/p/")[1]); t(new Set(tokens).size === 100, "batches: every code has its own secret token");
const tokenOf = (n) => tokens[n - 1];
x = await fetch(`${B}/api/products/batches/${b1.id}/export`, { headers: { cookie: E.h } }); t(x.status === 404, "isolation: another workspace can't download the codes");
x = await fetch(`${B}/api/products/batches/${b1.id}/export`); t(x.status === 401, "batches: logged out -> 401");
x = await page(A, "/app/products?tab=batches"); t(x.s === 200 && x.html.includes("B-01") && x.html.includes("PRINTING") && x.html.includes("AQ-26-000001"), "batches: the screen lists them");
x = await page(A, `/print/batch/${b1.id}`); t(x.s === 200 && x.html.includes("AQ-26-000001") && x.html.includes("AQ-26-000060") && !x.html.includes("AQ-26-000061"), "print sheet: 60 codes on page 1");
x = await page(A, `/print/batch/${b1.id}?page=2`); t(x.html.includes("AQ-26-000061") && x.html.includes("AQ-26-000100") && (x.html.match(/<svg/g) ?? []).length >= 40, "print sheet: page 2 has the rest, as real QR codes");
x = await page(F, `/print/batch/${b1.id}`); t(x.s === 404, "print sheet: another workspace gets a 404");
x = await call(A, "PATCH", `/api/products/batches/${b1.id}`); t(x.r.status === 200, "batches: marked in market");
x = await page(A, "/app/products?tab=batches"); t(x.html.includes("IN MARKET"), "batches: now reads IN MARKET");

// the buyer's page
x = await page(anon, `/p/${tokenOf(1)}`, UA(1)); t(x.s === 200 && x.html.includes('data-verdict="first"') && x.html.includes("AquaPure RO 8L") && x.html.includes("AQ-26-000001"), "product page: the first scan reads genuine");
x = await page(anon, `/p/${tokenOf(1)}`, UA(1)); t(x.html.includes('data-verdict="again"'), "product page: the same phone again reads 'scanned before on this phone', not a warning");
x = await page(anon, `/p/${tokenOf(1)}`, UA(2)); t(x.html.includes('data-verdict="scanned_before"') && /scanned before/i.test(x.html), "product page: another phone reads 'scanned before'");
x = await call(anon, "GET", "/v1/codes/AQ-26-000001", undefined, H(allKey)); t(x.r.status === 200 && x.j.data.scan_count === 2 && x.j.data.activated === true && x.j.data.flagged === false && x.j.data.batch === "B-01", "v1: GET /v1/codes/{serial} counts 2 scans (the repeat on one phone isn't counted again)", JSON.stringify(x.j));
x = await page(anon, `/p/${tokenOf(1)}`, UA(3)); t(x.html.includes('data-verdict="scanned_before"'), "product page: a third device");
x = await call(anon, "GET", "/v1/codes/AQ-26-000001", undefined, H(allKey)); t(x.j.data.flagged === true, "product: three different devices flag the code");
x = await page(A, "/app/products?tab=authenticity"); t(x.html.includes("MANY DEVICES") && x.html.includes("AQ-26-000001") && /Scanned from 3 different devices/.test(x.html), "authenticity: a MANY DEVICES alert is raised, once");
x = await page(anon, `/p/${tokenOf(2)}`, UA(10, "Madurai")); t(x.html.includes('data-verdict="first"'), "product page: a second code, first scan (Madurai)");
x = await page(anon, `/p/${tokenOf(2)}`, UA(11, "Kolkata")); t(x.html.includes('data-verdict="scanned_before"') && x.html.includes("Madurai") && x.html.includes("Kolkata"), "product page: the warning shows the first scan's place and this one");
x = await page(A, "/app/products?tab=authenticity"); t(/Scanned in Madurai and Kolkata within 1 hour/.test(x.html), "authenticity: a TWO CITIES alert names both places");
x = await page(anon, "/p/0123456789abcdef", UA(1)); t(x.s === 404, "product page: an unknown token -> 404");
x = await page(anon, "/p/short", UA(1)); t(x.s === 404, "product page: a malformed token -> 404");
x = await page(anon, `/p/${tokenOf(3)}?lang=ta`, UA(12)); t(x.html.includes('lang="ta"') && x.html.includes("உண்மையான"), "product page: Tamil");
x = await page(anon, `/p/${tokenOf(4)}?lang=hi`, UA(13)); t(x.html.includes('lang="hi"') && x.html.includes("असली"), "product page: Hindi");
x = await page(anon, `/p/${tokenOf(5)}`, { "user-agent": "Googlebot/2.1", "x-forwarded-for": "198.51.100.9" }); t(x.s === 200, "product page: a robot opening it doesn't count as a scan");
x = await call(anon, "GET", "/v1/codes/AQ-26-000005", undefined, H(allKey)); t(x.j.data.scan_count === 0 && x.j.data.activated === false, "product: ...so the code is still unscanned");

// warranty
const wr = (tok, body, ua = UA(20)) => call(anon, "POST", "/api/p/warranty", { token: tok, ...body }, ua);
x = await wr(tokenOf(6), { name: "R" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone && x.j.fields.purchasedOn, "warranty: name, phone and date required");
x = await wr(tokenOf(6), { name: "Ramesh Gopalan", phone: "98765 00210", purchasedOn: dayPlus(3) }); t(x.r.status === 422 && x.j.fields.purchasedOn, "warranty: a purchase date in the future refused");
x = await wr("0123456789abcdef", { name: "Ramesh Gopalan", phone: "98765 00210", purchasedOn: dayPlus(0) }); t(x.r.status === 404, "warranty: an unknown code -> 404");
x = await wr(tokenOf(6), { name: "Bot", phone: "98765 00299", purchasedOn: dayPlus(0), website: "x" }, UA(21)); t(x.r.status === 200 && !x.j.validUntil, "warranty: honeypot short-circuits");
x = await wr(tokenOf(6), { name: "Ramesh Gopalan", phone: "98765 00210", purchasedOn: dayPlus(0), boughtFrom: "Sri Ganesh Electricals", invoiceNo: "INV-221" });
t(x.r.status === 201 && x.j.status === "verified" && x.j.validUntil === addMonths(dayPlus(0), 12), `warranty: registered and verified; valid until ${x.j.validUntil} (12 months)`, JSON.stringify(x.j));
x = await wr(tokenOf(6), { name: "Ramesh G", phone: "+91 98765 00210", purchasedOn: dayPlus(0) }); t(x.r.status === 200 && x.j.created === false, "warranty: the same number again gets its registration back");
x = await wr(tokenOf(6), { name: "Someone Else", phone: "98765 00211", purchasedOn: dayPlus(0) }, UA(22)); t(x.r.status === 409 && x.j.error === "already_registered", "warranty: a different number on a registered code is refused");
x = await page(A, "/app/products?tab=authenticity"); t(x.html.includes("REGISTERED TWICE") && x.html.includes("AQ-26-000006"), "authenticity: ...and raises a REGISTERED TWICE alert");
x = await wr(tokenOf(7), { name: "Lakshmi P.", phone: "98765 00551", purchasedOn: dayPlus(-40) }, UA(23)); t(x.r.status === 201 && x.j.status === "review", "warranty: a purchase date before the batch was made is held for review");
x = await page(A, "/app/products?tab=warranty"); t(x.html.includes("Ramesh Gopalan") && x.html.includes("Lakshmi P.") && !x.html.includes("9876500210") && /\+91 98xxx xx210/.test(x.html), "warranty: the owner sees registrations with masked phones");
const wid = (x.html.match(/data-warranty="([0-9a-f-]{36})" data-customer="Lakshmi P\."/) ?? [])[1]; t(!!wid, "warranty: each row carries its id");
x = await call(A, "PATCH", `/api/products/warranty/${wid}`, { status: "maybe" }); t(x.r.status === 422, "warranty: an unknown decision refused");
x = await call(E, "PATCH", `/api/products/warranty/${wid}`, { status: "verified" }); t(x.r.status === 404, "isolation: another workspace can't decide a warranty");
x = await call(A, "PATCH", `/api/products/warranty/${wid}`, { status: "verified" }); t(x.r.status === 200, "warranty: verified by the owner");
x = await page(anon, `/p/${tokenOf(6)}`, UA(20)); t(/Ramesh G\./.test(x.html) === false && /Until/.test(x.html) && !x.html.includes("98765"), "product page: shows the warranty date, with no name or number of the buyer");
// report + service
const rp = (tok, body, ua = UA(30)) => call(anon, "POST", "/api/p/report", { token: tok, ...body }, ua);
x = await rp(tokenOf(8), { note: "x" }); t(x.r.status === 422 && x.j.fields.note, "report: a note is needed");
x = await rp(tokenOf(8), { note: "Bought from a roadside seller in Madurai" }); t(x.r.status === 201, "report: a buyer reports a seller");
x = await page(A, "/app/products?tab=authenticity"); t(x.html.includes("BUYER REPORT") && x.html.includes("roadside seller"), "authenticity: the report is an alert");
let rl = 0; for (let i = 0; i < 4; i++) { x = await rp(tokenOf(8), { note: "Another report " + i }, UA(31)); if (x.r.status === 429) rl++; } t(rl >= 1, `report: one visitor is throttled (${rl} refused)`);
const sv = (tok, body, ua = UA(40)) => call(anon, "POST", "/api/p/service", { token: tok, ...body }, ua);
x = await sv(tokenOf(9), { name: "A" }); t(x.r.status === 422 && x.j.fields.problem && x.j.fields.phone, "service: name, phone and problem needed");
x = await sv(tokenOf(9), { name: "Abdul R.", phone: "98765 00887", problem: "Water is leaking from the bottom" }); t(x.r.status === 201 && /^t[\w-]{22}$/.test(x.j.token), "service: a service request becomes a ticket");
x = await call(anon, "GET", `/api/o/${x.j.token}`); t(x.j.kind === "t" && /Service: AquaPure RO 8L · AQ-26-000009/.test(x.j.data.title), "service: the buyer can follow it on their own link");
x = await page(A, "/app/tickets"); t(x.html.includes("PRODUCT QR") && x.html.includes("AQ-26-000009"), "service: it is in the owner's Tickets, from PRODUCT QR");
// alerts
const alertsPage = await page(A, "/app/products?tab=authenticity");
const aid = (alertsPage.html.match(/data-alert="([0-9a-f-]{36})"/) ?? [])[1]; t(!!aid, "authenticity: each alert carries its id");
x = await call(A, "PATCH", `/api/products/alerts/${aid}`, { status: "wat" }); t(x.r.status === 422, "alerts: an unknown status refused");
x = await call(E, "PATCH", `/api/products/alerts/${aid}`, { status: "dismissed" }); t(x.r.status === 404, "isolation: another workspace can't touch an alert");
x = await call(A, "PATCH", `/api/products/alerts/${aid}`, { status: "investigating" }); t(x.r.status === 200, "alerts: marked investigating");
x = await call(A, "PATCH", `/api/products/alerts/${aid}`, { status: "dismissed" }); t(x.r.status === 200, "alerts: dismissed");
x = await page(A, "/app/products"); t(/Suspected fakes/.test(x.html) && /Codes issued/.test(x.html) && x.html.includes("150"), "products: the overview shows the numbers (150 codes issued)");
x = await page(A, "/app/dashboard"); t(/href="\/app\/products"[^>]*>[^]*?<\/a>/.test(x.html), "products: the sidebar links to Products");
// v1 batches
x = await call(anon, "POST", "/v1/batches", { product_id: prod, quantity: 5, prefix: "API-" }, H(await mk("Reader 2", "read"))); t(x.r.status === 403, "v1: a read key can't generate batches");
x = await call(anon, "POST", "/v1/batches", { product_id: prod, quantity: 5, prefix: "x" }, H(writeKey)); t(x.r.status === 422 && x.j.error.fields.prefix, "v1: a bad prefix -> 422");
x = await call(anon, "POST", "/v1/batches", { product_id: prod, quantity: 5, prefix: "API-" }, H(writeKey)); t(x.r.status === 201 && x.j.data.codes.length === 5 && x.j.data.first_serial === "API-000001" && /\/p\/[0-9a-f]{16}$/.test(x.j.data.codes[0].url), "v1: a write key generates a batch and gets every URL");
x = await call(anon, "POST", "/v1/batches", { product_id: prod, quantity: 5, prefix: "API-" }, H(await mk("E key", "all", E))); t(x.r.status === 404, "isolation: another tenant's key can't use the product");
x = await call(anon, "GET", "/v1/codes/AQ-26-000001", undefined, H(await mk("E reader", "read", E))); t(x.r.status === 404, "isolation: another tenant's key can't look up the serial");
// retire
x = await call(A, "DELETE", `/api/products/${prod}`); t(x.r.status === 200, "products: a product is hidden");
x = await page(A, "/app/products?tab=products"); t(!x.html.includes("AquaPure RO 8L") || /No products yet/.test(x.html), "products: it leaves the list");
x = await page(anon, `/p/${tokenOf(20)}`, UA(50)); t(x.s === 200 && x.html.includes("AquaPure RO 8L"), "products: codes already printed keep working");

/* =============================== WEBHOOKS =============================== */
const hits = [];
let respond = { status: 200, headers: {} };
const receiver = createServer((req, res) => { let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => { hits.push({ url: req.url, headers: req.headers, body, at: Date.now() }); res.writeHead(respond.status, respond.headers); res.end("ok"); }); });
await new Promise((r) => receiver.listen(0, "127.0.0.1", r));
const rport = receiver.address().port;
const hook = `http://127.0.0.1:${rport}/hook`;
x = await call(A, "POST", "/api/webhooks", { url: "ftp://example.com/x", events: ["lead.created"] }); t(x.r.status === 422 && x.j.fields.url, "webhooks: a non-https address refused");
x = await call(A, "POST", "/api/webhooks", { url: "javascript:alert(1)", events: ["lead.created"] }); t(x.r.status === 422 && x.j.fields.url, "webhooks: javascript: refused");
x = await call(A, "POST", "/api/webhooks", { url: "https://user:pass@example.com/x", events: ["lead.created"] }); t(x.r.status === 422 && x.j.fields.url, "webhooks: credentials in the address refused");
x = await call(A, "POST", "/api/webhooks", { url: "not a url", events: ["lead.created"] }); t(x.r.status === 422 && x.j.fields.url, "webhooks: nonsense refused");
x = await call(A, "POST", "/api/webhooks", { url: "https://example.com/x", events: [] }); t(x.r.status === 422 && x.j.fields.events, "webhooks: at least one event needed");
x = await call(A, "POST", "/api/webhooks", { url: "https://example.com/x", events: ["made.up"] }); t(x.r.status === 422 && x.j.fields.events, "webhooks: unknown events are dropped, leaving none");
const probe = await call(A, "POST", "/api/webhooks", { url: hook, events: ["ticket.created"] });
if (probe.r.status === 422) {
  // the server refuses private addresses (the production behaviour)
  t(!!probe.j.fields.url, "webhooks: an http:// address on this machine is refused");
  for (const u of ["https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://10.0.0.5/x", "https://192.168.1.10/x", "https://[::1]/x", "https://[::ffff:127.0.0.1]/x", "https://metadata.internal/x"]) {
    x = await call(A, "POST", "/api/webhooks", { url: u, events: ["lead.created"] }); t(x.r.status === 422 && x.j.fields.url, `webhooks: ${u} is refused`);
  }
  skip("signed delivery to a local receiver (start the server with WEBHOOK_ALLOW_PRIVATE=1)");
} else {
  t(probe.r.status === 201 && /^whsec_[\w-]{30,}$/.test(probe.j.secret), "webhooks: an endpoint is created and its secret shown once");
  const ep1 = probe.j.id, secret1 = probe.j.secret;
  x = await call(A, "POST", "/api/webhooks", { url: hook + "2", events: ["lead.created"] }); const ep2 = x.j.id;
  x = await page(A, "/app/integrations?tab=webhooks"); t(x.html.includes(hook) && !x.html.includes(secret1), "webhooks: the screen lists the endpoint and never the secret");
  x = await call(E, "PATCH", `/api/webhooks/${ep1}`, { url: hook, events: ["lead.created"], active: true }); t(x.r.status === 404, "isolation: another workspace can't edit the endpoint");
  hits.length = 0;
  x = await call(A, "POST", "/api/tickets", { title: "Lift stuck on 3rd floor", category: "Facility" }); t(x.r.status === 201, "webhooks: a ticket is raised");
  t(await waitFor(() => hits.some((h) => h.url === "/hook")), "webhooks: the subscribed endpoint is called");
  const h1 = hits.find((h) => h.url === "/hook");
  const payload = JSON.parse(h1.body);
  t(h1.headers["skanor-event"] === "ticket.created" && payload.type === "ticket.created" && payload.data.title === "Lift stuck on 3rd floor" && h1.headers["skanor-delivery"] === payload.id, "webhooks: event header, JSON body and a delivery id");
  const sig = Object.fromEntries(h1.headers["skanor-signature"].split(",").map((p) => p.split("="))); const expected = createHmac("sha256", secret1).update(`${sig.t}.${h1.body}`).digest("hex");
  t(sig.v1 === expected && Math.abs(Date.now() / 1000 - Number(sig.t)) < 30, "webhooks: the signature verifies with the endpoint's secret");
  await sleep(600); t(!hits.some((h) => h.url === "/hook2"), "webhooks: an endpoint not subscribed to the event isn't called");
  x = await page(A, "/app/integrations?tab=webhooks"); t(x.html.includes("ticket.created") && /HTTP 200/.test(x.html) && /HEALTHY/.test(x.html), "webhooks: the screen shows the delivery and a healthy endpoint");
  // scan event
  x = await call(A, "POST", "/api/webhooks", { url: hook + "3", events: ["scan.created", "counterfeit.flagged"] }); const ep3 = x.j.id;
  const q = await call(A, "POST", "/api/qr", { name: "Scan me", type: "url", config: { url: "https://example.com" }, publish: true });
  await fetch(`${B}/q/${q.j.shortCode}`, { redirect: "manual", headers: UA(60) });
  t(await waitFor(() => hits.some((h) => h.url === "/hook3" && JSON.parse(h.body).type === "scan.created")), "webhooks: a QR scan sends scan.created");
  // failure and retry
  respond = { status: 500, headers: {} }; hits.length = 0;
  await call(A, "POST", "/api/tickets", { title: "Fails the first time", category: "Facility" });
  t(await waitFor(() => hits.filter((h) => h.url === "/hook").length >= 2, 8000), "webhooks: a failed delivery is tried once more straight away");
  await sleep(400);
  x = await page(A, "/app/integrations?tab=webhooks"); t(/1 FAILURE/.test(x.html) && /HTTP 500/.test(x.html), "webhooks: the screen shows the failure");
  respond = { status: 302, headers: { location: `http://127.0.0.1:${rport}/elsewhere` } }; hits.length = 0;
  x = await call(A, "POST", `/api/webhooks/${ep1}/test`); t(x.r.status === 200 && x.j.delivered === false && x.j.status === 302, "webhooks: a redirect is a failure, never followed");
  await sleep(300); t(!hits.some((h) => h.url === "/elsewhere"), "webhooks: ...the redirect target was never called");
  respond = { status: 200, headers: {} };
  x = await call(A, "POST", `/api/webhooks/${ep1}/test`); t(x.j.delivered === true && x.j.status === 200, "webhooks: the Send test button delivers a ping");
  x = await call(E, "POST", `/api/webhooks/${ep1}/test`); t(x.r.status === 404, "isolation: another workspace can't send a test");
  x = await page(A, "/app/integrations?tab=webhooks"); t(/HEALTHY/.test(x.html), "webhooks: a good delivery clears the failures");
  // pause
  x = await call(A, "PATCH", `/api/webhooks/${ep1}`, { url: hook, events: ["ticket.created"], active: false }); t(x.r.status === 200, "webhooks: an endpoint is paused");
  hits.length = 0; await call(A, "POST", "/api/tickets", { title: "While paused", category: "Facility" }); await sleep(1200); t(!hits.some((h) => h.url === "/hook"), "webhooks: a paused endpoint isn't called");
  x = await call(A, "PATCH", `/api/webhooks/${ep1}`, { url: hook, events: ["ticket.created"], active: true }); t(x.r.status === 200, "webhooks: ...and resumed");
  // platform switch
  x = await call(admin, "PUT", "/api/admin/flags", { key: "webhooks_delivery", enabled: false }); t(x.r.status === 200, "admin: webhook delivery switched off");
  hits.length = 0; await call(A, "POST", "/api/tickets", { title: "While switched off", category: "Facility" }); await sleep(1200); t(!hits.some((h) => h.url === "/hook"), "admin: ...and nothing is sent while it is off");
  x = await call(admin, "PUT", "/api/admin/flags", { key: "webhooks_delivery", enabled: true }); t(x.r.status === 200, "admin: ...switched back on");
  hits.length = 0; await call(A, "POST", "/api/tickets", { title: "After switch on", category: "Facility" }); t(await waitFor(() => hits.some((h) => h.url === "/hook")), "admin: delivery resumes");
  // product event
  const toks = (await (await fetch(`${B}/api/products/batches/${b1.id}/export`, { headers: { cookie: A.h } })).text()).trim().split("\n").slice(1).map((r) => r.split("/p/")[1]);
  hits.length = 0;
  for (let i = 0; i < 3; i++) await page(anon, `/p/${toks[40]}`, UA(70 + i));
  t(await waitFor(() => hits.some((h) => h.url === "/hook3" && JSON.parse(h.body).type === "counterfeit.flagged")), "webhooks: a code looking copied sends counterfeit.flagged");
  x = await call(A, "DELETE", `/api/webhooks/${ep2}`); t(x.r.status === 200, "webhooks: an endpoint is removed");
  x = await call(A, "DELETE", `/api/webhooks/${ep3}`); void ep3;
}
receiver.close();

/* =============================== SUSPEND, VIEW AS, SWITCHES =============================== */
const qf = await call(F, "POST", "/api/qr", { name: "Free code", type: "url", config: { url: "https://example.com" }, publish: true });
let r = await fetch(`${B}/q/${qf.j.shortCode}`, { redirect: "manual", headers: UA(80) }); t(r.status === 307 || r.status === 302, "suspend: a live code redirects");
x = await call(admin, "PATCH", `/api/admin/tenants/${idF}`, { suspended: true }); t(x.r.status === 200, "suspend: the admin suspends a tenant");
r = await fetch(`${B}/q/${qf.j.shortCode}`, { redirect: "manual", headers: UA(80) }); let txt = await r.text(); t(r.status === 200 && /paused/i.test(txt), "suspend: their codes now read as paused");
x = await page(F, "/app/dashboard"); t(/This account is paused/.test(x.html), "suspend: the owner sees why, instead of the app");
x = await call(F, "POST", "/api/tickets", { title: "Still working?", category: "Other" }); t(x.r.status === 201 || x.r.status === 403, "suspend: (the owner's own APIs aren't the point of the switch)");
x = await page(F, "/app/settings"); t(/This account is paused/.test(x.html), "suspend: every app screen shows the notice");
x = await page(admin, "/app/admin?filter=suspended"); t(x.html.includes('data-name="Free Shop &amp; Co"') || x.html.includes("Free Shop"), "suspend: the suspended filter lists them");
// view as
x = await call(admin, "POST", "/api/admin/impersonate", { workspaceId: idF }); t(x.r.status === 200, "view-as: an admin starts viewing a tenant");
x = await page(admin, "/app/dashboard"); t(/you are viewing/.test(x.html) && x.html.includes("Free Shop"), "view-as: a banner says whose workspace it is, and the app shows it even while paused");
x = await page(admin, "/app/admin"); t(x.s === 200, "view-as: the admin keeps admin rights while viewing");
x = await call(admin, "POST", "/api/settings/delete", { confirm: "Free Shop & Co" }); t(x.r.status === 409, "view-as: an admin can't delete the tenant's workspace");
x = await call(admin, "PATCH", "/api/settings/profile", { name: "Free Shop & Co", industry: "salon", defaultLang: "ta" }); t(x.r.status === 200, "view-as: changes are possible");
x = await page(admin, "/app/settings"); t(/Skanor admin/.test(x.html) && /viewed this workspace/.test(x.html) && /account paused|Account paused/i.test(x.html), "view-as: the tenant's audit log records the viewing and the suspension");
x = await call(admin, "POST", "/api/admin/impersonate/exit"); t(x.r.status === 200, "view-as: exit");
x = await page(admin, "/app/dashboard"); t(!/you are viewing/.test(x.html) && x.html.includes("Skanor Staff"), "view-as: back to the admin's own workspace");
x = await call(admin, "POST", "/api/admin/impersonate/exit"); t(x.r.status === 409, "view-as: exiting when not viewing is refused");
x = await call(admin, "PATCH", `/api/admin/tenants/${idF}`, { suspended: false }); t(x.r.status === 200, "suspend: resumed");
r = await fetch(`${B}/q/${qf.j.shortCode}`, { redirect: "manual", headers: UA(80) }); t(r.status === 307 || r.status === 302, "suspend: their codes work again");
x = await page(F, "/app/dashboard"); t(!/This account is paused/.test(x.html), "suspend: and the owner is back in the app");
// the API key of a suspended tenant
x = await call(admin, "PATCH", `/api/admin/tenants/${idE}`, { suspended: true });
x = await call(anon, "GET", "/v1/qr", undefined, H(await (async () => { await call(admin, "PATCH", `/api/admin/tenants/${idE}`, { suspended: false }); const k = await mk("Suspend test", "read", E); await call(admin, "PATCH", `/api/admin/tenants/${idE}`, { suspended: true }); return k; })()));
t(x.r.status === 403 && x.j.error.code === "suspended", "suspend: a suspended tenant's API key is refused");
await call(admin, "PATCH", `/api/admin/tenants/${idE}`, { suspended: false });
// switches
const newPhone = rnd();
x = await call(admin, "PUT", "/api/admin/flags", { key: "bogus", enabled: false }); t(x.r.status === 422, "switches: an unknown switch is refused");
x = await call(admin, "PUT", "/api/admin/flags", { key: "signups_open", enabled: false }); t(x.r.status === 200, "switches: sign-ups closed");
x = await call(new Jar(), "POST", "/api/auth/otp/send", { mode: "signup", phone: newPhone, businessName: "Late Joiner" }); t(x.r.status === 403 && x.j.error === "signups_closed", "switches: a new number can't sign up while it is off");
{ const j = new Jar(); const s = await call(j, "POST", "/api/auth/otp/send", { mode: "login", phone: "98765 11111" }); void s; }
const existing = await call(new Jar(), "POST", "/api/auth/otp/send", { mode: "login", phone: ADMIN_PHONE }); t(existing.r.status === 200 || existing.r.status === 429, "switches: a number that already has a workspace can still log in");
x = await call(admin, "PUT", "/api/admin/flags", { key: "signups_open", enabled: true }); t(x.r.status === 200, "switches: sign-ups open again");
x = await call(new Jar(), "POST", "/api/auth/otp/send", { mode: "signup", phone: newPhone, businessName: "Late Joiner" }); t(x.r.status === 200, "switches: and a new number can sign up");

/* =============================== DELETE A WORKSPACE =============================== */
const D = await signUp("Doomed Ltd");
const idD = await tenantId("Doomed Ltd");
await call(D, "POST", "/api/qr", { name: "Doomed code", type: "url", config: { url: "https://example.com" }, publish: true });
await call(D, "POST", "/api/tickets", { title: "A ticket", category: "Other", customerPhone: "98765 00001" });
x = await call(D, "POST", "/api/settings/delete", { confirm: "Not my name" }); t(x.r.status === 422 && x.j.fields.confirm, "delete: the wrong business name is refused");
x = await call(anon, "POST", "/api/settings/delete", { confirm: "Doomed Ltd" }); t(x.r.status === 401, "delete: logged out -> 401");
x = await call(D, "POST", "/api/settings/delete", { confirm: "doomed ltd" }); t(x.r.status === 200, "delete: the right name deletes the workspace (case doesn't matter)");
x = await page(D, "/app/dashboard"); t(x.s === 307 || x.s === 302 || x.s === 200 && !x.html.includes("Doomed Ltd"), "delete: they are signed out");
x = await call(D, "GET", "/api/export/contacts"); t(x.r.status === 401, "delete: and the data is gone from their session");
if (db) {
  const left = (await db.query("select (select count(*) from workspaces where id = $1) + (select count(*) from qr_codes where workspace_id = $1) + (select count(*) from tickets where workspace_id = $1) + (select count(*) from contacts where workspace_id = $1) as n", [idD])).rows[0].n;
  t(Number(left) === 0, "delete: nothing is left behind in the database");
} else skip("nothing left behind after delete (set DATABASE_URL)");
x = await page(admin, "/app/admin?q=Doomed"); t(!x.html.includes('data-name="Doomed Ltd"'), "delete: the tenant is gone from the admin list");

if (db) await db.end();
console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
