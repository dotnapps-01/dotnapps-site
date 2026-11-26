// Engage over HTTP: pages (menu / card / bio), lead forms + pipeline + contacts, coupons (claim, limits,
// redeem-once), loyalty (PIN lockout, one stamp a day, reward earned) and workspace isolation.
// Needs the DEV server:  npm run dev   then   npm run check:engage [baseUrl]
// Set DATABASE_URL (same database as the server) to also test multi-day loyalty rewards; the script
// moves a card's last stamp back a day between stamps. Without it those checks are skipped.
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
  await call(jar, "POST", "/api/onboarding", { industry: "food", goals: ["menu"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
const page = async (jar, path, headers = {}) => { const r = await fetch(B + path, { headers: { cookie: jar?.h ?? "", ...headers }, redirect: "manual" }); return { s: r.status, html: await r.text() }; };
const mkQr = (jar, type, name, config) => call(jar, "POST", "/api/qr", { name, type, config, publish: true });
const UA = (n) => ({ "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36", "x-forwarded-for": `198.51.100.${n}` });
const anon = null;

// Workspace 1: pages. Workspace 2: forms + coupons. Workspace 3: bio page + loyalty, and the outsider for isolation checks.
// (Free plans allow 3 dynamic codes each, so the work is split.)
const W1 = await signUp("Saravana Cafe"), W2 = await signUp("Smile Dental"), W3 = await signUp("Glow Salon");

/* =============================== PAGES =============================== */
let x = await call(W1, "POST", "/api/pages", { kind: "nope", title: "x" }); t(x.r.status === 422, "pages: unknown kind refused");
x = await call(W1, "POST", "/api/pages", { kind: "menu", title: "a" }); t(x.r.status === 422 && x.j.fields.title, "pages: short title refused");
x = await call(W1, "POST", "/api/pages", { kind: "menu", title: "Dinner menu" }); t(x.r.status === 201, "pages: menu created as a draft");
const menuId = x.j.id;
const menu = { subtitle: "Saravana Cafe · Anna Nagar", whatsapp: "98765 43210", sections: [
  { id: "dosa", name: "Dosa", items: [{ id: "i1", name: "Ghee Roast Dosa", price: 140, veg: "veg", tags: ["Bestseller"], description: "Crisp and golden", available: true }, { id: "i2", name: "Podi Dosa", price: 120, veg: "veg", tags: [], description: "", available: false }] },
  { id: "bev", name: "Beverages", items: [{ id: "i3", name: "Filter Coffee", price: 60, veg: "veg", tags: [], description: "", available: true }] },
] };
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "draft", content: { ...menu, sections: [{ id: "a", name: "", items: [] }] } });
t(x.r.status === 422 && x.j.fields["sections.0.name"], "pages: unnamed section refused");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "draft", content: { ...menu, sections: [{ id: "a", name: "A", items: [{ name: "X", price: "abc" }] }] } });
t(x.r.status === 422 && x.j.fields["sections.0.items.0.price"], "pages: bad price refused");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "draft", content: { ...menu, whatsapp: "12" } });
t(x.r.status === 422 && x.j.fields.whatsapp, "pages: bad WhatsApp number refused");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "published", content: { subtitle: "", whatsapp: "", sections: [{ id: "a", name: "A", items: [] }] } });
t(x.r.status === 422 && x.j.fields.sections, "pages: an empty menu can't be published");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "draft", content: menu }); t(x.r.status === 200, "pages: valid menu saved as draft");
x = await mkQr(W1, "menu", "Menu QR", { pageId: menuId });
t(x.r.status === 422 && /Publish that page first/.test(x.j.fields["config.pageId"]), "QR: can't point at a draft page");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "published", content: menu }); t(x.r.status === 200, "pages: menu published");
x = await mkQr(W1, "menu", "Menu QR", { pageId: menuId }); t(x.r.status === 201 && x.j.shortCode, "QR: menu code created");
const menuCode = x.j.shortCode;
let r = await fetch(`${B}/q/${menuCode}`, { redirect: "manual", headers: UA(1) });
t((r.status === 307 || r.status === 302) && new URL(r.headers.get("location"), B).pathname === `/s/${menuCode}`, "scan: /q/<code> -> /s/<code>", `${r.status} ${r.headers.get("location")}`);
let pg = await page(anon, `/s/${menuCode}`, { ...UA(1), "accept-language": "en-IN" });
t(pg.s === 200 && pg.html.includes("Ghee Roast Dosa") && pg.html.includes("Saravana Cafe") && pg.html.includes("Sold out") && pg.html.includes("Order on WhatsApp"), "menu page: items, sold-out marker and WhatsApp order button");
t(pg.html.includes("Filter Coffee") && pg.html.includes("₹140"), "menu page: prices shown in rupees");
pg = await page(anon, `/s/${menuCode}`, { ...UA(1), "accept-language": "ta" });
t(pg.html.includes("மெனு பிரிவுகள்") && pg.html.includes('lang="ta"'), "menu page: Tamil chrome from Accept-Language");
pg = await page(anon, `/s/${menuCode}?lang=hi`, UA(1)); t(pg.html.includes("मेन्यू के हिस्से"), "menu page: ?lang=hi gives Hindi chrome");
x = await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "draft", content: menu });
t(x.r.status === 409, "pages: a page with a live QR can't go back to draft");
x = await call(W1, "DELETE", `/api/pages/${menuId}`); t(x.r.status === 409, "pages: a page in use can't be deleted");
// edit published page: the printed code shows the change
const menu2 = { ...menu, sections: [{ ...menu.sections[0], items: [{ ...menu.sections[0].items[0], name: "Royal Ghee Roast" }] }, menu.sections[1]] };
await call(W1, "PATCH", `/api/pages/${menuId}`, { title: "Dinner menu", status: "published", content: menu2 });
pg = await page(anon, `/s/${menuCode}`, UA(1)); t(pg.html.includes("Royal Ghee Roast") && !pg.html.includes("Ghee Roast Dosa"), "pages: editing a published page updates the printed code at once");

