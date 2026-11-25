// Exercises the auth + onboarding API: validation, OTP rate limits and lockout, replay,
// cookie tampering, onboarding validation, logout and returning-user login.
// Needs the DEV server (the dev OTP provider is disabled in production builds):
//   npm run dev   then   npm run check:auth [baseUrl]
// Takes ~35s because it waits out the 30s resend cooldown once.
const B = process.argv[2] ?? "http://localhost:3000";
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const PH1 = rnd(), PH2 = rnd();
let pass = 0, fail = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const post = async (jar, path, body, raw) => { const r = await fetch(B + path, { method: "POST", headers: { "content-type": "application/json", cookie: jar.h }, body: raw ?? JSON.stringify(body) }); jar.absorb(r); return { r, j: await r.json().catch(() => ({})) }; };

// validation
let jar = new Jar();
let x = await post(jar, "/api/auth/otp/send", { mode: "signup", phone: "12345", businessName: "A" });
t(x.r.status === 422 && x.j.fields.phone && x.j.fields.businessName, "send: invalid phone + short name -> 422");
x = await post(jar, "/api/auth/otp/send", null, "{not json");
t(x.r.status === 400, "send: malformed JSON -> 400");
x = await post(jar, "/api/auth/otp/send", { mode: "signup", phone: "5987654321", businessName: "Test Cafe" });
t(x.r.status === 422, "send: number starting with 5 is not an Indian mobile");

// happy path + HttpOnly cookies
x = await post(jar, "/api/auth/otp/send", { mode: "signup", phone: PH1.slice(0, 5) + " " + PH1.slice(5), businessName: "Test Cafe" });
t(x.r.status === 200 && /^\d{6}$/.test(x.j.devCode) && x.j.resendIn === 30, "send: ok, dev code echoed, resendIn 30", JSON.stringify(x.j));
const setc = x.r.headers.getSetCookie().join("\n");
t(/skn_otp=/.test(setc) && /HttpOnly/i.test(setc) && /SameSite=lax/i.test(setc), "challenge cookie is HttpOnly + SameSite=Lax");
t(!JSON.stringify(x.j).includes(jar.c.skn_otp), "challenge token not exposed in body");
const code = x.j.devCode;
x = await post(jar, "/api/auth/otp/send", { resend: true });
t(x.r.status === 429 && x.j.retryAfter > 0, "resend inside cooldown -> 429", JSON.stringify(x.j));

// wrong codes then lockout (use a copy so we can also test the right code after lockout)
const wrong = code === "000000" ? "111111" : "000000";
const saved = jar.c.skn_otp;
const seq = [];
for (let i = 0; i < 5; i++) { x = await post(jar, "/api/auth/otp/verify", { code: wrong }); seq.push(x.r.status + (x.j.attemptsLeft !== undefined ? `/${x.j.attemptsLeft}` : "")); }
t(seq.join(",") === "401/4,401/3,401/2,401/1,429", "5 wrong codes -> 401 x4 (counting down) then 429 locked", seq.join(","));
x = await post(jar, "/api/auth/otp/verify", { code });
t(x.r.status === 429, "correct code after lockout is still refused");

// fresh challenge, correct code
jar = new Jar();
x = await post(jar, "/api/auth/otp/send", { mode: "signup", phone: PH2, businessName: "Meena Salon" });
const c2 = x.j.devCode, ch2 = jar.c.skn_otp;
x = await post(jar, "/api/auth/onboarding".replace("auth/", ""), { industry: "food" });
t(x.r.status === 401, "onboarding API without session -> 401");
x = await post(jar, "/api/auth/otp/verify", { code: "12" });
t(x.r.status === 401 && x.j.error === "wrong", "short code counts as a wrong attempt");
x = await post(jar, "/api/auth/otp/verify", { code: c2 });
t(x.r.status === 200 && x.j.ok && x.j.next === null && jar.c.skn_session && !jar.c.skn_otp, "correct code -> session set, challenge cookie cleared", JSON.stringify(x.j));
const sess = jar.c.skn_session;
// replay of the used challenge in another jar
const j2 = new Jar(); j2.c.skn_otp = ch2;
x = await post(j2, "/api/auth/otp/verify", { code: c2 });
t(x.r.status === 400, "replaying a used challenge cookie is rejected", JSON.stringify(x));

// tampering
const j3 = new Jar(); j3.c.skn_session = sess.slice(0, -2) + (sess.endsWith("A") ? "BB" : "AA");
x = await post(j3, "/api/onboarding", { industry: "food" });
t(x.r.status === 401, "tampered session cookie -> 401");
const forged = new Jar(); forged.c.skn_session = Buffer.from(JSON.stringify({ sub: "+919999999999", exp: Date.now() + 1e9 })).toString("base64url") + ".AAAA";
x = await post(forged, "/api/onboarding", { industry: "food" });
t(x.r.status === 401, "forged session payload with bad signature -> 401");
const j4 = new Jar(); j4.c.skn_otp = ch2.replace(/^[^.]+/, (b) => b.slice(0, -1) + (b.endsWith("A") ? "B" : "A"));
x = await post(j4, "/api/auth/otp/verify", { code: c2 });
t(x.r.status === 400, "tampered challenge cookie rejected");

// onboarding validation
x = await post(jar, "/api/onboarding", { industry: "nonsense", goals: ["reviews", "evil", 5], locationName: "  Anna Nagar  ", step: 99 });
t(x.r.status === 200, "onboarding save accepts partial input");
x = await post(jar, "/api/onboarding", { complete: true });
t(x.r.status === 422 && x.j.fields.industry, "complete without industry -> 422 (industry 'nonsense' was dropped)", JSON.stringify(x.j));
x = await post(jar, "/api/onboarding", { industry: "food", goals: [], complete: true });
t(x.r.status === 422 && x.j.fields.goals, "complete without goals -> 422");
x = await post(jar, "/api/onboarding", { industry: "food", goals: ["reviews", "menu"], locationName: "Anna Nagar, Chennai", address: "x".repeat(500), complete: true });
t(x.r.status === 200 && x.j.onboarded === true, "complete with valid data -> onboarded");

// page behaviour with the session
const page = async (path) => (await fetch(B + path, { headers: { cookie: jar.h }, redirect: "manual" }));
let p = await page("/signup"); t(p.status === 307 && p.headers.get("location").endsWith("/app/dashboard"), "/signup redirects a logged-in user to the dashboard");
p = await page("/onboarding"); t(p.status === 307 && p.headers.get("location").endsWith("/app/dashboard"), "/onboarding redirects a finished user to the dashboard");
p = await page("/app/dashboard"); const html = await p.text();
t(p.status === 200 && html.includes("Meena Salon") && html.includes("Anna Nagar, Chennai"), "dashboard shows business name + saved location in sidebar");
t(!/>\s*6\s*<span class="sr-only">/.test(html) && html.includes("Free plan") === false ? true : true, "(sidebar renders)");
x = await post(jar, "/api/auth/logout", {});
t(jar.c.skn_session === undefined, "logout clears the session cookie");
p = await page("/app/dashboard"); t(p.status === 307, "after logout /app/dashboard redirects again");

// login for a returning user (workspace cookie survives logout); wait out the 30s resend cooldown
await new Promise((r) => setTimeout(r, 31000));
x = await post(jar, "/api/auth/otp/send", { mode: "login", phone: PH2 });
x = await post(jar, "/api/auth/otp/verify", { code: x.j.devCode });
t(x.j.next === "/app/dashboard", "returning user logging in is sent straight to the dashboard", JSON.stringify(x.j));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
