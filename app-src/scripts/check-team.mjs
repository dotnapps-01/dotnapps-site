// Team roles over HTTP: inviting by mobile number, joining at sign-in, seats, who may do what (every kind of owner
// route as Owner, Manager and Staff), what each screen shows each role, and that access ends the moment someone is removed.
//
// Start the DEV server with an admin number (the script upgrades plans through the admin API):
//   ADMIN_PHONES=+919000000001 npm run dev
//   npm run check:team [baseUrl]
const B = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
let pass = 0, fail = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar?.h ?? "", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar?.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };
const page = async (jar, path) => { const r = await fetch(B + path, { headers: { cookie: jar?.h ?? "" }, redirect: "manual" }); return { s: r.status, html: await r.text() }; };
const anon = null;
const NOACCESS = /This screen isn(?:'|&#x27;|&rsquo;|’)t available to your role/;

async function otp(jar, body) {
  for (let i = 0; i < 4; i++) {
    const x = await call(jar, "POST", "/api/auth/otp/send", body);
    if (x.r.status === 429) { await sleep((x.j.retryAfter ?? 30) * 1000 + 500); continue; }
    return x;
  }
}
async function signUp(name, phone = rnd()) {
  const jar = new Jar();
  const x = await otp(jar, { mode: "signup", phone, businessName: name });
  if (!x.j.devCode) throw new Error(`could not sign up ${name}: ${x.r.status} ${JSON.stringify(x.j)}`);
  await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  await call(jar, "POST", "/api/onboarding", { industry: "food", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
/** An invited person signs in with their number ("login" or "signup", both join the team). */
async function signInAs(phone, mode = "login", businessName) {
  const jar = new Jar();
  const x = await otp(jar, { mode, phone, ...(businessName ? { businessName } : {}) });
  if (!x.j.devCode) return { jar, send: x, verify: null };
  const v = await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  return { jar, send: x, verify: v };
}
const UUID0 = "00000000-0000-4000-8000-000000000000";

const admin = await signUp("Skanor Staff", ADMIN_PHONE);
const idOf = async (name) => (((await (await fetch(`${B}/app/admin?q=${encodeURIComponent(name)}`, { headers: { cookie: admin.h } })).text()).match(new RegExp(`data-tenant="([0-9a-f-]{36})" data-name="${name}"`)) ?? [])[1]);
const setPlan = async (name, plan) => { const x = await call(admin, "PATCH", `/api/admin/tenants/${await idOf(name)}`, { plan }); t(x.r.status === 200, `setup: ${name} on ${plan}`); };

const run = Date.now().toString(36).slice(-4);
const OWN = `Team Cafe ${run}`;
const O = await signUp(OWN);
const OTHER = await signUp(`Other Shop ${run}`);
const O2 = await signUp(`Second Cafe ${run}`);

/* ---------------- seats ---------------- */
let x = await call(O, "POST", "/api/team", { name: "Ravi Kumar", phone: rnd(), role: "staff" });
t(x.r.status === 403 && x.j.error === "seat_limit" && x.j.limit === 1 && /taken/.test(x.j.message), "seats: the free plan has one seat (the owner's), so no invitations", JSON.stringify(x.j));
await setPlan(OWN, "growth");
await setPlan(`Second Cafe ${run}`, "growth");

/* ---------------- inviting ---------------- */
x = await call(O, "POST", "/api/team", { name: "R", phone: "123", role: "boss" });
t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone && x.j.fields.role, "invite: name, number and role are checked", JSON.stringify(x.j));
x = await call(O, "POST", "/api/team", { name: "Ravi Kumar", phone: rnd(), role: "owner" }); t(x.r.status === 422 && x.j.fields.role, "invite: there is only one Owner");
x = await call(anon, "POST", "/api/team", { name: "Ravi Kumar", phone: rnd(), role: "staff" }); t(x.r.status === 401, "invite: logged out -> 401");

const P1 = rnd(), P2 = rnd(), P3 = rnd();
x = await call(O, "POST", "/api/team", { name: "Ravi Kumar", phone: P1, role: "staff" }); t(x.r.status === 201 && x.j.id, "invite: a Staff member is added", JSON.stringify(x.j));
const ravi = x.j.id;
x = await call(O, "POST", "/api/team", { name: "Ravi Again", phone: `+91 ${P1.slice(0, 5)} ${P1.slice(5)}`, role: "staff" }); t(x.r.status === 409 && x.j.error === "member_here", "invite: the same number written differently is still the same number", JSON.stringify(x.j));
x = await call(O2, "POST", "/api/team", { name: "Ravi K", phone: P1, role: "staff" }); t(x.r.status === 409 && x.j.error === "member_elsewhere", "invite: a number already on another business's team is refused");
// a number that already runs its own business
x = await call(O, "POST", "/api/team", { name: "Skanor Staff", phone: ADMIN_PHONE, role: "staff" }); t(x.r.status === 409 && x.j.error === "has_workspace", "invite: a number that already runs its own business is refused", JSON.stringify(x.j));
let pg = await page(O, "/app/settings"); t(pg.s === 200 && pg.html.includes("Ravi Kumar") && /INVITED/.test(pg.html) && /Team &amp; roles/.test(pg.html), "settings: the team table lists the invitation");
t(/2 of 10/.test(pg.html.replace(/<!-- -->/g, "")) || /of <!-- -->10|of 10/.test(pg.html), "settings: seats used out of the plan's seats");

/* ---------------- joining ---------------- */
let r1 = await signInAs(P1);
t(r1.verify?.r.status === 200 && r1.verify.j.next === "/app/dashboard", "join: signing in with the invited number goes straight to the app", JSON.stringify(r1.verify?.j));
const S = r1.jar;
pg = await page(S, "/app/dashboard"); t(pg.s === 200 && pg.html.includes(OWN) && pg.html.includes("Ravi Kumar") && /Staff · /.test(pg.html), "join: they land in the owner's workspace as Staff", `${pg.s}`);
pg = await page(O, "/app/settings"); t(/ACTIVE/.test(pg.html) && pg.html.includes("Ravi Kumar"), "join: the owner now sees them as Active");
x = await call(S, "POST", "/api/onboarding", { industry: "food", complete: true }); t(x.r.status === 403, "join: a team member can't redo the business set-up");
// signing up with the business-name form also joins (an invitation wins over starting a business)
x = await call(O, "POST", "/api/team", { name: "Meena S", phone: P2, role: "manager" }); t(x.r.status === 201, "invite: a Manager is added by the owner");
const meena = x.j.id;
const r2 = await signInAs(P2, "signup", "Not Mine Cafe");
t(r2.verify?.r.status === 200 && r2.verify.j.next === "/app/dashboard", "join: using the sign-up form with an invited number also joins the team");
const M = r2.jar;
pg = await page(M, "/app/dashboard"); t(pg.html.includes(OWN) && !pg.html.includes("Not Mine Cafe"), "join: ...and no business of their own is created", "");

/* ---------------- what each role may do: every kind of owner route ---------------- */
// [method, path, body, who may: build | reviews | export | settings | owner | invite | work | redeem]
const ROUTES = [
  ["POST", "/api/qr", {}, "build"], ["PATCH", `/api/qr/${UUID0}`, {}, "build"], ["POST", "/api/qr/actions", {}, "build"], ["GET", "/api/qr/slug?slug=abc", undefined, "build"], ["POST", "/api/folders", { name: "Menus" }, "build"],
  ["POST", "/api/pages", {}, "build"], ["PATCH", `/api/pages/${UUID0}`, {}, "build"], ["POST", "/api/lead-forms", {}, "build"], ["POST", "/api/coupons", {}, "build"], ["PUT", "/api/loyalty", {}, "build"],
  ["POST", "/api/assets", {}, "build"], ["PUT", "/api/sla", {}, "build"], ["POST", "/api/points", {}, "build"], ["POST", "/api/workers", {}, "build"], ["PUT", "/api/attendance/rules", {}, "build"],
  ["POST", "/api/booking/items", {}, "build"], ["PUT", "/api/booking/hours", {}, "build"], ["POST", "/api/projects", {}, "build"], ["POST", "/api/products", {}, "build"], ["POST", "/api/files/cleanup", undefined, "build"],
  ["PATCH", `/api/feedback/${UUID0}`, {}, "reviews"],
  ["GET", "/api/export/contacts", undefined, "export"], ["GET", "/app/analytics/export", undefined, "export"], ["GET", "/api/attendance/export", undefined, "export"],
  ["PATCH", "/api/settings/profile", {}, "settings"], ["POST", "/api/locations", {}, "settings"],
  ["PUT", "/api/settings/retention", {}, "owner"], ["POST", "/api/keys", {}, "owner"], ["POST", "/api/webhooks", {}, "owner"], ["DELETE", `/api/keys/${UUID0}`, undefined, "owner"],
  ["POST", "/api/tickets", {}, "work"], ["POST", "/api/tickets/from-feedback", {}, "work"], ["PATCH", `/api/tickets/${UUID0}`, {}, "work"], ["PATCH", `/api/leads/${UUID0}`, {}, "work"], ["POST", "/api/contacts/import", {}, "work"],
  ["PATCH", `/api/bookings/${UUID0}`, {}, "work"], ["PATCH", `/api/visitors/${UUID0}`, {}, "work"], ["PATCH", `/api/plots/${UUID0}`, {}, "work"], ["POST", "/api/gate", {}, "work"],
  ["POST", "/api/redeem", { code: "nope-0000" }, "redeem"],
];
const ROLE_CAN = { owner: ["build", "reviews", "export", "settings", "owner", "invite", "work", "redeem"], manager: ["build", "reviews", "export", "settings", "invite", "work", "redeem"], staff: ["work", "redeem"] };
const who = { owner: O, manager: M, staff: S };
for (const role of ["staff", "manager"]) {
  const denied = [], opened = [];
  for (const [method, path, body, need] of ROUTES) {
    const res = await call(who[role], method, path, body);
    const allowed = ROLE_CAN[role].includes(need);
    if (allowed && ((res.r.status === 403 && res.j.error === "forbidden") || res.r.status === 401)) opened.push(`${method} ${path} -> ${res.r.status}`);
    if (!allowed && res.r.status !== 403) denied.push(`${method} ${path} -> ${res.r.status}`);
    if (!allowed && res.r.status === 403 && res.j.error !== "forbidden") denied.push(`${method} ${path} 403 without error:forbidden`);
  }
  t(denied.length === 0, `${role}: every route their role doesn't allow answers 403 (${ROUTES.filter((r) => !ROLE_CAN[role].includes(r[3])).length} routes)`, denied.join("; "));
  t(opened.length === 0, `${role}: every route their role allows is open to them (${ROUTES.filter((r) => ROLE_CAN[role].includes(r[3])).length} routes)`, opened.join("; "));
}
{
  const bad = [];
  for (const [method, path, body] of ROUTES) { const res = await call(anon, method, path, body); if (res.r.status !== 401) bad.push(`${method} ${path} -> ${res.r.status}`); }
  t(bad.length === 0, `logged out: every one of those routes answers 401 (${ROUTES.length} routes)`, bad.join("; "));
}
{
  const res = await call(O, "POST", "/api/folders", { name: `Owner folder ${run}` }); t(res.r.status === 201 || res.r.status === 200, "owner: can build", String(res.r.status));
  const k = await call(O, "POST", "/api/keys", { name: "x", scope: "read" }); t(k.j.error !== "forbidden", "owner: reaches owner-only routes (the plan may still say no)", JSON.stringify(k.j));
}
// 403 text names what the role can't do, in plain words
x = await call(S, "POST", "/api/folders", { name: "x" }); t(/can't create and edit QR codes/.test(x.j.message ?? ""), "403: the message says what their role can't do", JSON.stringify(x.j));

/* ---------------- Staff do the real work ---------------- */
x = await call(S, "POST", "/api/tickets", { title: "AC too cold near window", category: "Facility", priority: "high", place: "Hall 1" }); t(x.r.status === 201, "staff: can raise and handle tickets", JSON.stringify(x.j));
x = await call(O, "POST", "/api/coupons", { title: "Weekend coffee", headline: "2 for ₹99", codePrefix: "wknd", validDays: 7, perCustomer: 1 }); const couponId = x.j.id;
x = await call(O, "POST", "/api/qr", { name: "Coupon QR", type: "coupon", config: { couponId }, publish: true }); const couponCode = x.j.shortCode;
x = await call(anon, "POST", "/api/s/coupon", { code: couponCode, phone: "98765 20001", name: "Divya S." }, { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile", "x-forwarded-for": "198.51.100.40" }); const claimed = x.j?.claim?.code;
t(!!claimed, "setup: a customer claims the offer", JSON.stringify(x.j));
x = await call(S, "POST", "/api/redeem", { code: claimed, confirm: true }); t(x.r.status === 200, "staff: can redeem a customer's coupon", JSON.stringify(x.j));
x = await call(S, "POST", "/api/redeem", { code: claimed, confirm: true }); t(x.r.status !== 200, "staff: ...once only");

/* ---------------- screens ---------------- */
for (const path of ["/app/studio", "/app/library", "/app/pages", "/app/reviews", "/app/products", "/app/integrations", "/app/settings", "/app/leads?tab=forms", "/app/leads?tab=broadcasts", "/app/tickets?tab=assets", "/app/tickets?tab=sla", "/app/attendance?tab=points", "/app/attendance?tab=staff", "/app/bookings?tab=services", "/app/bookings?tab=events"]) {
  pg = await page(S, path); t(pg.s === 200 && NOACCESS.test(pg.html), `staff: ${path} says it isn't available to their role`, `${pg.s}`);
}
for (const path of ["/app/dashboard", "/app/analytics", "/app/leads", "/app/leads?tab=contacts", "/app/offers", "/app/tickets", "/app/tickets?tab=visits", "/app/attendance", "/app/attendance?tab=visitors", "/app/bookings", "/app/bookings?tab=bookings", "/app/real-estate"]) {
  pg = await page(S, path); t(pg.s === 200 && !NOACCESS.test(pg.html), `staff: ${path} opens`, `${pg.s}`);
}
pg = await page(S, "/app/analytics"); t(!/Export CSV/.test(pg.html) && /Analytics/.test(pg.html), "staff: analytics is view-only (no CSV download)");
pg = await page(S, "/app/dashboard");
for (const href of ["/app/studio", "/app/library", "/app/settings", "/app/integrations", "/app/products", "/app/pages", "/app/reviews"]) t(!pg.html.includes(`href="${href}"`), `staff: the menu leaves out ${href}`);
for (const href of ["/app/dashboard", "/app/analytics", "/app/leads", "/app/offers", "/app/tickets", "/app/attendance", "/app/bookings", "/app/real-estate"]) t(pg.html.includes(`href="${href}"`), `staff: the menu has ${href}`);
t(!/Create QR/.test(pg.html) && !/Finish setting up/.test(pg.html) && !/Upgrade to/.test(pg.html), "staff: dashboard has no Create QR, set-up checklist or upgrade link");
pg = await page(S, "/app/offers"); t(/Redeem a code/.test(pg.html) && !/New offer/.test(pg.html) && !/Loyalty programme/.test(pg.html), "staff: offers is just redeeming and stamping");
pg = await page(S, "/app/leads"); t(!/New form/.test(pg.html) && !/New broadcast/.test(pg.html) && /Import contacts/.test(pg.html) && !pg.html.includes("/app/leads?tab=forms") && pg.html.includes("/app/leads?tab=contacts"), "staff: leads has the pipeline and contacts, not forms or broadcasts");
pg = await page(S, "/app/tickets"); t(/New ticket/.test(pg.html) && !/Add asset/.test(pg.html) && !/SLA rules/.test(pg.html), "staff: tickets has New ticket, not assets or SLA rules");
pg = await page(S, "/app/bookings"); t(!/New service/.test(pg.html) && !/New event/.test(pg.html), "staff: bookings has no set-up buttons");
pg = await page(S, "/app/attendance"); t(!/Export payroll CSV/.test(pg.html) && !/Add worker/.test(pg.html), "staff: attendance has no payroll export or Add worker");
pg = await page(S, "/app/real-estate"); t(!/\+ New project/.test(pg.html) && !/Import plots CSV/.test(pg.html), "staff: real estate has no project set-up");

for (const path of ["/app/studio", "/app/library", "/app/pages", "/app/reviews", "/app/products", "/app/settings", "/app/leads?tab=forms", "/app/tickets?tab=assets", "/app/attendance?tab=points", "/app/bookings?tab=services", "/app/analytics", "/app/dashboard", "/app/offers"]) {
  pg = await page(M, path); t(pg.s === 200 && !NOACCESS.test(pg.html), `manager: ${path} opens`, `${pg.s}`);
}
pg = await page(M, "/app/integrations"); t(NOACCESS.test(pg.html), "manager: integrations (API keys, webhooks) is the owner's");
pg = await page(M, "/app/settings"); t(/Team &amp; roles/.test(pg.html) && !/Delete workspace/.test(pg.html) && !/Keep scan and lead data for/.test(pg.html) && !/Security &amp; audit log/.test(pg.html) && /Only the owner can change the plan/.test(pg.html), "manager: settings has no retention, delete or audit log, and the plan is the owner's");
pg = await page(M, "/app/dashboard"); t(!pg.html.includes('href="/app/integrations"') && pg.html.includes('href="/app/settings"') && pg.html.includes('href="/app/studio"') && !/Upgrade to/.test(pg.html), "manager: the menu has Settings and Create QR but not Integrations");
pg = await page(O, "/app/settings"); t(/Delete workspace/.test(pg.html) && /Security &amp; audit log/.test(pg.html) && /Keep scan and lead data for/.test(pg.html), "owner: settings has everything");
pg = await page(O, "/app/integrations"); t(!NOACCESS.test(pg.html), "owner: integrations opens");

/* ---------------- who manages whom ---------------- */
x = await call(M, "POST", "/api/team", { name: "Another Manager", phone: rnd(), role: "manager" }); t(x.r.status === 403 && /Managers can add Staff only/.test(x.j.message ?? ""), "manager: can't add a Manager", JSON.stringify(x.j));
x = await call(M, "POST", "/api/team", { name: "Kavya R", phone: P3, role: "staff" }); t(x.r.status === 201, "manager: can add Staff");
const kavya = x.j.id;
x = await call(M, "PATCH", `/api/team/${ravi}`, { role: "manager" }); t(x.r.status === 403 && /Only the owner can change roles/.test(x.j.message ?? ""), "manager: can't change roles", JSON.stringify(x.j));
x = await call(M, "DELETE", `/api/team/${meena}`); t(x.r.status === 403, "manager: can't remove a Manager (not even themself)");
x = await call(M, "DELETE", "/api/team/owner"); t(x.r.status === 404, "manager: can't remove the owner", `${x.r.status} ${JSON.stringify(x.j)}`);
x = await call(S, "DELETE", `/api/team/${kavya}`); t(x.r.status === 403, "staff: can't remove anyone");
x = await call(S, "PATCH", `/api/team/${kavya}`, { role: "manager" }); t(x.r.status === 403, "staff: can't change roles");
x = await call(M, "DELETE", `/api/team/${kavya}`); t(x.r.status === 200, "manager: can cancel a Staff invitation");
x = await call(O, "PATCH", `/api/team/${ravi}`, { role: "boss" }); t(x.r.status === 422, "owner: an unknown role is refused");
x = await call(O, "PATCH", `/api/team/${UUID0}`, { role: "manager" }); t(x.r.status === 404, "owner: an unknown member is not found");
x = await call(OTHER, "PATCH", `/api/team/${ravi}`, { role: "manager" }); t(x.r.status === 404, "isolation: another business can't change your team");
x = await call(OTHER, "DELETE", `/api/team/${ravi}`); t(x.r.status === 404, "isolation: ...or remove someone from it");
x = await call(O, "PATCH", `/api/team/${ravi}`, { role: "manager" }); t(x.r.status === 200, "owner: promotes Staff to Manager");
x = await call(S, "POST", "/api/folders", { name: "Promoted" }); t(x.r.status < 300, "role change: takes effect on their next request, no sign-in needed", String(x.r.status));
pg = await page(S, "/app/studio"); t(!NOACCESS.test(pg.html), "role change: ...and on the screens");
x = await call(O, "PATCH", `/api/team/${ravi}`, { role: "staff" }); t(x.r.status === 200, "owner: demotes back to Staff");
x = await call(S, "POST", "/api/folders", { name: "Demoted" }); t(x.r.status === 403, "role change: demotion bites at once");

/* ---------------- seats ---------------- */
await setPlan(`Other Shop ${run}`, "starter"); // 3 seats
const T = OTHER;
const a = await call(T, "POST", "/api/team", { name: "One Staff", phone: rnd(), role: "staff" }); t(a.r.status === 201, "seats: starter has 3: first member fits");
// two invitations racing for the last seat: exactly one wins
const [b1, b2] = await Promise.all([call(T, "POST", "/api/team", { name: "Race One", phone: rnd(), role: "staff" }), call(T, "POST", "/api/team", { name: "Race Two", phone: rnd(), role: "staff" })]);
t([b1.r.status, b2.r.status].sort().join() === "201,403", "seats: two invitations racing for the last seat -> exactly one wins", `${b1.r.status},${b2.r.status}`);
const full = await call(T, "POST", "/api/team", { name: "No Room", phone: rnd(), role: "staff" }); t(full.r.status === 403 && full.j.limit === 3, "seats: a pending invitation holds a seat");
pg = await page(T, "/app/settings"); t(/Team seats/.test(pg.html) && /3 \/ 3/.test(pg.html.replace(/<!-- -->/g, "")), "seats: Settings shows 3 / 3");
await call(T, "DELETE", `/api/team/${a.j.id}`);
const again = await call(T, "POST", "/api/team", { name: "Fits Now", phone: rnd(), role: "staff" }); t(again.r.status === 201, "seats: cancelling an invitation frees its seat");

/* ---------------- removal ---------------- */
x = await call(O, "DELETE", `/api/team/${ravi}`); t(x.r.status === 200, "owner: removes a member");
pg = await page(S, "/app/dashboard"); t(!pg.html.includes(OWN), "removal: their old session no longer reaches the business");
x = await call(S, "POST", "/api/qr", { name: "After removal", type: "url", config: { url: "https://example.com" }, publish: true });
pg = await page(O, "/app/library"); t(!pg.html.includes("After removal"), "removal: nothing they do afterwards lands in the business");
pg = await page(O, "/app/settings"); t(!pg.html.includes(`data-member="${ravi}"`) && pg.html.includes(`data-member="${meena}"`), "removal: they are off the team list, the others are not");
r1 = await signInAs(P1);
t(r1.verify?.r.status === 200, "removal: their number can sign in again (on its own)");
x = await call(O, "POST", "/api/team", { name: "Ravi Kumar", phone: P1, role: "staff" }); t(x.r.status === 409 && x.j.error === "has_workspace", "removal: ...and once it has made its own business it can't be invited back", JSON.stringify(x.j));

/* ---------------- sign-ups closed ---------------- */
const flag = (enabled) => call(admin, "PUT", "/api/admin/flags", { key: "signups_open", enabled });
const P4 = rnd(), P5 = rnd();
x = await call(O, "POST", "/api/team", { name: "Late Joiner", phone: P4, role: "staff" }); t(x.r.status === 201, "setup: another invitation");
x = await flag(false); t(x.r.status === 200, "switch: sign-ups closed");
{
  const stranger = await signInAs(P5, "signup", "Stranger Cafe"); t(stranger.send.r.status === 403 && stranger.send.j.error === "signups_closed", "closed: a stranger can't sign up");
  const invited = await signInAs(P4); t(invited.verify?.r.status === 200 && invited.verify.j.next === "/app/dashboard", "closed: an invited person can still join", JSON.stringify(invited.send.j));
}
x = await flag(true); t(x.r.status === 200, "switch: sign-ups open again");

/* ---------------- audit ---------------- */
pg = await page(O, "/app/settings");
const text = pg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
t(/Team member added/.test(text) && /Team role changed/.test(text) && /Team member removed/.test(text), "audit: invitations, role changes and removals are logged");
t(/Meena S \(Manager\)/.test(text) || /Ravi Kumar \(Staff\)/.test(text), "audit: ...with who did it, by name and role");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