x = await call(W1, "POST", "/api/pages", { kind: "card", title: "Meena S." }); const cardId = x.j.id;
x = await call(W1, "PATCH", `/api/pages/${cardId}`, { title: "Meena S.", status: "draft", content: { name: "Meena S.", email: "nope" } }); t(x.r.status === 422 && x.j.fields.email, "card: bad email refused");
x = await call(W1, "PATCH", `/api/pages/${cardId}`, { title: "Meena S.", status: "published", content: { name: "Meena S." } }); t(x.r.status === 422, "card: needs at least one way to reach the person");
x = await call(W1, "PATCH", `/api/pages/${cardId}`, { title: "Meena S.", status: "published", content: { name: "Meena S.", role: "Manager", company: "Saravana Cafe", phone: "98765 43210", whatsapp: "98765 43210", email: "meena@example.com", website: "example.com", address: "1 Main Rd; Chennai" } });
t(x.r.status === 200, "card: published");
x = await mkQr(W1, "vcard", "Meena card", { pageId: cardId }); t(x.r.status === 201, "QR: business-card code created");
pg = await page(anon, `/s/${x.j.shortCode}`, UA(2));
t(pg.html.includes("Meena S.") && pg.html.includes("data:text/vcard") && pg.html.includes("BEGIN%3AVCARD") && pg.html.includes("tel:+919876543210") && pg.html.includes("wa.me/919876543210"), "card page: vCard download, call and WhatsApp links");
x = await mkQr(W1, "menu", "Wrong kind", { pageId: cardId }); t(x.r.status === 422, "QR: a menu code can't point at a card page");

x = await call(W3, "POST", "/api/pages", { kind: "bio", title: "Glow links" }); const bioId = x.j.id;
x = await call(W3, "PATCH", `/api/pages/${bioId}`, { title: "Glow links", status: "published", content: { headline: "x", links: [{ label: "Bad", url: "javascript:alert(1)" }] } }); t(x.r.status === 422 && x.j.fields["links.0.url"], "bio: javascript: link refused");
x = await call(W3, "PATCH", `/api/pages/${bioId}`, { title: "Glow links", status: "published", content: { headline: "Find us", links: [{ label: "Instagram", url: "instagram.com/glow" }] } }); t(x.r.status === 200, "bio: published");
x = await mkQr(W3, "bio", "Bio QR", { pageId: bioId }); t(x.r.status === 201, "QR: link-in-bio code created");
pg = await page(anon, `/s/${x.j.shortCode}`, UA(3)); t(pg.html.includes("Instagram") && pg.html.includes("https://instagram.com/glow") && pg.html.includes('rel="noopener noreferrer"'), "bio page: links open safely");

