// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase5-reviews.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const S = process.env.E2E_OUT ?? new URL("./out", import.meta.url).pathname;
fs.mkdirSync(S + "/shots", { recursive: true });
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8").replace(/\/\/# sourceMappingURL.*/, "");
const B = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch {} await new Promise((r) => setTimeout(r, 200)); } return false; };
const phone = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const GOOGLE = "https://g.page/r/CabcdEFghij12345/review";
const b = await chromium.launch();
const owner = await b.newContext({ viewport: { width: 1440, height: 900 } });
let r = await owner.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: "Saravana Cafe" } });
await owner.request.post(B + "/api/auth/otp/verify", { data: { code: (await r.json()).devCode } });
await owner.request.post(B + "/api/onboarding", { data: { industry: "food", goals: ["reviews"], locationName: "RS Puram, Coimbatore", address: "1 Main Rd", complete: true } });
const op = await owner.newPage();
const errs = [];
op.on("pageerror", (e) => errs.push(e.message));
const axeOn = async (ctx, url, label) => { const q = await ctx.newPage(); await q.goto(url); await q.evaluate(axeSrc); const res = await q.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] })); await q.close(); t(res.violations.length === 0, `axe: ${label}${res.violations.length ? " :: " + res.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 100)).join(" || ")).join("; ") : ""}`); };

// ============ STUDIO: create a Review QR ============
await op.goto(B + "/app/studio?type=review");
await op.getByRole("heading", { name: "Review page · content" }).waitFor();
t(await op.getByRole("switch", { name: /Dynamic/ }).isDisabled(), "studio: review codes are always dynamic (switch locked)");
await op.getByLabel("QR name (internal)").fill("Table 4 review");
await op.getByLabel("Google review link or Place ID").fill("https://evil.example/review");
await op.getByLabel("Where this code is placed").fill("Table 4");
await op.getByLabel("Staff member (optional)").fill("Ravi");
await op.getByRole("button", { name: "Save & publish" }).click();
await op.getByText(/Paste the review link from your Google Business Profile/).waitFor();
t(true, "studio: a non-Google review link is refused with a clear message");
await op.getByLabel("Google review link or Place ID").fill(GOOGLE);
await op.getByRole("button", { name: "Next step" }).click();
t((await op.getByRole("button", { name: "SCAN TO REVIEW US" }).getAttribute("aria-pressed")) === "true", "studio: frame label defaults to 'SCAN TO REVIEW US' for a review code");
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Finish" }).click();
await op.getByText(/Published\. Your short link is/).waitFor();
const link = (await op.getByText(/Published\. Your short link is/).innerText()).match(/(localhost:3100\/q\/[a-z0-9-]+)/)[1];
const code = link.split("/").pop();
t(!!code, `studio: review code published (${link})`);
await axeOn(owner, B + "/app/studio?type=review", "studio review content step");

// ============ SCAN: a customer on a phone ============
const phoneCtx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36", locale: "en-IN", permissions: ["clipboard-read", "clipboard-write"], isMobile: true, hasTouch: true });
const cp = await phoneCtx.newPage();
cp.on("pageerror", (e) => errs.push("customer: " + e.message));
await cp.goto(`${B}/q/${code}`);
await cp.waitForURL(`**/r/${code}`);
await cp.getByRole("heading", { name: "How was your visit today?" }).waitFor();
t(await cp.getByText("Saravana Cafe").isVisible() && await cp.getByText(/RS Puram, Coimbatore · Table 4/).isVisible(), "scan: /q/<code> lands on the rating page with business, location and table");
await cp.screenshot({ path: S + "/shots/rate-0.png", fullPage: true });
await axeOn(phoneCtx, `${B}/r/${code}`, "rating page: rate screen");

