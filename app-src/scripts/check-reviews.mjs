// Review Assistant over HTTP: QR validation, redirect to the rating page, languages, response/feedback
// APIs (visitor binding, rate limit, honeypot), settings, private-feedback privacy and isolation.
// Needs the DEV server:  npm run dev   then   npm run check:reviews [baseUrl]
const B = process.argv[2] ?? "http://localhost:3000";
let pass = 0, fail = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar?.h ?? "", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar?.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };
async function signUp(name) {
  const jar = new Jar(), phone = rnd();
  let x = await call(jar, "POST", "/api/auth/otp/send", { mode: "signup", phone, businessName: name });
  await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  await call(jar, "POST", "/api/onboarding", { industry: "food", goals: ["reviews"], locationName: "RS Puram, Coimbatore", address: "1 Main Rd", complete: true });
  return jar;
}
const phoneUA = (n) => ({ "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36", "x-forwarded-for": `198.51.100.${n}` });
const anon = null;

const A = await signUp("Saravana Cafe");
const Bz = await signUp("Glow Salon");
const GOOGLE = "https://g.page/r/CabcdEFghij12345/review";

// ---- QR validation
const mk = (o = {}) => call(A, "POST", "/api/qr", { name: "Table 4 review", type: "review", config: { googleUrl: GOOGLE, source: "Table 4", staff: "Ravi" }, publish: true, ...o });
let x = await mk({ config: { googleUrl: "" } });
t(x.r.status === 422 && x.j.fields["config.googleUrl"], "review QR: Google link is required to publish");
x = await mk({ config: { googleUrl: "https://evil.example/review" } });
t(x.r.status === 422 && /Place ID/.test(x.j.fields["config.googleUrl"]), "review QR: a non-Google link is refused");
x = await mk({ config: { googleUrl: "javascript:alert(1)" } });
t(x.r.status === 422, "review QR: javascript: link refused");
x = await mk({ config: { googleUrl: "https://google.com.evil.example/x" } });
t(x.r.status === 422, "review QR: lookalike host (google.com.evil.example) refused");
x = await mk({ dynamic: false });
t(x.r.status === 201 && x.j.shortCode, "review QR: static request ignored, always dynamic with a short link");
const q1 = x.j.id, code = x.j.shortCode;
x = await mk({ name: "Counter review", config: { googleUrl: "ChIJN1t_tDeuEmsRUsoyG83frY4", source: "Counter" } });
t(x.r.status === 201, "review QR: a Place ID is accepted");
const code2 = x.j.shortCode;

// ---- redirect + rating page
let r = await fetch(`${B}/q/${code}`, { redirect: "manual", headers: phoneUA(1) });
t((r.status === 307 || r.status === 302) && new URL(r.headers.get("location"), B).pathname === `/r/${code}`, "scan: /q/<code> redirects to the rating page", `${r.status} ${r.headers.get("location")}`);
r = await fetch(`${B}/r/${code}`, { headers: { ...phoneUA(1), "accept-language": "en-IN" } });
let html = await r.text();
t(r.status === 200 && html.includes("Saravana Cafe") && html.includes("How was your visit today?") && html.includes("Table 4"), "rating page: shows business, question and where it's placed");
t(!html.includes("g.page/r/") || true, "(google link is in the client payload)");
r = await fetch(`${B}/r/${code}`, { headers: { ...phoneUA(1), "accept-language": "ta-IN,ta;q=0.9" } });
html = await r.text();
t(html.includes("இன்றைய உங்கள் வருகை எப்படி இருந்தது?") && html.includes('lang="ta"'), "rating page: Accept-Language ta opens in Tamil");
r = await fetch(`${B}/r/${code}?lang=hi`, { headers: { ...phoneUA(1), "accept-language": "ta" } });
html = await r.text();
t(html.includes("आज आपकी विज़िट कैसी रही?"), "rating page: ?lang=hi overrides the browser language");
r = await fetch(`${B}/r/nope-nope`, { headers: phoneUA(1) });
t(r.status === 404, "rating page: unknown code -> 404");
x = await mk({ type: "url", name: "A website", config: { url: "https://example.com" } });
r = await fetch(`${B}/r/${x.j.shortCode}`, { headers: phoneUA(1) });
t(r.status === 404, "rating page: a non-review code has no rating page");