x = await call(W3, "PATCH", `/api/pages/${menuId}`, { title: "Hijack", status: "published", content: menu }); t(x.r.status === 404, "isolation: another workspace can't edit this page");
x = await call(W3, "DELETE", `/api/pages/${menuId}`); t(x.r.status === 404, "isolation: ...or delete it");
x = await mkQr(W3, "menu", "Steal", { pageId: menuId }); t(x.r.status === 422, "isolation: ...or point a QR code at it");
pg = await page(W3, "/app/pages"); t(pg.s === 200 && !pg.html.includes("Dinner menu"), "isolation: its pages list doesn't show it");

/* =============================== LEAD FORMS & LEADS =============================== */
x = await call(W2, "POST", "/api/lead-forms", { title: "x" }); t(x.r.status === 422, "forms: short title refused");
x = await call(W2, "POST", "/api/lead-forms", { title: "Free dental check-up", fields: ["interest"], interests: ["Check-up"] }); t(x.r.status === 422 && x.j.fields.interests, "forms: interest field needs 2+ choices");
x = await call(W2, "POST", "/api/lead-forms", { title: "Free dental check-up", intro: "We call within 2 hours.", fields: ["email", "interest", "time", "message"], interests: ["Check-up", "Braces", "Implants"], submitLabel: "Request a callback", notifyPhone: "98765 43210" });
t(x.r.status === 201, "forms: lead form created"); const formId = x.j.id;
x = await call(W2, "POST", "/api/lead-forms", { title: "Unused form" }); const spareForm = x.j.id;
x = await mkQr(W2, "lead", "Check-up QR", { formId }); t(x.r.status === 201, "QR: lead-form code created"); const leadCode = x.j.shortCode;
pg = await page(anon, `/s/${leadCode}`, UA(10)); t(pg.s === 200 && pg.html.includes("Free dental check-up") && pg.html.includes("Braces") && pg.html.includes("Preferred time"), "lead page: form with the chosen fields and choices");
pg = await page(anon, `/s/${leadCode}?lang=ta`, UA(10)); t(pg.html.includes("WhatsApp எண்"), "lead page: Tamil labels");

const lead = (body, h = UA(11)) => call(anon, "POST", "/api/s/lead", { code: leadCode, ...body }, h);
x = await lead({ name: "K", phone: "123" }); t(x.r.status === 422 && x.j.fields.name && x.j.fields.phone, "lead: missing name and bad phone refused");
x = await lead({ name: "Karthik R.", phone: "98765 00001", interest: "Surgery" }); t(x.r.status === 422 && x.j.fields.interest, "lead: a choice that isn't on the form is refused");
x = await lead({ name: "Karthik R.", phone: "98765 00001", email: "bad" }); t(x.r.status === 422 && x.j.fields.email, "lead: bad email refused");
x = await lead({ name: "Karthik R.", phone: "98765 00001", email: "k@example.com", interest: "Braces", time: "Evening", message: "Want braces for my son", optIn: true }); t(x.r.status === 201, "lead: valid submission stored");
x = await lead({ name: "Lakshmi V.", phone: "98765 00002", message: "Bulk checkup for staff" }, UA(12)); t(x.r.status === 201, "lead: second lead");
x = await lead({ name: "Karthik again", phone: "+91 98765 00001", message: "Following up" }, UA(13)); t(x.r.status === 201, "lead: same number again becomes another lead");
x = await lead({ name: "Bot", phone: "98765 00003", website: "x" }, UA(14)); t(x.r.status === 200, "lead: honeypot short-circuits");
x = await call(anon, "POST", "/api/s/lead", { code: "nope-nope", name: "A B", phone: "9876500004" }, UA(15)); t(x.r.status === 404, "lead: unknown code -> 404");
let limited = 0; for (let i = 0; i < 12; i++) { x = await lead({ name: "Spam person", phone: `98765 1${String(i).padStart(4, "0")}` }, UA(99)); if (x.r.status === 429) limited++; }
t(limited >= 2, `lead: a single visitor is throttled (${limited} of 12 refused)`);