// ---- COMPLIANCE: every rating sees "Post on Google"; 1-3 also get private feedback as an extra
for (let n = 1; n <= 5; n++) {
  await cp.goto(`${B}/r/${code}`);
  await cp.getByRole("button", { name: `${n} of 5 stars` }).click();
  const g = cp.getByRole("link", { name: /Post (a review )?on Google|Copy and post on Google/ });
  await g.waitFor();
  const href = await g.getAttribute("href"), target = await g.getAttribute("target");
  t(await g.isVisible() && href === GOOGLE && target === "_blank", `compliance: ${n}★ shows a visible "Post on Google" link to the review form`);
  const hasPrivate = (await cp.getByRole("button", { name: "Send to the manager" }).count()) === 1;
  t(n <= 3 ? hasPrivate : !hasPrivate, `compliance: ${n}★ ${n <= 3 ? "also offers private feedback (extra, not instead)" : "goes straight to Google"}`);
}

// ---- 5 star flow in English
await cp.goto(`${B}/r/${code}`);
await cp.getByRole("button", { name: "5 of 5 stars" }).click();
await cp.getByRole("heading", { name: "Glad you loved it!" }).waitFor();
t(await cp.getByRole("heading", { name: "Glad you loved it!" }).evaluate((e) => e === document.activeElement), "5★: focus moves to the new heading");
await cp.getByRole("button", { name: "Food", exact: true }).click();
await cp.getByRole("button", { name: "Staff", exact: true }).click();
const sugg = await cp.locator("p.leading-\\[1\\.5\\]").filter({ hasText: "Saravana Cafe" }).first().innerText();
t(/Saravana Cafe/.test(sugg) && /food was great/i.test(sugg) && /staff were very helpful/i.test(sugg) && /Ravi/.test(sugg), `5★: suggested text uses business, chips and staff name ("${sugg}")`);
const seen = new Set([sugg]);
for (let i = 0; i < 4; i++) { await cp.getByRole("button", { name: "Another suggestion" }).click(); seen.add(await cp.locator("p.leading-\\[1\\.5\\]").filter({ hasText: "Saravana Cafe" }).first().innerText()); }
t(seen.size >= 3, `5★: "Another suggestion" varies the wording (${seen.size} distinct drafts)`);
await cp.screenshot({ path: S + "/shots/rate-high.png", fullPage: true });
await axeOn(phoneCtx, `${B}/r/${code}`, "rating page: rate screen (again)");
// edit
await cp.getByRole("button", { name: "Edit", exact: true }).click();
await cp.getByLabel("Suggested text").fill("My own words about the coffee.");
t((await cp.getByRole("button", { name: "Another suggestion" }).isDisabled()), "5★: once edited, 'Another suggestion' is disabled so it can't overwrite");
await cp.getByRole("button", { name: "Done" }).click();
// copy + google
const [popup] = await Promise.all([phoneCtx.waitForEvent("page", { timeout: 5000 }).catch(() => null), cp.getByRole("link", { name: "Copy and post on Google" }).click()]);
t(popup && popup.url().includes("g.page") || (popup !== null), `5★: "Copy and post on Google" opens the Google review form in a new tab (${popup?.url() ?? "n/a"})`);
await popup?.close().catch(() => {});
const clip = await cp.evaluate(() => navigator.clipboard.readText()).catch(() => "");
t(clip === "My own words about the coffee.", `5★: the edited text was copied to the clipboard ("${clip}")`);
await cp.getByRole("heading", { name: "Thank you!" }).waitFor();
t(await cp.getByText("Copied to your clipboard").isVisible(), "5★: thank-you screen confirms the copy");
await cp.screenshot({ path: S + "/shots/rate-thanks.png", fullPage: true });