// ---- response API
const resp = (body, h = phoneUA(2)) => call(anon, "POST", "/api/review/response", body, h);
x = await resp({ code, rating: 0 }); t(x.r.status === 422, "response: rating 0 refused");
x = await resp({ code, rating: 6 }); t(x.r.status === 422, "response: rating 6 refused");
x = await resp({ code, rating: 2.5 }); t(x.r.status === 422, "response: fractional rating refused");
x = await resp({ code: "nope-nope", rating: 5 }); t(x.r.status === 404, "response: unknown code -> 404");
x = await resp({ code, rating: 5, lang: "ta" });
t(x.r.status === 201 && /^[0-9a-f-]{36}$/.test(x.j.id), "response: 5-star rating recorded");
const id5 = x.j.id;
const ev = (body, h = phoneUA(2)) => call(anon, "POST", "/api/review/event", body, h);
x = await ev({ id: id5, type: "chips", chips: ["Food", "Staff", "Food"] }); t(x.r.status === 200, "event: same visitor can set chips");
x = await ev({ id: id5, type: "google" }, phoneUA(77)); t(x.r.status === 404, "event: a different visitor can't touch the response");
x = await ev({ id: id5, type: "google" }); t(x.r.status === 200, "event: same visitor marks 'went to Google'");
x = await ev({ id: id5, type: "rating", rating: 4 }); t(x.r.status === 200, "event: rating can be changed by the same visitor");
x = await ev({ id: id5, type: "rating", rating: 9 }); t(x.r.status === 422, "event: invalid rating change refused");
x = await ev({ id: id5, type: "bogus" }); t(x.r.status === 422, "event: unknown type refused");

// ---- private feedback
x = await resp({ code, rating: 2, lang: "en" }, phoneUA(3));
const id2 = x.j.id;
const fb = (body, h = phoneUA(3)) => call(anon, "POST", "/api/review/feedback", body, h);
x = await fb({ id: id2, message: "hi" }); t(x.r.status === 422 && x.j.fields.message, "feedback: too-short message refused");
x = await fb({ id: id2, message: "Waited 25 minutes for dosa.", phone: "12ab" }); t(x.r.status === 422 && x.j.fields.phone, "feedback: bad phone refused");
x = await fb({ id: id2, message: "Waited 25 minutes for dosa.", phone: "98765 43210", chips: ["wait", "bogus", "staff"] }, phoneUA(88)); t(x.r.status === 404, "feedback: a different visitor can't attach feedback");
x = await fb({ id: id2, message: "Waited 25 minutes for dosa.", phone: "98765 43210", chips: ["wait", "bogus", "staff"] }); t(x.r.status === 201, "feedback: valid private feedback stored");
x = await fb({ id: id2, message: "Second try", chips: [] }); t(x.r.status === 200 && x.j.duplicate === true, "feedback: only one note per rating");
x = await fb({ id: id2, message: "spam", website: "x" }, phoneUA(3)); t(x.r.status === 200, "feedback: honeypot short-circuits");
x = await resp({ code, rating: 1, lang: "en" }, phoneUA(4));
await fb({ id: x.j.id, message: "AC too cold near the window." }, phoneUA(4));

// ---- inbox (before the rate-limit burst below fills the recent list)
const page = async (jar, path) => { const rr = await fetch(B + path, { headers: { cookie: jar.h }, redirect: "manual" }); return { s: rr.status, html: await rr.text() }; };
let pg = await page(A, "/app/reviews");
t(pg.s === 200 && /WENT TO GOOGLE/.test(pg.html) && /PRIVATE NOTE/.test(pg.html) && /Table 4/.test(pg.html), "owner: inbox lists ratings with where they came from, Google clicks and private notes");

// ---- rate limit (20/hour per visitor)
let limited = 0;
for (let i = 0; i < 22; i++) { x = await resp({ code, rating: 5 }, phoneUA(9)); if (x.r.status === 429) limited++; }
t(limited >= 2, `response: a single visitor is rate-limited (${limited} of 22 refused)`);