pg = await page(W2, "/app/leads");
const idOf = (html, name) => (html.match(new RegExp(`id="lead-([0-9a-f-]{36})"[^]*?aria-label="Lead ${name}`)) ?? [])[1] ?? (html.match(new RegExp(`<article id="lead-([0-9a-f-]{36})" aria-label="Lead ${name}`)) ?? [])[1];
const kid = idOf(pg.html, "Karthik R\\.");
t(pg.s === 200 && pg.html.includes("Karthik R.") && pg.html.includes("Lakshmi V.") && !pg.html.includes("Bot") && kid, "owner: pipeline lists the leads; honeypot lead not stored", String(kid));
x = await call(W2, "PATCH", `/api/leads/${kid}`, { stage: "contacted", owner: "Meena", notes: "Called, wants Saturday" }); t(x.r.status === 200, "owner: move a lead, assign an owner, add notes");
x = await call(W2, "PATCH", `/api/leads/${kid}`, { stage: "bogus" }); t(x.r.status === 422, "owner: unknown stage refused");
x = await call(W3, "PATCH", `/api/leads/${kid}`, { stage: "won" }); t(x.r.status === 404, "isolation: another workspace can't touch the lead");
x = await call(anon, "PATCH", `/api/leads/${kid}`, { stage: "won" }); t(x.r.status === 401, "owner: logged out -> 401");
pg = await page(W2, "/app/leads"); t(/Contacted[^]*?Karthik R\./.test(pg.html) && pg.html.includes("Meena"), "owner: the lead now sits under Contacted with its owner");
pg = await page(W3, "/app/leads"); t(!pg.html.includes("Karthik") && !pg.html.includes("Lakshmi"), "isolation: another workspace's pipeline is empty");
pg = await page(W2, "/app/dashboard"); t(/Leads &amp; contacts[^]*?\d+<span class="sr-only"> new/.test(pg.html), "sidebar: Leads badge counts new leads");

pg = await page(W2, "/app/leads?tab=contacts");
t(pg.html.includes("+919876500001") && pg.html.includes("Lead form"), "contacts: lead submitters appear as contacts");
const ph1 = pg.html.indexOf("+919876500001"); t(/YES/.test(pg.html.slice(ph1 - 300, ph1 + 900)), "contacts: opt-in is recorded when the customer ticked it");
x = await call(W2, "POST", "/api/contacts/import", { rows: [{ name: "Ananya R.", phone: "98765 43210", email: "a@example.com", tags: "VIP;Loyalty" }, { name: "Bad", phone: "12" }, { name: "Dup", phone: "+91 98765 43210" }, { name: "Divya", phone: "9876543211" }] });
t(x.r.status === 200 && x.j.added === 2 && x.j.skipped.length === 2, "import: 2 added, invalid and duplicate rows skipped with reasons", JSON.stringify(x.j));
x = await call(W2, "POST", "/api/contacts/import", { rows: [{ name: "Ananya R.", phone: "98765 43210", tags: "Diwali" }] }); t(x.j.added === 0 && x.j.updated === 1, "import: re-importing updates instead of duplicating");
x = await call(W2, "POST", "/api/contacts/import", { rows: [{ phone: "x" }] }); t(x.r.status === 422, "import: a file with no valid rows is refused");
pg = await page(W2, "/app/leads?tab=contacts&q=ananya"); t(pg.html.includes("Ananya R.") && !pg.html.includes("Lakshmi V.") && pg.html.includes("VIP") && pg.html.includes("Diwali"), "contacts: search and merged tags");
pg = await page(W2, "/app/leads?tab=contacts&segment=opted_in"); t(pg.html.includes("Karthik R.") && !pg.html.includes("Lakshmi V."), "contacts: 'opted in' segment only has people who opted in");
pg = await page(W3, "/app/leads?tab=contacts"); t(!pg.html.includes("+919876500001") && !pg.html.includes("+919876543210"), "isolation: contacts are per workspace");

