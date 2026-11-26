// QR codes end to end over HTTP: create/validate/plan limit, redirect service + scan logging,
// status pages, bulk actions, folders, analytics export and cross-workspace isolation.
// Needs the DEV server (OTP dev provider):  npm run dev   then   npm run check:codes [baseUrl]
const B = process.argv[2] ?? "http://localhost:3000";
let pass = 0, fail = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar.h, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };

async function signUp(name) {
  const jar = new Jar(), phone = rnd();
  let x = await call(jar, "POST", "/api/auth/otp/send", { mode: "signup", phone, businessName: name });
  x = await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  await call(jar, "POST", "/api/onboarding", { industry: "food", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
const urlQr = (o = {}) => ({ name: "Menu link", type: "url", config: { url: "https://example.com/menu" }, publish: true, ...o });

const A = await signUp("Alpha Cafe");
const Bz = await signUp("Beta Salon");

// --- validation
let x = await call(A, "POST", "/api/qr", { name: "x", type: "url", config: {}, publish: true });
t(x.r.status === 422 && x.j.fields.name && x.j.fields["config.url"], "create: short name + missing URL -> 422 with field errors");
x = await call(A, "POST", "/api/qr", urlQr({ config: { url: "javascript:alert(1)" } }));
t(x.r.status === 422 && x.j.fields["config.url"], "create: javascript: URL rejected");
x = await call(A, "POST", "/api/qr", urlQr({ type: "product" }));
t(x.r.status === 422 && /generated in Products/.test(x.j.fields.type), "create: type whose page isn't built yet is refused");
x = await call(A, "POST", "/api/qr", urlQr({ design: { color: "#EEEEEE", variant: "dot", label: "SCAN ME" } }));
t(x.r.status === 422 && x.j.fields.design, "create: low-contrast colour rejected");
x = await call(A, "POST", "/api/qr", urlQr({ shortCode: "api" }));
t(x.r.status === 422 && x.j.fields.shortCode, "create: reserved short link rejected");
x = await call(A, "POST", "/api/qr", urlQr({ locationId: "00000000-0000-0000-0000-000000000000" }));
t(x.r.status === 422, "create: location from nowhere rejected");
x = await call(new Jar(), "POST", "/api/qr", urlQr());
t(x.r.status === 401, "create: logged out -> 401");

// --- create + redirect + scan log
const slug = "t-" + Math.random().toString(36).slice(2, 8);
x = await call(A, "POST", "/api/qr", urlQr({ shortCode: slug, name: "Table menu" }));
t(x.r.status === 201 && x.j.shortCode === slug && x.j.status === "active", "create: dynamic URL code published with custom slug", JSON.stringify(x.j));
const q1 = x.j.id;
x = await call(Bz, "POST", "/api/qr", urlQr({ shortCode: slug }));
t(x.r.status === 409, "create: another workspace can't take the same short link");
x = await call(A, "GET", "/api/qr/slug?slug=" + slug);
t(x.j.available === false, "slug check: taken slug reported unavailable");
x = await call(A, "GET", "/api/qr/slug?slug=free-" + slug);
t(x.j.available === true, "slug check: free slug available");

const phoneUA = { "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36", "accept-language": "ta-IN,ta;q=0.9", "x-forwarded-for": "203.0.113.7", "x-vercel-ip-city": "Chennai" };
let r = await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: phoneUA });
t((r.status === 307 || r.status === 302) && r.headers.get("location") === "https://example.com/menu", "redirect: /q/<code> -> destination", `${r.status} ${r.headers.get("location")}`);
await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: phoneUA }); // same visitor again (repeat)
await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: { ...phoneUA, "x-forwarded-for": "198.51.100.9", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari", "accept-language": "en-IN", "x-vercel-ip-city": "Coimbatore" } });
await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: { "user-agent": "facebookexternalhit/1.1" } }); // bot: must not count
await fetch(`${B}/q/${slug.toUpperCase()}`, { redirect: "manual", headers: { ...phoneUA, "x-forwarded-for": "192.0.2.55" } }); // case-insensitive code
r = await fetch(`${B}/q/nope-nope`, { redirect: "manual" });
t(r.status === 404, "redirect: unknown code -> 404");