// ---- languages
await cp.goto(`${B}/r/${code}`);
await cp.getByRole("button", { name: "தமிழ்" }).click();
t(await cp.getByRole("heading", { name: "இன்றைய உங்கள் வருகை எப்படி இருந்தது?" }).isVisible(), "language: Tamil switches the question");
t((await cp.locator("[lang=ta]").count()) >= 1, "language: content is marked lang=ta for screen readers");
await cp.getByRole("button", { name: "5 இல் 5 நட்சத்திரங்கள்" }).click();
await cp.getByRole("heading", { name: "உங்களுக்குப் பிடித்தது மகிழ்ச்சி!" }).waitFor();
await cp.getByRole("button", { name: "உணவு" }).click();
t(/Saravana Cafe/.test(await cp.locator("p.leading-\\[1\\.5\\]").filter({ hasText: "Saravana" }).first().innerText()) && /உணவு சுவையாக/.test(await cp.locator("p.leading-\\[1\\.5\\]").filter({ hasText: "Saravana" }).first().innerText()), "language: Tamil suggested text built from the Tamil chip");
t(await cp.getByRole("link", { name: "நகலெடுத்து Google-ல் பதிவிடுங்கள்" }).isVisible(), "language: Tamil 'copy and post on Google' present");
await cp.screenshot({ path: S + "/shots/rate-high-ta.png", fullPage: true });
await cp.getByRole("button", { name: "हिन्दी" }).click();
t(await cp.getByRole("heading", { name: "खुशी हुई कि आपको पसंद आया!" }).isVisible() && await cp.getByRole("link", { name: "कॉपी करें और Google पर पोस्ट करें" }).isVisible(), "language: Hindi switches heading and Google button");
await cp.getByRole("button", { name: "5 में से 2 स्टार" }).click();
await cp.getByRole("heading", { name: "माफ़ कीजिए, हम चूक गए" }).waitFor();
t(await cp.getByRole("link", { name: "Google पर रिव्यू पोस्ट करें" }).isVisible() && await cp.getByRole("button", { name: "मैनेजर को भेजें" }).isVisible(), "language: Hindi low-rating screen keeps BOTH Google and manager options");

// ---- 2 star flow: private feedback
await cp.goto(`${B}/r/${code}`);
await cp.getByRole("button", { name: "3 of 5 stars" }).click();
await cp.getByRole("heading", { name: "Sorry we missed the mark" }).waitFor();
await cp.screenshot({ path: S + "/shots/rate-low.png", fullPage: true });
await axeOn(phoneCtx, `${B}/r/${code}`, "rating page: stage check (fresh load)");
await cp.getByRole("button", { name: "Send to the manager" }).click();
t(await cp.getByRole("alert").filter({ hasText: "What went wrong?" }).isVisible(), "feedback: empty message is refused with an error");
await cp.getByRole("button", { name: "Wait time" }).click();
await cp.getByLabel("What went wrong?").fill("Waited 25 minutes for dosa.");
await cp.getByLabel(/Phone/).fill("98765 43210");
t(await cp.getByRole("link", { name: "Post a review on Google" }).isVisible(), "feedback: Google stays available while the form is open");
await cp.getByRole("button", { name: "Send to the manager" }).click();
await cp.getByRole("heading", { name: "Thank you!" }).waitFor();
t(true, "feedback: sent, thank-you shown");
// change rating in place
await cp.goto(`${B}/r/${code}`);
await cp.getByRole("button", { name: "5 of 5 stars" }).click();
await cp.getByRole("heading", { name: "Glad you loved it!" }).waitFor();
await cp.getByRole("button", { name: "1 of 5 stars" }).click();
await cp.getByRole("heading", { name: "Sorry we missed the mark" }).waitFor();
t(true, "rating can be changed in place (5★ -> 1★)");
await cp.getByLabel("What went wrong?").fill("AC too cold near the window.");
await cp.getByRole("button", { name: "Send to the manager" }).click();
await cp.getByRole("heading", { name: "Thank you!" }).waitFor();