x = await call(W2, "DELETE", `/api/lead-forms/${formId}`); t(x.r.status === 409, "forms: a form a QR uses can't be deleted");
x = await call(W2, "DELETE", `/api/lead-forms/${spareForm}`); t(x.r.status === 200, "forms: an unused form can be deleted");
x = await call(W3, "PATCH", `/api/lead-forms/${formId}`, { title: "Hijack" }); t(x.r.status === 404 || x.r.status === 422, "isolation: another workspace can't edit the form");

/* =============================== COUPONS =============================== */
x = await call(W2, "POST", "/api/coupons", { title: "x", headline: "", codePrefix: "a" }); t(x.r.status === 422 && x.j.fields.title && x.j.fields.headline && x.j.fields.codePrefix, "coupons: invalid offer refused");
x = await call(W2, "POST", "/api/coupons", { title: "Old offer", headline: "10% off", codePrefix: "OLD", validDays: 7, endsAt: new Date(Date.now() - 86400e3).toISOString() }); const oldCoupon = x.j.id; t(x.r.status === 201, "coupons: offer created");
x = await call(W2, "POST", "/api/coupons", { title: "Weekend coffee", headline: "2 for ₹99", description: "Sat-Sun only", codePrefix: "wknd", validDays: 7, perCustomer: 1, totalLimit: 2 });
t(x.r.status === 201, "coupons: limited offer created (2 claims in total)"); const couponId = x.j.id;
x = await mkQr(W2, "coupon", "Weekend QR", { couponId }); t(x.r.status === 201, "QR: coupon code created"); const couponCode = x.j.shortCode;
pg = await page(anon, `/s/${couponCode}`, UA(20)); t(pg.html.includes("2 for ₹99") && pg.html.includes("Weekend coffee") && pg.html.includes("Claim this offer"), "coupon page: offer and claim form");
pg = await page(anon, `/s/${couponCode}?lang=hi`, UA(20)); t(pg.html.includes("यह ऑफ़र पाएँ"), "coupon page: Hindi claim button");
const claim = (body, h) => call(anon, "POST", "/api/s/coupon", { code: couponCode, ...body }, h);
x = await claim({ phone: "12" }, UA(21)); t(x.r.status === 422, "claim: bad phone refused");
x = await claim({ phone: "98765 20001", name: "Divya S.", optIn: true }, UA(21)); t(x.r.status === 201 && /^WKND-[A-Z2-9]{4}$/.test(x.j.claim.code), `claim: code issued (${x.j?.claim?.code})`, JSON.stringify(x.j));
const c1 = x.j.claim.code;
x = await claim({ phone: "+91 98765 20001" }, UA(21)); t(x.r.status === 200 && x.j.error === "limit_reached" && x.j.claim.code === c1, "claim: same number again gets the same code back");
x = await claim({ phone: "98765 20002" }, UA(22)); t(x.r.status === 201, "claim: a second customer"); const c2 = x.j.claim.code;
x = await claim({ phone: "98765 20003" }, UA(23)); t(x.r.status === 409 && x.j.error === "sold_out", "claim: offer sold out after its total limit");
const rd = (code, confirm, jar = W2) => call(jar, "POST", "/api/redeem", { code, confirm });
x = await rd("nope-0000"); t(x.r.status === 404, "redeem: unknown code");
x = await rd(c1.toLowerCase()); t(x.r.status === 200 && x.j.lookup.status === "valid" && x.j.lookup.label.includes("2 for ₹99"), "redeem: lookup is case-insensitive and shows the offer");
x = await rd(c1, false, W3); t(x.r.status === 404, "isolation: another workspace can't look up the code");
x = await rd(c1, true, W3); t(x.r.status === 404, "isolation: ...or redeem it");
x = await call(anon, "POST", "/api/redeem", { code: c1, confirm: true }); t(x.r.status === 401, "redeem: logged out -> 401");
const [ra, rb] = await Promise.all([rd(c1, true), rd(c1, true)]);
t([ra.r.status, rb.r.status].sort().join() === "200,409", "redeem: two staff redeeming at once, only one succeeds", `${ra.r.status},${rb.r.status}`);
x = await rd(c1); t(x.j.lookup.status === "redeemed", "redeem: the code now reads as redeemed");
x = await call(W2, "PUT", "/api/coupons/" + couponId, {}); // wrong method guard
x = await call(W2, "PATCH", `/api/coupons/${couponId}`, { title: "Weekend coffee", headline: "2 for ₹99", codePrefix: "WKND", validDays: 7, perCustomer: 1, totalLimit: 10, status: "paused" }); t(x.r.status === 200, "coupons: pause an offer (and raise its limit)");
x = await claim({ phone: "98765 20009" }, UA(24)); t(x.r.status === 409 && x.j.error === "paused", "claim: a paused offer can't be claimed");
await call(W2, "PATCH", `/api/coupons/${couponId}`, { title: "Weekend coffee", headline: "2 for ₹99", codePrefix: "WKND", validDays: 7, perCustomer: 1, totalLimit: 10, status: "active" });
x = await mkQr(W2, "coupon", "Old QR", { couponId: oldCoupon }); const oldQr = x.j;
if (oldQr.shortCode) { x = await call(anon, "POST", "/api/s/coupon", { code: oldQr.shortCode, phone: "98765 20010" }, UA(25)); t(x.r.status === 409 && x.j.error === "ended", "claim: an offer past its end date reads as ended"); }
else skip("old coupon QR (plan limit reached)");
pg = await page(W2, "/app/offers"); t(pg.s === 200 && pg.html.includes("Weekend coffee") && pg.html.includes("Recent redemptions") && pg.html.includes("Divya S."), "owner: offers screen shows the offer and the redemption");
x = await call(W2, "DELETE", `/api/coupons/${couponId}`); t(x.r.status === 409, "coupons: an offer a QR uses can't be deleted");
x = await call(W3, "PATCH", `/api/coupons/${couponId}`, { title: "Hijack", headline: "Free", codePrefix: "HAX" }); t(x.r.status === 404, "isolation: another workspace can't edit the offer");

