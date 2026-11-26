// Operate over HTTP: tickets & assets, attendance & visitors, bookings & events, real-estate plots, and workspace isolation.
// Needs the DEV server:  npm run dev   then   npm run check:ops [baseUrl]
// Set DATABASE_URL (same database as the server) to also run the checks that need time to pass
// (check-out after check-in, late arrivals, cancelling a booking in the past); without it they are skipped.
const B = process.argv[2] ?? "http://localhost:3000";
let pass = 0, fail = 0, skipped = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const skip = (msg) => { skipped++; console.log("SKIP", msg); };
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar?.h ?? "", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar?.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };
async function signUp(name) {
  const jar = new Jar(), phone = rnd();
  const x = await call(jar, "POST", "/api/auth/otp/send", { mode: "signup", phone, businessName: name });
  await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  await call(jar, "POST", "/api/onboarding", { industry: "services", goals: ["tickets"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
const page = async (jar, path, headers = {}) => { const r = await fetch(B + path, { headers: { cookie: jar?.h ?? "", ...headers }, redirect: "manual" }); return { s: r.status, html: await r.text() }; };
const mkQr = (jar, type, name, config) => call(jar, "POST", "/api/qr", { name, type, config, publish: true });
const UA = (n) => ({ "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36", "x-forwarded-for": `203.0.113.${n}` });
const anon = null;
const ymd = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dayPlus = (n) => ymd(new Date(Date.now() + n * 86400e3));
const dow = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

// A: tickets, assets, attendance (3 codes). B: visitors, bookings (3). C: plots (1). D: the outsider.
const A = await signUp("Tech Park Facilities"), Bw = await signUp("Glow Salon"), C = await signUp("Green Meadows"), D = await signUp("Outsider Co");
const dbUrl = process.env.DATABASE_URL;
let db = null;
if (dbUrl) { const { default: pgmod } = await import("pg"); db = new pgmod.Client({ connectionString: dbUrl }); await db.connect(); }

/* =============================== TICKETS =============================== */
let x = await call(A, "POST", "/api/tickets", { title: "x" }); t(x.r.status === 422 && x.j.fields.title, "tickets: short title refused");
x = await call(A, "POST", "/api/tickets", { title: "AC too cold near window", category: "Nope" }); t(x.r.status === 422 && x.j.fields.category, "tickets: unknown category refused");
x = await call(A, "POST", "/api/tickets", { title: "AC too cold near window", category: "Facility", priority: "high", place: "Hall 1", customerPhone: "123" }); t(x.r.status === 422 && x.j.fields.customerPhone, "tickets: bad customer number refused");
x = await call(A, "POST", "/api/tickets", { title: "AC too cold near window", category: "Facility", priority: "high", place: "Hall 1", assignee: "Meena S." });
t(x.r.status === 201 && x.j.seq === 1, "tickets: manual ticket gets #1"); const manualId = x.j.id;
x = await call(A, "POST", "/api/tickets", { title: "Lift 2 stuck at 3rd floor", category: "Facility" }); t(x.j.seq === 2, "tickets: numbers count up per workspace");
x = await call(anon, "POST", "/api/tickets", { title: "Nope nope" }); t(x.r.status === 401, "tickets: logged out -> 401");

x = await mkQr(A, "ticket", "Washroom QR", {}); t(x.r.status === 422 && x.j.fields["config.place"], "QR: a ticket code needs a place");
x = await mkQr(A, "ticket", "Washroom QR", { place: "Washroom 2", category: "Housekeeping" }); t(x.r.status === 201 && x.j.shortCode, "QR: ticket code created"); const tCode = x.j.shortCode;
let r = await fetch(`${B}/q/${tCode}`, { redirect: "manual", headers: UA(1) });
t((r.status === 307 || r.status === 302) && new URL(r.headers.get("location"), B).pathname === `/s/${tCode}`, "scan: /q/<code> -> /s/<code>");
let pg = await page(anon, `/s/${tCode}`, UA(1)); t(pg.s === 200 && pg.html.includes("Washroom 2") && pg.html.includes("Tech Park Facilities"), "ticket page: renders with the place");
const send = (body, h = UA(2)) => call(anon, "POST", "/api/s/ticket", { code: tCode, ...body }, h);
x = await send({}); t(x.r.status === 422 && x.j.fields.details, "customer ticket: nothing chosen or written -> 422");
x = await send({ problem: "Teleportation" }); t(x.r.status === 422 && x.j.fields.problem, "customer ticket: a problem that isn't offered is refused");
x = await send({ problem: "Cleaning", phone: "12" }); t(x.r.status === 422 && x.j.fields.phone, "customer ticket: bad phone refused");
x = await send({ problem: "Cleaning", details: "No water in tap 2", name: "Divya", phone: "98765 00118" }); t(x.r.status === 201 && x.j.seq === 3 && /^t[\w-]{22}$/.test(x.j.token), "customer ticket: raised (#3) with a status token", JSON.stringify(x.j));
const tok = x.j.token;
x = await send({ problem: "Cleaning", website: "x" }, UA(3)); t(x.r.status === 200 && !x.j.seq, "customer ticket: honeypot short-circuits");
x = await call(anon, "POST", "/api/s/ticket", { code: "nope-nope", details: "hello there" }, UA(4)); t(x.r.status === 404, "customer ticket: unknown code -> 404");
let lim = 0; for (let i = 0; i < 10; i++) { x = await send({ details: "Spam ticket number " + i }, UA(99)); if (x.r.status === 429) lim++; } t(lim >= 2, `customer ticket: one visitor is throttled (${lim} of 10 refused)`);

x = await call(anon, "GET", `/api/o/${tok}`); t(x.r.status === 200 && x.j.kind === "t" && x.j.data.seq === 3 && x.j.data.status === "open" && x.j.data.events.length >= 1 && !JSON.stringify(x.j).includes("98765"), "status link: shows status and public updates, no phone number");
x = await call(anon, "GET", `/api/o/t${"x".repeat(22)}`); t(x.r.status === 404, "status link: unknown token -> 404");
x = await call(anon, "GET", `/api/o/zzz`); t(x.r.status === 404, "status link: malformed token -> 404");
pg = await page(A, "/app/tickets"); const id3 = (pg.html.match(/ticket=([0-9a-f-]{36})[^]{0,400}?#3/) ?? [])[1];
t(pg.s === 200 && pg.html.includes("No water in tap 2") || pg.html.includes("Cleaning"), "owner: tickets screen lists the customer's ticket");
const row3 = await (async () => { const r2 = await page(A, "/app/tickets"); return r2.html; })(); void row3; void id3;
// find ticket 3's id through the owner list API surface: use the detail page links
const ids = [...pg.html.matchAll(/ticket=([0-9a-f-]{36})/g)].map((m) => m[1]);
t(ids.length >= 3, "owner: every open ticket links to its detail");
let id3b = null; for (const id of [...new Set(ids)]) { const d = await page(A, `/app/tickets?ticket=${id}`); if (/class="k">#3 · /.test(d.html)) { id3b = id; break; } }
t(!!id3b, "owner: detail view opens for a ticket");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { status: "bogus" }); t(x.r.status === 422, "owner: unknown status refused");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, {}); t(x.r.status === 422, "owner: empty change refused");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { reply: "  " }); t(x.r.status === 422 && x.j.fields.reply, "owner: blank reply refused");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { status: "in_progress", assignee: "Housekeeping", priority: "high" }); t(x.r.status === 200, "owner: start work, assign, set priority");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { note: "Plumber called, back by 3" }); t(x.r.status === 200, "owner: internal note");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { reply: "Sorry about that. A plumber is on the way." }); t(x.r.status === 200, "owner: reply to the customer");
x = await call(anon, "GET", `/api/o/${tok}`);
const pub = JSON.stringify(x.j.data.events);
t(x.j.data.status === "in_progress" && pub.includes("plumber is on the way") && pub.includes("Work started") && !pub.includes("back by 3") && !pub.includes("Housekeeping"), "status link: shows the reply and progress, never internal notes or assignee");
x = await call(D, "PATCH", `/api/tickets/${id3b}`, { status: "resolved" }); t(x.r.status === 404, "isolation: another workspace can't touch the ticket");
x = await call(A, "PATCH", `/api/tickets/${id3b}`, { status: "resolved" }); t(x.r.status === 200, "owner: mark resolved");
x = await call(anon, "GET", `/api/o/${tok}`); t(x.j.data.status === "resolved", "status link: now resolved");
x = await call(A, "PUT", "/api/sla", { high: 4, normal: 2, low: 72 }); t(x.r.status === 422, "SLA: a quicker 'low' than 'normal' is refused");
x = await call(A, "PUT", "/api/sla", { high: 0, normal: 24, low: 72 }); t(x.r.status === 422 && x.j.fields.high, "SLA: zero hours refused");
x = await call(A, "PUT", "/api/sla", { high: 2, normal: 12, low: 48 }); t(x.r.status === 200, "SLA: rules saved");
pg = await page(A, "/app/tickets?tab=sla"); t(pg.s === 200 && /value="12"/.test(pg.html), "SLA: owner screen shows the saved hours");
pg = await page(D, "/app/tickets"); t(pg.s === 200 && !pg.html.includes("AC too cold") && !pg.html.includes("Lift 2"), "isolation: another workspace's ticket list is empty");

/* =============================== REVIEW FEEDBACK -> TICKET =============================== */
{
  const F = await signUp("Saravana Cafe");
  const q = await mkQr(F, "review", "Table 4 review", { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 4" });
  const rr = await call(anon, "POST", "/api/review/response", { code: q.j.shortCode, rating: 2, lang: "en" }, UA(120));
  await call(anon, "POST", "/api/review/feedback", { id: rr.j.id, message: "AC too cold near the window.", phone: "98765 43210" }, UA(120));
  let rv = await page(F, "/app/reviews?tab=feedback");
  const fid = (rv.html.match(/id="fb-([0-9a-f-]{36})"/) ?? [])[1];
  t(!!fid && /Make ticket/.test(rv.html), "reviews: a private-feedback note offers 'Make ticket'");
  x = await call(F, "POST", "/api/tickets/from-feedback", { feedbackId: "nope" }); t(x.r.status === 404, "from-feedback: a malformed id is not found");
  x = await call(D, "POST", "/api/tickets/from-feedback", { feedbackId: fid }); t(x.r.status === 404, "isolation: another workspace can't turn the note into a ticket");
  x = await call(F, "POST", "/api/tickets/from-feedback", { feedbackId: fid }); t(x.r.status === 201 && x.j.seq === 1 && x.j.created === true, "from-feedback: ticket #1 created from the note");
  x = await call(F, "POST", "/api/tickets/from-feedback", { feedbackId: fid }); t(x.r.status === 200 && x.j.seq === 1 && x.j.created === false, "from-feedback: doing it again returns the same ticket, not a second one");
  rv = await page(F, "/app/reviews?tab=feedback"); t(/Ticket #1/.test(rv.html) && !/Make ticket/.test(rv.html), "reviews: the note now links to its ticket");
  const tk = await page(F, "/app/tickets"); t(/REVIEW/.test(tk.html) && tk.html.includes("AC too cold near the window"), "from-feedback: the ticket shows in the list with source REVIEW");
}

/* =============================== ASSETS =============================== */
x = await call(A, "POST", "/api/assets", { name: "A", intervalDays: 0 }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.intervalDays, "assets: invalid asset refused");
x = await call(A, "POST", "/api/assets", { name: "Daikin split AC", lastService: dayPlus(5) }); t(x.r.status === 422 && x.j.fields.lastService, "assets: a service date in the future is refused");
x = await call(A, "POST", "/api/assets", { name: "Daikin split AC", place: "Floor 3, Bay 2", vendor: "CoolTech AMC", intervalDays: 90, lastService: dayPlus(-100) }); t(x.r.status === 201, "assets: created"); const assetId = x.j.id;
pg = await page(A, "/app/tickets?tab=assets"); t(pg.s === 200 && pg.html.includes("Daikin split AC") && pg.html.includes("AST-0001") && /OVERDUE/.test(pg.html), "assets: list shows code and an overdue service (100 days ago, every 90)");
x = await mkQr(A, "asset", "AC QR", { assetId: "00000000-0000-0000-0000-000000000000" }); t(x.r.status === 422 && x.j.fields["config.assetId"], "QR: an asset that doesn't exist is refused");
x = await mkQr(D, "asset", "Steal", { assetId }); t(x.r.status === 422, "isolation: another workspace's asset can't be used by a QR");
x = await mkQr(A, "asset", "AC QR", { assetId }); t(x.r.status === 201, "QR: asset code created"); const aCode = x.j.shortCode;
pg = await page(anon, `/s/${aCode}`, UA(5)); t(pg.s === 200 && pg.html.includes("Daikin split AC") && pg.html.includes("AST-0001"), "asset page: shows the asset");
x = await call(anon, "POST", "/api/s/ticket", { code: aCode, problem: "Water leak", details: "Dripping on a desk" }, UA(6)); t(x.r.status === 201 && x.j.seq > 3, "asset ticket: raised from the asset code");
x = await call(anon, "POST", "/api/s/ticket", { code: aCode, problem: "Cleaning" }, UA(6)); t(x.r.status === 422, "asset ticket: a problem not offered for assets is refused");
pg = await page(A, "/app/tickets"); t(pg.html.includes("Daikin split AC") && /Asset/.test(pg.html), "asset ticket: shows in the list against the asset");
x = await call(A, "POST", `/api/assets/${assetId}/service`, { servicedOn: dayPlus(-1) }); t(x.r.status === 422 && x.j.fields.notes, "service log: needs who or a note");
x = await call(A, "POST", `/api/assets/${assetId}/service`, { servicedOn: dayPlus(-1), byName: "Suresh", notes: "Filter cleaned, gas checked" }); t(x.r.status === 201, "service log: visit recorded");
pg = await page(A, "/app/tickets?tab=visits"); t(pg.html.includes("Suresh") && pg.html.includes("Filter cleaned"), "service log: shows on the visits tab");
pg = await page(A, "/app/tickets?tab=assets"); t(!/OVERDUE/.test(pg.html.split("Daikin split AC")[1]?.slice(0, 1500) ?? "OVERDUE"), "service log: the asset is no longer overdue (next due moved on)");
x = await call(D, "POST", `/api/assets/${assetId}/service`, { byName: "Eve" }); t(x.r.status === 404, "isolation: another workspace can't log a service");
x = await call(A, "DELETE", `/api/assets/${assetId}`); t(x.r.status === 409, "assets: can't retire an asset a live QR points at");
x = await call(A, "POST", "/api/assets", { name: "Spare genset" }); const spare = x.j.id;
x = await call(A, "DELETE", `/api/assets/${spare}`); t(x.r.status === 200, "assets: an unused asset can be retired");
x = await call(D, "PATCH", `/api/assets/${assetId}`, { name: "Hijack" }); t(x.r.status === 404, "isolation: another workspace can't edit the asset");

/* =============================== ATTENDANCE =============================== */
x = await call(A, "POST", "/api/workers", { name: "M", phone: "12" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone, "workers: invalid worker refused");
x = await call(A, "POST", "/api/workers", { name: "Murugan K.", phone: "98765 40114", kind: "labour", role: "Mason", shiftStart: "09:00", shiftEnd: "08:00" }); t(x.r.status === 422 && x.j.fields.shiftEnd, "workers: shift must end after it starts");
x = await call(A, "POST", "/api/workers", { name: "Anand N.", phone: "98765 40007", kind: "staff", role: "Site supervisor", shiftStart: "00:00", shiftEnd: "23:59" }); t(x.r.status === 201 && x.j.code === "ST-0001", "workers: staff gets ST-0001"); const anand = x.j;
x = await call(A, "POST", "/api/workers", { name: "=HYPERLINK(\"http://evil\")", phone: "98765 40114", kind: "labour", role: "Mason" }); t(x.r.status === 201 && x.j.code === "LB-0002", "workers: labour gets LB-0002 (numbering shared)"); const evil = x.j;
void evil;
x = await call(A, "POST", "/api/points", { name: "Main gate" }); t(x.r.status === 422 && x.j.fields.lat, "points: a location check without a location is refused");
x = await call(A, "POST", "/api/points", { name: "Main gate", lat: 95, lng: 80 }); t(x.r.status === 422 && x.j.fields.lat, "points: latitude out of range refused");
x = await call(A, "POST", "/api/points", { name: "Main gate", lat: 13.0827, lng: 80.2707, radiusM: 100, requireGeo: true }); t(x.r.status === 201, "points: created with a 100 m geofence"); const pointId = x.j.id;
x = await call(A, "POST", "/api/points", { name: "Site office", requireGeo: false }); t(x.r.status === 201, "points: a point without a location check"); const point2 = x.j.id;
x = await mkQr(A, "attend", "Gate QR", { pointId }); t(x.r.status === 201, "QR: attendance code created"); const gCode = x.j.shortCode;
x = await mkQr(D, "attend", "Steal", { pointId }); t(x.r.status === 422, "isolation: another workspace's point can't be used by a QR");
pg = await page(anon, `/s/${gCode}`, UA(10)); t(pg.s === 200 && pg.html.includes("Main gate"), "attendance page: renders with the point");
const ci = (body, h = UA(11)) => call(anon, "POST", "/api/s/attend", { code: gCode, ...body }, h);
x = await ci({ workerCode: "bad", last4: "1" }); t(x.r.status === 422 && x.j.fields.workerCode && x.j.fields.last4, "check-in: malformed ID and digits -> 422");
x = await ci({ workerCode: "ST-0099", last4: "0007", lat: 13.0827, lng: 80.2707 }); t(x.r.status === 401 && x.j.error === "no_match", "check-in: unknown ID -> no_match");
x = await ci({ workerCode: "ST-0001", last4: "9999", lat: 13.0827, lng: 80.2707 }); t(x.r.status === 401 && x.j.error === "no_match", "check-in: wrong digits -> the same no_match (IDs can't be probed)");
x = await ci({ workerCode: "ST-0001", last4: "0007" }); t(x.r.status === 403 && x.j.error === "need_location", "check-in: a geofenced point needs a location");
x = await ci({ workerCode: "ST-0001", last4: "0007", lat: 13.0900, lng: 80.2707 }); t(x.r.status === 403 && x.j.error === "outside" && x.j.distM > 500 && x.j.radiusM === 100, `check-in: far from the point is refused (${x.j.distM} m)`);
x = await ci({ workerCode: "st-0001", last4: "0007", lat: 13.08275, lng: 80.27075 }); t(x.r.status === 200 && x.j.action === "in" && x.j.verified === true && x.j.distM < 100, "check-in: inside the geofence checks in (ID is case-insensitive)", JSON.stringify(x.j));
const firstLate = x.j.lateMin;
x = await ci({ workerCode: "ST-0001", last4: "0007", lat: 13.08275, lng: 80.27075 }); t(x.r.status === 409 && x.j.error === "too_soon", "check-in: scanning again straight away doesn't check out");
if (db) {
  await db.query("update attendance set in_at = in_at - interval '3 hours' where worker_id = (select id from workers where code = 'ST-0001' and workspace_id = (select workspace_id from workers where id = $1))", [anand.id]);
  x = await ci({ workerCode: "ST-0001", last4: "0007", lat: 13.08275, lng: 80.27075 }); t(x.r.status === 200 && x.j.action === "out", "check-out: a later scan checks out");
  x = await ci({ workerCode: "ST-0001", last4: "0007", lat: 13.08275, lng: 80.27075 }); t(x.r.status === 409 && x.j.error === "done", "check-out: and only once a day");
} else skip("check-out after a later scan (set DATABASE_URL)");
// a point without a location check (its own workspace: free plans hold 3 dynamic codes)
{
  const E = await signUp("Office Co");
  x = await call(E, "POST", "/api/workers", { name: "Priya N.", phone: "98765 40114", kind: "staff", role: "Cashier" }); const wk = x.j;
  x = await call(E, "POST", "/api/points", { name: "Site office", requireGeo: false }); const pt = x.j.id;
  x = await mkQr(E, "attend", "Office QR", { pointId: pt }); t(x.r.status === 201, "QR: attendance code for a point without a location check");
  x = await call(anon, "POST", "/api/s/attend", { code: x.j.shortCode, workerCode: wk.code, last4: "0114" }, UA(12));
  t(x.r.status === 200 && x.j.action === "in" && x.j.verified === false && x.j.distM === null, "check-in: a point without a location check records it unverified");
}
// brute force on the last 4 digits
let blocked = 0; for (let i = 0; i < 14; i++) { x = await ci({ workerCode: "LB-0002", last4: String(1000 + i), lat: 13.08275, lng: 80.27075 }, UA(50 + i)); if (x.r.status === 429) blocked++; }
t(blocked >= 3, `check-in: guessing the 4 digits is blocked per worker even from many devices (${blocked} of 14 refused)`);
pg = await page(A, "/app/attendance"); t(pg.s === 200 && pg.html.includes("Anand N.") && /On site|Checked out/i.test(pg.html), "owner: today board shows who checked in");
x = await call(A, "PUT", "/api/attendance/rules", { lateAfterMin: 500 }); t(x.r.status === 422, "rules: grace period over 240 min refused");
x = await call(A, "PUT", "/api/attendance/rules", { lateAfterMin: 30 }); t(x.r.status === 200, "rules: grace period saved");
const exp = await fetch(`${B}/api/attendance/export?month=${dayPlus(0).slice(0, 7)}`, { headers: { cookie: A.h } }); const csv = await exp.text();
t(exp.status === 200 && /text\/csv/.test(exp.headers.get("content-type")) && csv.startsWith("ID,Name,Type,Role,Days present") && csv.includes("ST-0001"), "export: payroll CSV for the month");
t(!csv.split("\n").some((l) => /,?"?=HYPERLINK/.test(l) && !l.includes("'=HYPERLINK")), "export: a worker name can't run as a spreadsheet formula");
x = await fetch(`${B}/api/attendance/export?month=2024-13`, { headers: { cookie: A.h } }); t(x.status === 422, "export: bad month refused");
x = await fetch(`${B}/api/attendance/export`, {}); t(x.status === 401, "export: logged out -> 401");
pg = await page(D, "/app/attendance"); t(!pg.html.includes("Anand N."), "isolation: another workspace sees no workers");
x = await call(D, "PATCH", `/api/workers/${anand.id}`, { name: "Hijack", phone: "98765 40007" }); t(x.r.status === 404, "isolation: another workspace can't edit a worker");
x = await call(A, "DELETE", `/api/points/${pointId}`); t(x.r.status === 409, "points: can't delete a point a live QR uses");

/* =============================== VISITORS =============================== */
x = await mkQr(Bw, "visitor", "Reception QR", { place: "Reception" }); t(x.r.status === 201, "QR: visitor code created"); const vCode = x.j.shortCode;
pg = await page(anon, `/s/${vCode}`, UA(20)); t(pg.s === 200 && pg.html.includes("Glow Salon"), "visitor page: renders");
const vr = (body, h = UA(21)) => call(anon, "POST", "/api/s/visitor", { code: vCode, ...body }, h);
x = await vr({ name: "P" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone && x.j.fields.host && x.j.fields.purpose, "visitor: incomplete request refused");
x = await vr({ name: "Prakash V.", phone: "98765 40402", purpose: "Cement delivery", host: "Anand N." }); t(x.r.status === 201 && /^v[\w-]{22}$/.test(x.j.token), "visitor: pass requested");
const vTok = x.j.token;
x = await vr({ name: "Imran S.", phone: "98765 40115", purpose: "Inspection", host: "Anand N." }, UA(22)); const vTok2 = x.j.token;
x = await call(anon, "GET", `/api/o/${vTok}`); t(x.j.kind === "v" && x.j.data.status === "awaiting" && !JSON.stringify(x.j).includes("40402"), "visitor pass: awaiting, no phone number in the response");
pg = await page(Bw, "/app/attendance?tab=visitors"); t(pg.s === 200 && pg.html.includes("Prakash V.") && pg.html.includes("Imran S."), "owner: visitor log shows the requests");
const vIds = [...pg.html.matchAll(/data-visitor="([0-9a-f-]{36})"[^>]*data-name="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
const vid = vIds.find((v) => v.name === "Prakash V.")?.id, vid2 = vIds.find((v) => v.name === "Imran S.")?.id;
t(!!vid && !!vid2, "owner: each visitor row carries its id");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "in" }); t(x.r.status === 409, "visitor: can't check in before approval");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "dance" }); t(x.r.status === 422, "visitor: unknown action refused");
x = await call(D, "PATCH", `/api/visitors/${vid}`, { action: "approve" }); t(x.r.status === 404, "isolation: another workspace can't approve a visitor");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "approve" }); t(x.r.status === 200, "visitor: approved");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "decline" }); t(x.r.status === 409, "visitor: a decision can't be changed afterwards");
x = await call(anon, "GET", `/api/o/${vTok}`); t(x.j.data.status === "approved" && x.j.data.validUntil && new Date(x.j.data.validUntil) > new Date(), "visitor pass: approved with an expiry later today");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "in" }); t(x.r.status === 200, "visitor: checked in at the gate");
x = await call(Bw, "PATCH", `/api/visitors/${vid}`, { action: "out" }); t(x.r.status === 200, "visitor: checked out");
x = await call(anon, "GET", `/api/o/${vTok}`); t(x.j.data.status === "checked_out", "visitor pass: shows the visit is complete");
x = await call(Bw, "PATCH", `/api/visitors/${vid2}`, { action: "decline" }); t(x.r.status === 200, "visitor: declined");
x = await call(anon, "GET", `/api/o/${vTok2}`); t(x.j.data.status === "declined", "visitor pass: shows declined");
if (db) {
  const x3 = await vr({ name: "Kavya M.", phone: "98765 40530", purpose: "Interview", host: "Vikas R." }, UA(23));
  const g = await page(Bw, "/app/attendance?tab=visitors"); const kid = [...g.html.matchAll(/data-visitor="([0-9a-f-]{36})"[^>]*data-name="Kavya M\."/g)][0]?.[1];
  await call(Bw, "PATCH", `/api/visitors/${kid}`, { action: "approve" });
  await db.query("update visitors set valid_until = now() - interval '1 minute' where id = $1", [kid]);
  x = await call(Bw, "PATCH", `/api/visitors/${kid}`, { action: "in" }); t(x.r.status === 409, "visitor: an expired pass can't be checked in");
  x = await call(anon, "GET", `/api/o/${x3.j.token}`); t(x.j.data.expired === true, "visitor pass: reads as expired");
} else skip("expired visitor pass (set DATABASE_URL)");

/* =============================== BOOKINGS =============================== */
const hoursBody = Array.from({ length: 7 }, (_, d) => ({ dow: d, closed: false, open: "10:00", close: "13:00" }));
x = await call(Bw, "PUT", "/api/booking/hours", { hours: hoursBody.map((h) => ({ ...h, close: "09:00" })) }); t(x.r.status === 422, "hours: closing before opening refused");
x = await call(Bw, "PUT", "/api/booking/hours", { hours: hoursBody }); t(x.r.status === 200, "hours: saved (open every day 10:00-13:00)");
x = await call(Bw, "POST", "/api/booking/items", { kind: "service", name: "Haircut", durationMin: 3 }); t(x.r.status === 422 && x.j.fields.durationMin, "services: duration under 5 minutes refused");
x = await call(Bw, "POST", "/api/booking/items", { kind: "service", name: "Haircut", durationMin: 60, price: -5 }); t(x.r.status === 422 && x.j.fields.price, "services: negative price refused");
x = await call(Bw, "POST", "/api/booking/items", { kind: "service", name: "Haircut", durationMin: 60, price: 400, staff: ["Meena", "Ravi", "Meena"] }); t(x.r.status === 201, "services: created with 2 staff (duplicates collapsed)"); const svc = x.j.id;
x = await call(Bw, "POST", "/api/booking/items", { kind: "service", name: "Consultation", durationMin: 30, staff: "Ravi", needsApproval: true }); t(x.r.status === 201, "services: a service that needs approval"); const svc2 = x.j.id;
x = await mkQr(Bw, "booking", "Haircut QR", { itemId: svc }); t(x.r.status === 201, "QR: booking code created"); const bCode = x.j.shortCode;
x = await mkQr(Bw, "booking", "Consult QR", { itemId: svc2 }); t(x.r.status === 201, "QR: booking code for the approval service"); const bCode2 = x.j.shortCode;
pg = await page(anon, `/s/${bCode}`, UA(30)); t(pg.s === 200 && pg.html.includes("Haircut") && pg.html.includes("Glow Salon"), "booking page: renders the service");
const openDay = [1, 2, 3, 4, 5, 6, 7].map(dayPlus).find((d) => true);
const slotsOf = async (code, day) => (await call(anon, "GET", `/api/s/booking/slots?code=${code}&date=${day}`)).j;
x = await slotsOf(bCode, "2020-01-01"); t(!x.slots || x.slots.length === 0, "slots: a day in the past has none");
x = await slotsOf(bCode, dayPlus(30)); t(!x.slots || x.slots.length === 0, "slots: more than 14 days ahead has none");
x = await call(anon, "GET", `/api/s/booking/slots?code=${bCode}&date=nope`); t(x.r.status === 422, "slots: bad date refused");
const day = dayPlus(2);
x = await slotsOf(bCode, day); t(x.slots?.length === 5 && x.slots[0].start === 600 && x.slots[0].free.length === 2 && x.slots[4].start === 720, `slots: every 30 min from 10:00 to 12:00 (a 60-min service ends by 13:00), 2 staff free (${x.slots?.length})`, JSON.stringify(x));
const book = (code, body, h) => call(anon, "POST", "/api/s/booking", { code, ...body }, h ?? UA(31));
x = await book(bCode, { date: day, start: 600 }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone, "booking: name and phone required");
x = await book(bCode, { date: day, start: 605, name: "Arjun", phone: "98765 41001" }); t(x.r.status === 422 && x.j.error === "past", "booking: a time that isn't a real slot is refused");
x = await book(bCode, { date: day, start: 600, name: "Arjun", phone: "98765 41001" }); t(x.r.status === 201 && /^BK-[A-Z2-9]{6}$/.test(x.j.code) && x.j.status === "confirmed" && x.j.staff, `booking: first customer gets 10:00 with ${x.j.staff}`, JSON.stringify(x.j));
const b1 = x.j, staff1 = x.j.staff;
x = await book(bCode, { date: day, start: 600, name: "Divya", phone: "98765 41002" }, UA(32)); t(x.r.status === 201 && x.j.staff && x.j.staff !== staff1, "booking: the second customer at 10:00 gets the other staff member");
const b2 = x.j;
x = await book(bCode, { date: day, start: 600, name: "Kavya", phone: "98765 41003" }, UA(33)); t(x.r.status === 409 && x.j.error === "taken", "booking: a third customer at 10:00 is told it's taken");
x = await slotsOf(bCode, day); t(!x.slots.some((s) => s.start === 600 || s.start === 630) && x.slots.some((s) => s.start === 660), "slots: 10:00 and 10:30 are gone once both staff are booked at 10:00; 11:00 is free");
x = await book(bCode, { date: day, start: 660, staff: "Nobody", name: "Rahul", phone: "98765 41004" }, UA(34)); t(x.r.status === 409, "booking: a staff member the service doesn't have is refused");
const race = await Promise.all([1, 2, 3, 4].map((i) => book(bCode, { date: day, start: 720, name: "Racer " + i, phone: `98765 4200${i}` }, UA(60 + i))));
t(race.filter((z) => z.r.status === 201).length === 2 && race.filter((z) => z.r.status === 409).length === 2, "booking: four customers race for the last slot, exactly two (one per staff) get it", race.map((z) => z.r.status).join());
x = await call(anon, "GET", `/api/o/${b1.token}`); t(x.j.kind === "b" && x.j.data.itemName === "Haircut" && x.j.data.code === b1.code && x.j.data.canCancel === true && !JSON.stringify(x.j).includes("41001"), "booking link: shows the booking, no phone number");
x = await call(anon, "POST", `/api/o/${b1.token}/cancel`); t(x.r.status === 200, "booking: the customer cancels their own booking");
x = await call(anon, "POST", `/api/o/${b1.token}/cancel`); t(x.r.status === 409, "booking: ...and can't cancel twice");
x = await slotsOf(bCode, day); t(x.slots.some((s) => s.start === 600), "slots: a cancelled booking frees the time");
x = await book(bCode, { date: day, start: 600, name: "Arjun again", phone: "98765 41001" }, UA(35)); t(x.r.status === 201, "booking: the freed time can be booked again");
x = await book(bCode2, { date: day, start: 600, name: "Sneha", phone: "98765 41005" }, UA(36)); t(x.r.status === 201 && x.j.status === "pending", "booking: a service that needs approval starts pending"); const bp = x.j;
pg = await page(Bw, "/app/bookings?tab=bookings"); t(pg.s === 200 && pg.html.includes("Sneha") && pg.html.includes("Divya") && /Pending/i.test(pg.html), "owner: bookings list shows customers and the pending one");
const bIds = [...pg.html.matchAll(/data-booking="([0-9a-f-]{36})"[^>]*data-name="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
const sneha = bIds.find((b) => b.name === "Sneha")?.id; t(!!sneha, "owner: each booking row carries its id");
x = await call(Bw, "PATCH", `/api/bookings/${sneha}`, { status: "completed" }); t(x.r.status === 409, "owner: a pending booking can't jump to completed");
x = await call(Bw, "PATCH", `/api/bookings/${sneha}`, { status: "bogus" }); t(x.r.status === 422, "owner: unknown booking status refused");
x = await call(D, "PATCH", `/api/bookings/${sneha}`, { status: "confirmed" }); t(x.r.status === 404, "isolation: another workspace can't change a booking");
x = await call(Bw, "PATCH", `/api/bookings/${sneha}`, { status: "confirmed" }); t(x.r.status === 200, "owner: confirm a pending booking");
x = await call(Bw, "PATCH", `/api/bookings/${sneha}`, { status: "no_show" }); t(x.r.status === 200, "owner: mark a no-show");
x = await call(anon, "GET", `/api/o/${bp.token}`); t(x.j.data.status === "no_show", "booking link: shows the new status");
x = await call(Bw, "DELETE", `/api/booking/items/${svc}`); t(x.r.status === 409, "services: can't retire a service a live QR points at");
x = await call(D, "PATCH", `/api/booking/items/${svc}`, { kind: "service", name: "Hijack", durationMin: 30 }); t(x.r.status === 404, "isolation: another workspace can't edit the service");
x = await mkQr(D, "booking", "Steal", { itemId: svc }); t(x.r.status === 422, "isolation: another workspace can't point a QR at the service");

// events
const evStart = new Date(Date.now() + 3 * 86400e3).toISOString();
x = await call(Bw, "POST", "/api/booking/items", { kind: "event", name: "Diwali Food Fest", startsAt: "nope", capacity: 3 }); t(x.r.status === 422 && x.j.fields.startsAt, "events: bad date refused");
x = await call(Bw, "POST", "/api/booking/items", { kind: "event", name: "Diwali Food Fest", startsAt: evStart, capacity: 0 }); t(x.r.status === 422 && x.j.fields.capacity, "events: capacity must be 1 or more");
x = await call(Bw, "POST", "/api/booking/items", { kind: "event", name: "Diwali Food Fest", startsAt: evStart, capacity: 3, price: 150, venue: "Main hall" }); t(x.r.status === 201, "events: created with 3 tickets"); const evId = x.j.id;
x = await call(Bw, "POST", "/api/booking/items", { kind: "event", name: "Old event", startsAt: evStart, capacity: 10 }); const spareEv = x.j.id;
// a free workspace holds 3 dynamic codes and B used 3 already: retire one service QR via the library to make room
const lib = await page(Bw, "/app/library"); void lib;
x = await mkQr(Bw, "booking", "Event QR", { itemId: evId });
let evCode = x.j.shortCode;
if (x.r.status === 422 || x.r.status === 402 || x.r.status === 409 || !evCode) {
  const w2 = await signUp("Event Co"); const x2 = await call(w2, "POST", "/api/booking/items", { kind: "event", name: "Diwali Food Fest", startsAt: evStart, capacity: 3, price: 150 });
  var EV = w2; var evItem = x2.j.id; const q2 = await mkQr(w2, "booking", "Event QR", { itemId: evItem }); evCode = q2.j.shortCode;
} else { var EV = Bw; var evItem = evId; }
t(!!evCode, "QR: event code created");
pg = await page(anon, `/s/${evCode}`, UA(40)); t(pg.s === 200 && pg.html.includes("Diwali Food Fest"), "event page: renders");
const reg = (body, h) => call(anon, "POST", "/api/s/booking", { code: evCode, ...body }, h ?? UA(41));
x = await reg({ name: "A", phone: "1", qty: 9 }); t(x.r.status === 422 && x.j.fields.qty, "event: more than 5 tickets at once refused");
x = await reg({ name: "Sangeetha R.", phone: "98765 43001", qty: 2 }); t(x.r.status === 201 && /^EV-[A-Z2-9]{6}$/.test(x.j.code), "event: 2 tickets booked");
const ev1 = x.j;
x = await reg({ name: "Harish B.", phone: "98765 43002", qty: 2 }, UA(42)); t(x.r.status === 409 && x.j.error === "sold_out" && x.j.left === 1, "event: only 1 ticket left, so 2 are refused");
const evRace = await Promise.all([1, 2, 3].map((i) => reg({ name: "Fan " + i, phone: `98765 4310${i}`, qty: 1 }, UA(70 + i))));
t(evRace.filter((z) => z.r.status === 201).length === 1, "event: three people race for the last ticket, exactly one gets it", evRace.map((z) => z.r.status).join());
x = await reg({ name: "Late", phone: "98765 43009", qty: 1 }, UA(43)); t(x.r.status === 409 && x.j.error === "sold_out" && x.j.left === 0, "event: sold out");
const gate = (code, confirm, jar = EV) => call(jar, "POST", "/api/gate", { code, confirm });
x = await gate("nope"); t(x.r.status === 404, "gate: a malformed code is not found");
x = await gate("EV-ZZZZZZ"); t(x.r.status === 404, "gate: an unknown code is not found");
x = await gate(ev1.code.toLowerCase()); t(x.r.status === 200 && x.j.lookup.state === "valid" && x.j.lookup.qty === 2 && x.j.lookup.name === "Sangeetha R.", "gate: lookup is case-insensitive and shows the booking");
x = await gate(ev1.code, true, D); t(x.r.status === 404, "isolation: another workspace can't check the ticket in");
const [g1, g2] = await Promise.all([gate(ev1.code, true), gate(ev1.code, true)]); t([g1.r.status, g2.r.status].sort().join() === "200,409", "gate: two scanners at once, only one check-in", `${g1.r.status},${g2.r.status}`);
x = await gate(ev1.code); t(x.j.lookup.state === "already" && x.j.lookup.checkedInAt, "gate: the ticket now reads as already checked in");
x = await call(EV, "PATCH", `/api/booking/items/${evItem}`, { kind: "event", name: "Diwali Food Fest", startsAt: evStart, capacity: 2 }); t(x.r.status === 422 && x.j.fields.capacity, "events: capacity can't go below what's booked");
x = await call(EV, "PATCH", `/api/booking/items/${evItem}`, { kind: "event", name: "Diwali Food Fest", startsAt: evStart, capacity: 10 }); t(x.r.status === 200, "events: capacity can be raised");
x = await reg({ name: "Late", phone: "98765 43009", qty: 1 }, UA(44)); t(x.r.status === 201, "event: raising capacity opens tickets again");
pg = await page(EV, "/app/bookings?tab=events"); t(pg.s === 200 && pg.html.includes("Diwali Food Fest") && /checked in/i.test(pg.html), "owner: events tab shows registrations and check-ins");
pg = await page(EV, "/app/bookings"); t(pg.s === 200 && /Open gate scanner/.test(pg.html), "owner: calendar screen has the gate scanner");
x = await call(Bw, "DELETE", `/api/booking/items/${spareEv}`); t(x.r.status === 200, "events: an unused event can be retired");

/* =============================== REAL ESTATE =============================== */
x = await call(C, "POST", "/api/projects", { name: "G", plotCount: 0, columns: 1 }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.plotCount && x.j.fields.columns, "projects: invalid project refused");
x = await call(C, "POST", "/api/projects", { name: "Green Meadows Phase 2", plotCount: 20, columns: 10, roadAfter: "1", approval: "DTCP", whatsapp: "98765 43210", brochureUrl: "javascript:alert(1)" }); t(x.r.status === 422 && x.j.fields.brochureUrl, "projects: a javascript: brochure link is refused");
x = await call(C, "POST", "/api/projects", { name: "Green Meadows Phase 2", plotCount: 20, columns: 10, roadAfter: "1", approval: "DTCP", whatsapp: "98765 43210", brochureUrl: "example.com/brochure.pdf" }); t(x.r.status === 201, "projects: created with 20 numbered plots"); const proj = x.j.id;
pg = await page(C, `/app/real-estate?project=${proj}`); t(pg.s === 200 && pg.html.includes("Green Meadows Phase 2") && /aria-label="Plot 20, available"/.test(pg.html) && /30 FT ROAD|ROAD/i.test(pg.html), "plots: layout map shows 20 plots and the road");
const plotIds = [...pg.html.matchAll(/data-plot="([0-9a-f-]{36})" data-number="(\d+)"/g)].reduce((m, r) => ({ ...m, [r[2]]: r[1] }), {});
t(Object.keys(plotIds).length === 20, "plots: each map cell carries its plot id");
x = await call(C, "PATCH", `/api/plots/${plotIds[14]}`, { sizeSqft: "big" }); t(x.r.status === 422 && x.j.fields.sizeSqft, "plots: a non-number size is refused");
x = await call(C, "PATCH", `/api/plots/${plotIds[14]}`, { facing: "Up" }); t(x.r.status === 422 && x.j.fields.facing, "plots: an unknown facing is refused");
x = await call(C, "PATCH", `/api/plots/${plotIds[14]}`, { sizeSqft: 1200, dims: "30 × 40 ft", facing: "East", priceLakh: 42.5, approval: "DTCP", corner: false, status: "available" }); t(x.r.status === 200, "plots: details saved");
x = await call(C, "POST", `/api/projects/${proj}/import`, { rows: [{ number: "1", size: "1500", facing: "North", price: "50", status: "sold" }, { number: "2", size: "abc" }, { number: "2", size: "1200", status: "on hold" }, { number: "99999" }, { number: "3", status: "weird" }, { number: "25", size: "1000", facing: "West", corner: "yes" }] });
t(x.r.status === 200 && x.j.added === 1 && x.j.updated === 2 && x.j.skippedCount === 3, "import: valid rows applied (1 new plot, 2 updated), bad rows skipped with reasons", JSON.stringify(x.j));
x = await call(C, "POST", `/api/projects/${proj}/import`, { rows: [{ number: "x" }] }); t(x.r.status === 422, "import: a file with no valid rows is refused");
x = await call(D, "POST", `/api/projects/${proj}/import`, { rows: [{ number: "1" }] }); t(x.r.status === 404, "isolation: another workspace can't import into the project");
pg = await page(C, `/app/real-estate?project=${proj}`); t(/aria-label="Plot 1, sold"/.test(pg.html) && /aria-label="Plot 2, on hold"/.test(pg.html) && /aria-label="Plot 25, available"/.test(pg.html), "import: statuses show on the map");
x = await mkQr(C, "plot", "Plot 14 stone", { plotId: plotIds[14] }); t(x.r.status === 201, "QR: plot code created"); const pCode = x.j.shortCode;
x = await mkQr(D, "plot", "Steal", { plotId: plotIds[14] }); t(x.r.status === 422, "isolation: another workspace can't point a QR at the plot");
pg = await page(anon, `/s/${pCode}`, UA(80)); t(pg.s === 200 && pg.html.includes("Green Meadows Phase 2") && pg.html.includes("1,200") && pg.html.includes("East") && pg.html.includes("₹42.5 L"), "plot page: shows size, facing and price");
pg = await page(anon, `/s/${pCode}?lang=ta`, UA(80)); t(pg.html.includes('lang="ta"') && pg.html.includes("மனை 14"), "plot page: Tamil");
const enq = (body, h = UA(81)) => call(anon, "POST", "/api/s/plot", { code: pCode, ...body }, h);
x = await enq({ name: "S" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone, "enquiry: name and phone required");
x = await enq({ name: "Sangeetha R.", phone: "98765 44001", ask: "visit", visitOn: "2020-01-01" }); t(x.r.status === 422 && x.j.fields.visitOn, "enquiry: a visit date in the past refused");
x = await enq({ name: "Sangeetha R.", phone: "98765 44001", ask: "teleport" }); t(x.r.status === 422 && x.j.fields.ask, "enquiry: unknown request refused");
x = await enq({ name: "Sangeetha R.", phone: "98765 44001", ask: "visit", visitOn: dayPlus(3), visitSlot: "morning" }); t(x.r.status === 201, "enquiry: site visit requested");
x = await enq({ name: "Bot", phone: "98765 44009", website: "x" }, UA(82)); t(x.r.status === 200, "enquiry: honeypot short-circuits");
let el = 0; for (let i = 0; i < 8; i++) { x = await enq({ name: "Spam person", phone: `98765 450${i}${i}` }, UA(98)); if (x.r.status === 429) el++; } t(el >= 2, `enquiry: one visitor is throttled (${el} of 8 refused)`);
pg = await page(C, `/app/real-estate?project=${proj}`); t(pg.html.includes("Sangeetha R.") && pg.html.includes("Site visit") && !pg.html.includes("Bot"), "owner: enquiry list shows the buyer and the ask; honeypot not stored");
pg = await page(C, "/app/leads"); t(pg.html.includes("Sangeetha R.") && /PLOT QR/.test(pg.html), "enquiry: also lands in the Leads pipeline as a PLOT QR lead");
pg = await page(C, "/app/leads?tab=contacts"); t(pg.html.includes("+919876544001"), "enquiry: the buyer becomes a contact");
pg = await page(D, `/app/real-estate?project=${proj}`); t(!pg.html.includes("Sangeetha R.") && !pg.html.includes("data-plot="), "isolation: another workspace sees nothing of the project");
x = await call(C, "PATCH", `/api/plots/${plotIds[14]}`, { sizeSqft: 1200, dims: "30 × 40 ft", facing: "East", priceLakh: 42.5, approval: "DTCP", status: "sold" }); t(x.r.status === 200, "plots: mark sold");
pg = await page(anon, `/s/${pCode}`, UA(83)); t(/Sold|sold/.test(pg.html), "plot page: a sold plot reads as sold");
x = await call(D, "PATCH", `/api/plots/${plotIds[14]}`, { status: "available" }); t(x.r.status === 404, "isolation: another workspace can't change a plot");
x = await call(C, "DELETE", `/api/projects/${proj}`); t(x.r.status === 409, "projects: can't delete a project a live QR points at");
x = await call(C, "POST", "/api/projects", { name: "Scratch", plotCount: 3 }); x = await call(C, "DELETE", `/api/projects/${x.j.id}`); t(x.r.status === 200, "projects: an unused project can be deleted");

/* =============================== analytics hook =============================== */
for (const c of [tCode, aCode, gCode]) await fetch(`${B}/q/${c}`, { redirect: "manual", headers: UA(90) });
pg = await page(A, "/app/analytics"); t(/\d+ tickets?/.test(pg.html) && /\d+ check-ins?/.test(pg.html), "analytics: tickets and check-ins show as actions per code");

if (db) await db.end();
console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