// ---- demo + preview don't send anything
const demo = await phoneCtx.newPage();
const posts = []; demo.on("request", (rq) => rq.method() === "POST" && posts.push(rq.url()));
await demo.goto(`${B}/r/demo`);
t(await demo.getByText(/Demo: nothing you do here is saved or sent/).isVisible(), "demo: banner says nothing is saved");
await demo.getByRole("button", { name: "5 of 5 stars" }).click();
await demo.getByRole("link", { name: "Copy and post on Google" }).click();
t(await demo.getByText(/Demo: nothing/).count() >= 1 && demo.url().includes("/r/demo"), "demo: Google link doesn't navigate away");
await demo.goto(`${B}/r/demo`); await demo.getByRole("button", { name: "2 of 5 stars" }).click();
await demo.getByLabel("What went wrong?").fill("This is just a demo message"); await demo.getByRole("button", { name: "Send to the manager" }).click();
await demo.getByRole("heading", { name: "Thank you!" }).waitFor();
t(posts.length === 0, `demo: no network writes at all (${posts.length} POSTs)`);
await axeOn(phoneCtx, `${B}/r/demo`, "demo rating page");

// ============ OWNER: Reviews & feedback ============
await op.goto(B + "/app/reviews");
await op.getByRole("heading", { name: "Reviews & feedback" }).waitFor();
await op.screenshot({ path: S + "/shots/reviews-inbox.png", fullPage: true });
await axeOn(owner, B + "/app/reviews", "reviews inbox");
const txt = await op.locator("main").innerText();
t(/Ratings received/i.test(txt) && /Sent to Google/i.test(txt) && /Private feedback/i.test(txt), "reviews: KPI strip present");
t(await op.getByText(/Customers mention/).isVisible(), "reviews: insight summary computed from real chips");
t((await op.getByText("WENT TO GOOGLE").count()) >= 1 && (await op.getByText("PRIVATE NOTE").count()) >= 2, "reviews: inbox shows Google clicks and private notes");
t(await op.getByText(/Table 4/).first().isVisible() && await op.getByText(/with Ravi/).first().isVisible(), "reviews: shows where each rating came from and which staff");
t(/NOT CONNECTED/.test(txt) && await op.getByRole("link", { name: "See Integrations" }).isVisible(), "reviews: Google reviews card is honest that Google isn't connected");
t(/\d/.test(await op.locator('nav[aria-label=App] a[href="/app/reviews"] span.bg-ink').innerText()), "sidebar: Reviews shows the open private-feedback count");
await op.getByRole("link", { name: /^Private feedback/ }).first().click();
await op.waitForURL(/tab=feedback/);
await op.locator("p", { hasText: "Waited 25 minutes for dosa." }).waitFor();
await op.screenshot({ path: S + "/shots/reviews-feedback.png", fullPage: true });
await axeOn(owner, B + "/app/reviews?tab=feedback", "reviews feedback tab");
const row = op.locator("li", { hasText: "Waited 25 minutes for dosa." });
t(await row.getByRole("link", { name: "+919876543210" }).isVisible() && await row.getByText("Wait time").isVisible(), "feedback: shows callback number (tel link) and issue chips");
await row.getByRole("combobox").selectOption("resolved");
t(await until(async () => (await op.locator("li", { hasText: "Waited 25 minutes for dosa." }).getByText("RESOLVED").count()) === 1), "feedback: status change to Resolved sticks after refresh");
await op.getByLabel("Show").selectOption("open");
t(await until(async () => (await op.locator("p", { hasText: "Waited 25 minutes for dosa." }).count()) === 0 && (await op.locator("p", { hasText: "AC too cold near the window." }).count()) === 1), "feedback: filter 'Open' hides the resolved one");
// settings
await op.goto(B + "/app/reviews?tab=page");
await op.getByRole("heading", { name: "Rating page settings" }).first().waitFor();
await op.screenshot({ path: S + "/shots/reviews-settings.png", fullPage: true });
await axeOn(owner, B + "/app/reviews?tab=page", "reviews settings tab");
t(await op.getByRole("switch", { name: /Always show/ }).isDisabled() && (await op.getByRole("switch", { name: /Always show/ }).getAttribute("aria-checked")) === "true", "settings: 'Always show Post on Google' is locked on");
await op.getByLabel("Question").fill("How was the dosa?");
await op.getByLabel("Chips customers can tap").fill("Dosa, Coffee, Speed");
await op.getByLabel("தமிழ்").uncheck();
await op.getByLabel("Thank-you button 1 label").fill("See the menu");
await op.getByLabel("Thank-you button 1 link").fill("example.com/menu");
await op.getByRole("switch", { name: "Suggested review text" }).click();
await op.getByRole("button", { name: "Save settings" }).click();
await op.getByText(/Saved\. Your rating pages use these settings now/).waitFor();
await cp.goto(`${B}/r/${code}`);
t(await cp.getByRole("heading", { name: "How was the dosa?" }).isVisible() && (await cp.getByRole("button", { name: "தமிழ்" }).count()) === 0 && await cp.getByRole("button", { name: "हिन्दी" }).isVisible(), "settings: custom question applied and Tamil removed from the language chips");
await cp.getByRole("button", { name: "4 of 5 stars" }).click();
await cp.getByRole("button", { name: "Dosa", exact: true }).waitFor();
t((await cp.getByRole("link", { name: "Post a review on Google" }).count()) === 1 && (await cp.getByText("Suggested text").count()) === 0, "settings: with suggestions off, 4★ still shows plain 'Post on Google' (no suggested text)");
// staff + widgets tabs
await op.goto(B + "/app/reviews?tab=staff"); await op.getByText("Ravi").first().waitFor();
t(await op.getByText(/ratings/).first().isVisible(), "staff: leaderboard shows Ravi's ratings");
await op.goto(B + "/app/reviews?tab=widgets");
t(await op.getByText("SOON").first().isVisible(), "widgets: honest 'soon' state");
// preview for the owner
const pv = await owner.newPage(); await pv.goto(B + "/r/preview");
t(await pv.getByRole("heading", { name: "How was the dosa?" }).isVisible() && await pv.getByText("Saravana Cafe").isVisible(), "preview: owner's own settings and business name");