/* =============================== LOYALTY =============================== */
x = await call(W3, "POST", "/api/qr", { name: "Early loyalty", type: "loyalty", config: { program: "program" }, publish: true }); t(x.r.status === 422 && x.j.fields["config.program"], "QR: a loyalty code needs a programme first");
x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee" }); t(x.r.status === 422 && x.j.fields.pin, "loyalty: a staff PIN is required the first time");
x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee", pin: "12ab" }); t(x.r.status === 422 && x.j.fields.pin, "loyalty: PIN must be 4 digits");
x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 1, reward: "x", pin: "7391" }); t(x.r.status === 422 && x.j.fields.stampsNeeded && x.j.fields.reward, "loyalty: invalid stamp count and reward refused");
x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee", pin: "7391" }); t(x.r.status === 200 && !JSON.stringify(x.j).includes("7391"), "loyalty: programme saved, PIN never echoed");
x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee" }); t(x.r.status === 200, "loyalty: later saves keep the existing PIN when left blank");
x = await mkQr(W3, "loyalty", "Counter card", { program: "program" }); t(x.r.status === 201, "QR: loyalty code created"); const loyCode = x.j.shortCode;
pg = await page(anon, `/s/${loyCode}?lang=hi`, UA(30)); t(pg.s === 200 && pg.html.includes('lang="hi"') && pg.html.includes("Glow Salon"), "loyalty page: renders for the business in Hindi (join form is client-side; see the browser test)");
const ly = (action, body, h) => call(anon, "POST", "/api/s/loyalty", { code: loyCode, action, ...body }, h);
x = await ly("join", { phone: "5" }, UA(31)); t(x.r.status === 422, "loyalty: bad phone refused");
x = await ly("view", { phone: "98765 30001" }, UA(31)); t(x.r.status === 404, "loyalty: viewing a card that doesn't exist -> 404");
x = await ly("join", { phone: "98765 30001", name: "Priya", optIn: true }, UA(31));
t(x.r.status === 200 && x.j.card.stamps === 0 && x.j.card.needed === 3 && x.j.card.name === "" && !JSON.stringify(x.j).includes("9876530001") && x.j.card.phone.includes("x"), "loyalty: join -> empty card; response has no name or full number");
x = await ly("view", { phone: "98765 30001" }, UA(31)); t(x.r.status === 200 && x.j.card.stamps === 0, "loyalty: card can be reopened by number");
const stamp = (pin, phone = "98765 30001", h = UA(32)) => ly("stamp", { phone, pin }, h);
x = await stamp("0000", "98765 39999"); t(x.r.status === 404, "stamp: no card -> 404");
const seq = []; for (let i = 0; i < 6; i++) { x = await stamp("0000"); seq.push(x.r.status + (x.j.attemptsLeft !== undefined ? `/${x.j.attemptsLeft}` : "")); }
t(seq.join(",") === "401/4,401/3,401/2,401/1,429,429", "stamp: 5 wrong PINs count down, then the card locks", seq.join(","));
x = await stamp("7391"); t(x.r.status === 429 && x.j.error === "locked", "stamp: the right PIN is refused while locked");
x = await ly("join", { phone: "98765 30002", name: "Ravi" }, UA(33));
x = await stamp("7391", "98765 30002", UA(34)); t(x.r.status === 200 && x.j.card.stamps === 1 && !x.j.rewardEarned, "stamp: correct PIN adds a stamp");
x = await stamp("7391", "98765 30002", UA(34)); t(x.r.status === 409 && x.j.error === "already_today", "stamp: only one stamp per day");