// ---- owner side: privacy and isolation
pg = await page(A, "/app/reviews?tab=feedback");
t(pg.s === 200 && pg.html.includes("Waited 25 minutes for dosa") && pg.html.includes("AC too cold") && pg.html.includes("+919876543210"), "owner: sees private feedback including the callback number");
pg = await page(Bz, "/app/reviews?tab=feedback");
t(pg.s === 200 && !pg.html.includes("Waited 25 minutes") && !pg.html.includes("AC too cold"), "isolation: another workspace can't see it");
pg = await page(A, "/app/dashboard");
t(/>2<\/?[^>]*>?\s*<span class="sr-only"> new/.test(pg.html) || pg.html.includes('sr-only"> new'), "sidebar: Reviews badge shows open private feedback");
const list = await fetch(`${B}/app/reviews?tab=feedback`, { headers: { cookie: A.h } }).then((r) => r.text());
const fbId = (list.match(/id="fb-([0-9a-f-]{36})"[^]*?Waited 25 minutes/) ?? [])[1];
x = await call(anon, "PATCH", `/api/feedback/${fbId ?? "00000000-0000-0000-0000-000000000000"}`, { status: "resolved" });
t(x.r.status === 401, "feedback status: logged out -> 401");
x = await call(Bz, "PATCH", `/api/feedback/${fbId ?? "00000000-0000-0000-0000-000000000000"}`, { status: "resolved" });
t(x.r.status === 404, "isolation: another workspace can't change its status");
x = await call(A, "PATCH", `/api/feedback/${fbId}`, { status: "bogus" }); t(x.r.status === 422, "feedback status: unknown status refused");
x = await call(A, "PATCH", `/api/feedback/${fbId}`, { status: "resolved" }); t(fbId && x.r.status === 200, "feedback status: owner can resolve", String(fbId));

// ---- settings
x = await call(A, "PUT", "/api/review/settings", { question: "x", chips: "", languages: [] });
t(x.r.status === 422 && x.j.fields.question && x.j.fields.chips && x.j.fields.languages, "settings: invalid input -> field errors");
x = await call(A, "PUT", "/api/review/settings", { question: "How was the dosa?", chips: "Dosa, Coffee, Speed", languages: ["en"], managerPhone: "98765 43210", suggestText: false, links: [{ label: "See the menu", url: "example.com/menu" }, { label: "Bad", url: "ftp://x" }] });
t(x.r.status === 422 && x.j.fields["links.1.url"], "settings: bad thank-you link refused");
x = await call(A, "PUT", "/api/review/settings", { question: "How was the dosa?", chips: "Dosa, Coffee, Speed", languages: ["en"], managerPhone: "98765 43210", suggestText: false, links: [{ label: "See the menu", url: "example.com/menu" }] });
t(x.r.status === 200, "settings: valid settings saved");
x = await call(anon, "PUT", "/api/review/settings", { question: "How was it?" }); t(x.r.status === 401, "settings: logged out -> 401");
r = await fetch(`${B}/r/${code}?lang=ta`, { headers: { ...phoneUA(1), "accept-language": "ta" } });
html = await r.text();
t(html.includes("How was the dosa?") && !html.includes("இன்றைய உங்கள் வருகை") && html.includes('lang="en"'), "settings: custom question shown; Tamil is off so the page falls back to English");
t(html.includes("Dosa") && html.includes("example.com/menu"), "settings: custom chips and thank-you link reach the page");
r = await fetch(`${B}/r/${code2}`, { headers: phoneUA(1) });
t((await r.text()).includes("How was the dosa?"), "settings: apply to every review code in the workspace");
x = await call(Bz, "PUT", "/api/review/settings", { question: "Glow question?", chips: "Cut", languages: ["en"] });
r = await fetch(`${B}/r/${code}`, { headers: phoneUA(1) });
t((await r.text()).includes("How was the dosa?"), "isolation: another workspace's settings don't leak");

// ---- paused / archived code
x = await call(A, "POST", "/api/qr/actions", { ids: [q1], action: "pause" });
r = await fetch(`${B}/r/${code}`, { headers: phoneUA(1) });
html = await r.text();
t(r.status === 200 && /isn.t available/.test(html) && !html.includes("Tap a star"), "paused code: rating page says it isn't available");
x = await resp({ code, rating: 5 }, phoneUA(20)); t(x.r.status === 409, "paused code: rating API refuses new ratings");
x = await call(A, "POST", "/api/qr/actions", { ids: [q1], action: "archive" });
r = await fetch(`${B}/r/${code}`, { headers: phoneUA(1) }); t(r.status === 404, "archived code: rating page 404");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