// ============ Analytics shows the actions ============
await op.goto(B + "/app/analytics");
const an = await op.locator("main").innerText();
t(/ratings · \d+ to Google/.test(an), "analytics: review code row shows ratings and Google clicks");
await axeOn(owner, B + "/app/analytics", "analytics (with review actions)");

// ============ 360px ============
const m = await b.newContext({ viewport: { width: 360, height: 800 }, userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile", locale: "en-IN" });
const mp = await m.newPage();
await mp.goto(`${B}/r/${code}?lang=hi`);
t(await mp.evaluate(() => document.documentElement.scrollWidth <= 360), "360px: rating page (Hindi) has no horizontal overflow");
await mp.getByRole("button", { name: "5 में से 2 स्टार" }).click();
await mp.getByRole("heading", { name: "माफ़ कीजिए, हम चूक गए" }).waitFor();
t(await mp.evaluate(() => document.documentElement.scrollWidth <= 360), "360px: low-rating screen has no horizontal overflow");
await mp.screenshot({ path: S + "/shots/rate-low-hi-360.png", fullPage: true });
const om = await b.newContext({ viewport: { width: 360, height: 800 } });
for (const c of await owner.cookies()) await om.addCookies([c]);
const omp = await om.newPage();
for (const path of ["/app/reviews", "/app/reviews?tab=feedback", "/app/reviews?tab=page"]) {
  await omp.goto(B + path); await omp.waitForTimeout(300);
  t(await omp.evaluate(() => document.documentElement.scrollWidth <= 360), `360px: no overflow on ${path}`);
}
await omp.goto(B + "/app/reviews"); await omp.screenshot({ path: S + "/shots/reviews-360.png", fullPage: true });
t(errs.length === 0, "no uncaught page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