// --- analytics export (CSV) proves scans were logged correctly
x = await fetch(`${B}/app/analytics/export?range=7d`, { headers: { cookie: A.h } });
const csv = await x.text();
const lines = csv.trim().split("\n");
t(x.status === 200 && /text\/csv/.test(x.headers.get("content-type")), "export: CSV served");
t(lines.length === 1 + 4, "scans: 4 human scans logged, bot ignored", `got ${lines.length - 1}\n${csv}`);
t(csv.includes("Chennai") && csv.includes("Coimbatore") && csv.includes("android") && csv.includes("iphone") && csv.includes(",ta") && csv.includes(",en"), "scans: city, device and language captured");
t(!csv.includes("203.0.113.7") && !csv.includes("Mozilla"), "scans: no raw IP or user agent stored in export");
x = await fetch(`${B}/app/analytics/export?range=7d`, { headers: { cookie: Bz.h } });
t((await x.text()).trim().split("\n").length === 1, "isolation: other workspace sees none of these scans");
x = await fetch(`${B}/app/analytics/export?range=7d`);
t(x.status === 307 || x.status === 401 || x.status === 302, "export: logged out is refused");

// --- status pages
const stat = async (id, body) => (await call(A, "POST", "/api/qr/actions", { ids: [id], ...body })).j;
const page = async (code) => { const rr = await fetch(`${B}/q/${code}`, { redirect: "manual", headers: phoneUA }); return { s: rr.status, html: rr.status === 200 ? await rr.text() : "" }; };
x = await stat(q1, { action: "pause" }); t(x.changed === 1, "bulk: pause active code");
let pg = await page(slug); t(pg.s === 200 && /paused/.test(pg.html), "redirect: paused code shows a friendly page, no redirect");
x = await stat(q1, { action: "resume" }); t(x.changed === 1, "bulk: resume");
pg = await page(slug); t(pg.s === 307 || pg.s === 302, "redirect: resumed code redirects again");
const draft = await call(A, "POST", "/api/qr", urlQr({ publish: false, name: "Draft code" }));
t(draft.j.status === "draft", "create: publish=false saves a draft");
pg = await page(draft.j.shortCode); t(pg.s === 200 && /isn.t published yet/.test(pg.html), "redirect: draft shows 'not published yet'");
x = await stat(draft.j.id, { action: "archive" }); t(x.changed === 1, "bulk: archive a draft");
pg = await page(draft.j.shortCode); t(pg.s === 404, "redirect: archived code -> 404");
const past = new Date(Date.now() - 3600e3).toISOString(), earlier = new Date(Date.now() - 7200e3).toISOString(), future = new Date(Date.now() + 86400e3).toISOString();
const exp = await call(A, "POST", "/api/qr", urlQr({ name: "Expired code", startsAt: earlier, endsAt: past }));
pg = await page(exp.j.shortCode); t(pg.s === 200 && /expired/.test(pg.html), "redirect: past end date shows 'expired'");
const sch = await call(A, "POST", "/api/qr", urlQr({ name: "Scheduled code", startsAt: future }));
pg = await page(sch.j.shortCode); t(pg.s === 200 && /isn.t live yet/.test(pg.html), "redirect: future start shows 'not live yet'");
x = await call(A, "POST", "/api/qr", urlQr({ startsAt: future, endsAt: past }));
t(x.r.status === 422 && x.j.fields.endsAt, "create: end before start rejected");

// --- plan limit (Free = 3 dynamic non-archived: Table menu, Expired, Scheduled)
x = await call(A, "POST", "/api/qr", urlQr({ name: "One too many" }));
t(x.r.status === 403 && x.j.error === "plan_limit" && x.j.limit === 3, "plan: Free workspace can't exceed 3 dynamic codes", JSON.stringify(x.j));
x = await call(A, "POST", "/api/qr/actions", { ids: [draft.j.id], action: "restore" });
t(x.r.status === 403 && x.j.error === "plan_limit", "plan: restoring an archived code is also limited");