const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const { default: pgmod } = await import("pg");
  const db = new pgmod.Client({ connectionString: dbUrl }); await db.connect();
  const back = () => db.query("update loyalty_cards set last_stamp_at = last_stamp_at - interval '2 days' where phone = '+919876530002'");
  await back(); x = await stamp("7391", "98765 30002", UA(34)); t(x.r.status === 200 && x.j.card.stamps === 2, "stamp: a day later, another stamp");
  await back(); x = await stamp("7391", "98765 30002", UA(34));
  t(x.r.status === 200 && x.j.rewardEarned === true && x.j.card.stamps === 0 && x.j.card.rewards.length === 1 && /^RWD-[A-Z2-9]{6}$/.test(x.j.card.rewards[0].code), "stamp: the 3rd stamp earns a reward voucher and the card restarts", JSON.stringify(x.j));
  const reward = x.j.card.rewards[0].code;
  x = await rd(reward, undefined, W3); t(x.j.lookup.kind === "reward" && x.j.lookup.status === "valid" && x.j.lookup.label === "1 free coffee", "redeem: reward code is recognised");
  x = await rd(reward, true, W3); t(x.r.status === 200, "redeem: reward redeemed");
  x = await rd(reward, true, W3); t(x.r.status === 409, "redeem: a reward works only once");
  pg = await page(W3, "/app/offers?tab=loyalty"); t(pg.html.includes("Coffee Club") && pg.html.includes("Loyalty reward"), "owner: loyalty tab and the reward in recent redemptions");
  await db.end();
} else { skip("multi-day loyalty rewards (set DATABASE_URL to the server's database to run them)"); }

x = await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee", active: false });
x = await ly("join", { phone: "98765 30009" }, UA(35)); t(x.r.status === 409, "loyalty: a switched-off programme stops new joins");
pg = await page(anon, `/s/${loyCode}`, UA(35)); t(/isn.t available/.test(pg.html), "loyalty page: switched-off programme shows 'not available'");
await call(W3, "PUT", "/api/loyalty", { name: "Coffee Club", stampsNeeded: 3, reward: "1 free coffee", active: true });
let jl = 0; for (let i = 0; i < 12; i++) { x = await ly("join", { phone: `98765 4${String(i).padStart(4, "0")}` }, UA(98)); if (x.r.status === 429) jl++; }
t(jl >= 2, `loyalty: sign-ups from one visitor are throttled (${jl} of 12 refused)`);

/* =============================== analytics hook =============================== */
for (const c of [leadCode, couponCode, loyCode]) await fetch(`${B}/q/${c}`, { redirect: "manual", headers: UA(60) });
pg = await page(W2, "/app/analytics");
t(/\d+ leads/.test(pg.html) && /\d+ claimed/.test(pg.html), "analytics: leads and coupon claims show as actions per code");
pg = await page(W3, "/app/analytics"); t(/\d+ joined/.test(pg.html), "analytics: loyalty joins show as actions per code");

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