// --- static codes are unlimited and never get a short link
const wifi = await call(A, "POST", "/api/qr", { name: "Guest Wi-Fi", type: "wifi", dynamic: true, config: { ssid: "Cafe_Guest", password: "pa;ss:word", security: "WPA/WPA2" }, publish: true });
t(wifi.r.status === 201 && wifi.j.shortCode === null, "static: Wi-Fi code created beyond the limit, no short link (dynamic request ignored)", JSON.stringify(wifi.j));
x = await call(A, "POST", "/api/qr", { name: "Pay", type: "upi", config: { vpa: "cafe@okbank", name: "Alpha Cafe", amount: "150" }, publish: true });
t(x.r.status === 201 && x.j.shortCode === null, "static: UPI code created");
x = await call(A, "POST", "/api/qr", { name: "Pay bad", type: "upi", config: { vpa: "not a upi id" }, publish: true });
t(x.r.status === 422 && x.j.fields["config.vpa"], "validation: bad UPI ID rejected");
x = await call(A, "POST", "/api/qr", { name: "Static site", type: "url", dynamic: false, config: { url: "example.org" }, publish: true });
t(x.r.status === 201 && x.j.shortCode === null, "static: a URL code can be made static (dynamic:false)");

// --- other dynamic types resolve to the right destinations (use workspace B, own limit)
const wa = await call(Bz, "POST", "/api/qr", { name: "Chat", type: "wa", config: { number: "98765 43210", message: "Hi there" }, publish: true });
r = await fetch(`${B}/q/${wa.j.shortCode}`, { redirect: "manual", headers: phoneUA });
t(r.headers.get("location") === "https://wa.me/919876543210?text=Hi%20there", "destination: WhatsApp number normalised to wa.me link", r.headers.get("location"));
const maps = await call(Bz, "POST", "/api/qr", { name: "Find us", type: "maps", config: { query: "Anna Nagar, Chennai" }, publish: true });
r = await fetch(`${B}/q/${maps.j.shortCode}`, { redirect: "manual", headers: phoneUA });
t(r.headers.get("location") === "https://www.google.com/maps/search/?api=1&query=Anna%20Nagar%2C%20Chennai", "destination: maps address -> search link", r.headers.get("location"));

// --- edit: destination changes, identity doesn't
x = await call(A, "PATCH", `/api/qr/${q1}`, { name: "Table menu v2", config: { url: "https://example.com/new-menu" }, type: "wa", shortCode: "hacked", dynamic: false });
t(x.r.status === 200 && x.j.shortCode === slug, "edit: type, short code and dynamic flag cannot be changed");
r = await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: phoneUA });
t(r.headers.get("location") === "https://example.com/new-menu", "edit: printed code now points to the new destination");
x = await call(Bz, "PATCH", `/api/qr/${q1}`, { name: "stolen", config: { url: "https://evil.example" } });
t(x.r.status === 404, "isolation: another workspace can't edit this code");
x = await call(Bz, "POST", "/api/qr/actions", { ids: [q1], action: "archive" });
t(x.j.changed === 0, "isolation: another workspace can't archive this code");
r = await fetch(`${B}/q/${slug}`, { redirect: "manual", headers: phoneUA });
t(r.status === 307 || r.status === 302, "isolation: code still live after those attempts");

// --- folders + move
x = await call(A, "POST", "/api/folders", { name: "Table tents" });
t(x.r.status === 201, "folders: create");
const folder = x.j.id;
x = await call(A, "POST", "/api/folders", { name: "Table tents" });
t(x.r.status === 409, "folders: duplicate name -> 409");
x = await call(A, "POST", "/api/qr/actions", { ids: [q1], action: "move", folderId: folder });
t(x.j.changed === 1, "folders: move a code into a folder");
x = await call(Bz, "POST", "/api/qr/actions", { ids: [wa.j.id], action: "move", folderId: folder });
t(x.r.status === 422, "isolation: can't move into another workspace's folder");
x = await call(A, "POST", "/api/qr/actions", { ids: [q1], action: "explode" });
t(x.r.status === 422, "actions: unknown action rejected");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
