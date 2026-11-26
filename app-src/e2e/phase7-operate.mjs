// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase7-operate.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
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
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
fs.mkdirSync(S + "/shots", { recursive: true });
const b = await chromium.launch();
const errs = [];
const watch = (page, who) => {
  page.on("response", (r) => { if (r.status() >= 400 && !/_next\/static/.test(r.url())) console.log("   HTTP", r.status(), r.request().method(), r.url().replace(B, ""), "from", who); });
  page.on("pageerror", (e) => errs.push(`${who}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (401|403|409|422|429)|caret-color/.test(m.text())) errs.push(`${who} console: ${m.text().slice(0, 200)}`); });
};
const axeOn = async (page, label) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!(await page.title())) await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => n.remove())); // the dev-only overlay is not part of the app
  await page.evaluate(axeSrc);
  const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
  if (res.violations.length) console.log("   DEBUG", label, JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 100), skipPos: getComputedStyle(document.querySelector('a[href="#main"]')).position, url: location.pathname, nodes: [...document.querySelectorAll("main")].length, links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).slice(0, 5), body: [...document.body.children].map((c) => c.tagName + (c.id ? '#' + c.id : '')).slice(0, 8) }))), JSON.stringify(res.violations.map((v) => v.nodes.map((n) => n.failureSummary?.slice(0, 200)))));
  t(res.violations.length === 0, `axe: ${label}${res.violations.length ? " :: " + res.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 110)).join(" || ")).join("; ") : ""}`);
};
const noOverflow = async (page, label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(o <= 0, `no horizontal page scroll: ${label} (${o}px)`); };
const pagesToShoot = [];
const step = async (name, fn) => { try { await fn(); } catch (e) { for (const [i, pg] of pagesToShoot.entries()) await pg.screenshot({ path: `${S}/shots/fail-${name.replace(/[^a-z0-9]+/gi, "-")}-${i}.png` }).catch(() => {}); const lines = String(e.message).split("\n"); t(false, `${name} :: ${lines[0].slice(0, 120)} | ${(lines.find((l) => /waiting for|resolved to/.test(l)) ?? "").trim().slice(0, 200)}`); } };

async function owner(name, goal) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, geolocation: { latitude: 13.0827, longitude: 80.2707 }, permissions: ["geolocation"] });
  const r = await ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone: rnd(), businessName: name } });
  await ctx.request.post(B + "/api/auth/otp/verify", { data: { code: (await r.json()).devCode } });
  await ctx.request.post(B + "/api/onboarding", { data: { industry: "services", goals: [goal], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true } });
  const page = await ctx.newPage();
  watch(page, name);
  return { ctx, page };
}
const mobile = (extra = {}) => b.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36", isMobile: true, hasTouch: true, locale: "en-IN", ...extra });
const publish = async (page, url, fill) => {
  await page.goto(B + url);
  await page.getByLabel("QR name (internal)").waitFor();
  await fill?.();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByText(/Published\. Your short link is/).waitFor();
  return (await page.getByText(/Published\. Your short link is/).innerText()).match(/\/q\/([a-z0-9-]+)/)[1];
};
const phone = await mobile();
const cp = await phone.newPage();
pagesToShoot.push(cp);
watch(cp, "customer");
const narrow = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const np = await narrow.newPage();
watch(np, "narrow");

/* ============================ 1. TICKETS & ASSETS ============================ */
const O1 = await owner("Tech Park Facilities", "tickets");
const p1 = O1.page;
pagesToShoot.push(p1);
let assetHref = "", ticketCode = "", assetCode = "", trackUrl = "";
await step("tickets: screen", async () => {
  await p1.goto(B + "/app/tickets");
  await p1.getByRole("heading", { name: "Tickets & asset service" }).waitFor();
  await p1.screenshot({ path: S + "/shots/p7-tickets-empty.png" });
  await axeOn(p1, "tickets (empty)");
  await p1.getByRole("link", { name: "New ticket" }).click();
  await p1.getByLabel("What is the problem?").fill("AC too cold near window");
  await p1.getByLabel("Where", { exact: true }).fill("Hall 1");
  await p1.getByLabel("Assignee").fill("Meena S.");
  await axeOn(p1, "tickets: new ticket form");
  await p1.getByRole("button", { name: "Create ticket" }).click();
  await p1.getByText("#1 · Facility").waitFor();
  t(true, "tickets: a manual ticket is created and opens its detail");
});
await step("assets: add, log service", async () => {
  await p1.goto(B + "/app/tickets?tab=assets");
  await p1.getByRole("button", { name: "+ Add asset" }).click();
  await p1.getByLabel("Asset name").fill("Daikin split AC");
  await p1.getByLabel("Where it is").fill("Floor 3, Bay 2");
  await p1.getByLabel("Service vendor").fill("CoolTech AMC");
  await p1.getByLabel("Service every (days)").fill("90");
  await p1.getByLabel("Last serviced").fill(new Date(Date.now() - 100 * 86400e3).toISOString().slice(0, 10));
  await p1.getByRole("button", { name: "Add asset", exact: true }).click();
  const card = p1.getByRole("article", { name: "Daikin split AC" });
  await card.waitFor();
  t(await card.getByText("OVERDUE").isVisible(), "assets: 100 days since a 90-day service reads as overdue");
  await p1.screenshot({ path: S + "/shots/p7-assets.png", fullPage: true });
  await axeOn(p1, "assets tab");
  assetHref = await card.getByRole("link", { name: /Create QR|Another QR/ }).getAttribute("href");
  await card.getByRole("button", { name: "Log service" }).click();
  await p1.getByLabel("Serviced by").fill("Suresh");
  await p1.getByLabel("What was done").fill("Filter cleaned, gas pressure checked");
  await p1.getByRole("button", { name: "Save service" }).click();
  await p1.getByRole("article", { name: "Daikin split AC" }).getByText("ON TRACK").waitFor();
  t(true, "assets: logging a service moves the due date on");
  await p1.goto(B + "/app/tickets?tab=visits");
  await p1.getByText("Filter cleaned, gas pressure checked").waitFor();
  await axeOn(p1, "service visits tab");
  await p1.goto(B + "/app/tickets?tab=sla");
  await p1.getByLabel("High priority (hours)").fill("2");
  await p1.getByLabel("Normal priority (hours)").fill("12");
  await p1.getByRole("button", { name: "Save SLA rules" }).click();
  await p1.getByText(/Saved\. Open tickets now follow/).waitFor();
  await axeOn(p1, "SLA tab");
});
await step("studio: ticket + asset codes", async () => {
  ticketCode = await publish(p1, "/app/studio?type=ticket", async () => {
    await p1.getByLabel("QR name (internal)").fill("Washroom QR");
    await p1.getByLabel("Where this code is placed").fill("Washroom 2");
    await p1.getByLabel("Ticket category").selectOption("Housekeeping");
  });
  assetCode = await publish(p1, assetHref, async () => { await p1.getByLabel("QR name (internal)").fill("AC QR"); });
  t(!!ticketCode && !!assetCode, `studio: ticket code (${ticketCode}) and asset code (${assetCode}) published; the asset was preselected from its card`);
});
await step("customer: ticket page", async () => {
  await cp.goto(`${B}/q/${ticketCode}`);
  await cp.waitForURL(`**/s/${ticketCode}`);
  await cp.getByRole("heading", { name: "Report a problem" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-ticket-en.png", fullPage: true });
  await axeOn(cp, "ticket page EN");
  await noOverflow(cp, "ticket 390");
  for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${ticketCode}?lang=${lang}`); await cp.getByRole("button").last().waitFor(); await cp.screenshot({ path: S + `/shots/p7-ticket-${lang}.png`, fullPage: true }); await axeOn(cp, `ticket page ${lang}`); }
  await np.goto(`${B}/s/${ticketCode}?lang=ta`); await np.getByRole("button").last().waitFor(); await noOverflow(np, "ticket 360 Tamil");
  await cp.goto(`${B}/s/${ticketCode}`);
  await cp.getByRole("button", { name: "Submit ticket" }).click();
  t(await cp.getByRole("alert").count() > 0, "ticket page: submitting nothing shows what to fix");
  await cp.getByRole("button", { name: "Cleaning" }).click();
  await cp.getByLabel("Details").fill("No water in tap 2");
  await cp.getByLabel("Your mobile number (optional)").fill("98765 00118");
  await cp.getByRole("button", { name: "Submit ticket" }).click();
  await cp.getByRole("heading", { name: /Ticket #\d+ raised/ }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-ticket-done.png" });
  await axeOn(cp, "ticket raised");
  await cp.getByRole("link", { name: "See ticket status" }).click();
  await cp.waitForURL("**/o/t*");
  trackUrl = cp.url();
  await cp.getByText("Ticket raised").waitFor();
  await cp.screenshot({ path: S + "/shots/p7-track-open.png", fullPage: true });
  await axeOn(cp, "ticket status page");
  t(true, "ticket: raised on the phone and the status page opens");
});
await step("owner: reply and resolve", async () => {
  await p1.goto(B + "/app/tickets");
  await p1.getByRole("link", { name: /#2 · Cleaning/ }).click();
  await p1.getByText("#2 · Housekeeping").waitFor();
  await p1.getByLabel("Reply to customer").fill("Sorry about that. A plumber is on the way.");
  await p1.getByRole("button", { name: "Send reply" }).click();
  await p1.getByText("Reply saved.").waitFor();
  await p1.getByRole("button", { name: "Mark resolved" }).click();
  await p1.getByText("Marked resolved.").waitFor();
  await p1.screenshot({ path: S + "/shots/p7-ticket-detail.png", fullPage: true });
  await axeOn(p1, "ticket detail");
  await cp.reload();
  await cp.getByText("A plumber is on the way.").waitFor();
  t(await cp.getByText("RESOLVED").first().isVisible(), "customer's status page shows the reply and the ticket resolved");
  await cp.goto(trackUrl.split("?")[0] + "?lang=hi"); await cp.getByRole("button", { name: "रीफ़्रेश" }).waitFor(); await cp.screenshot({ path: S + "/shots/p7-track-hi.png", fullPage: true }); await axeOn(cp, "ticket status page hi");
  await np.goto(trackUrl); await np.getByText("Updates").waitFor(); await noOverflow(np, "ticket status 360");
});
await step("asset page", async () => {
  await cp.goto(`${B}/s/${assetCode}`);
  await cp.getByRole("heading", { name: "Daikin split AC" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-asset-en.png", fullPage: true });
  await axeOn(cp, "asset page");
  await cp.getByRole("button", { name: "Water leak" }).click();
  await cp.getByRole("button", { name: "Submit ticket" }).click();
  await cp.getByRole("heading", { name: /Ticket #\d+ raised/ }).waitFor();
  await p1.goto(B + "/app/tickets");
  await p1.getByText("Daikin split AC · Water leak").first().waitFor();
  t(true, "asset: a problem reported on the asset's code shows against the asset");
  await axeOn(p1, "tickets list with tickets");
});
await step("attendance: point, worker, QR", async () => {
  await p1.goto(B + "/app/attendance?tab=points");
  await p1.getByRole("button", { name: "+ Add" }).click();
  await p1.getByLabel("Name", { exact: true }).fill("Main gate");
  await p1.getByRole("button", { name: "Use my current location" }).click();
  await p1.waitForFunction(() => document.querySelector('input[inputmode="decimal"]')?.value !== "");
  t(Number(await p1.getByLabel("Latitude").inputValue()) > 13, "points: 'Use my current location' fills the coordinates");
  await axeOn(p1, "attendance: add point form");
  await p1.getByRole("button", { name: "Add point" }).click();
  await p1.getByText("Geofence 100 m").waitFor();
  await p1.goto(B + "/app/attendance?tab=staff&new=1");
  await p1.getByLabel("Name", { exact: true }).fill("Anand N.");
  await p1.getByLabel("Mobile number").fill("98765 40007");
  await p1.getByLabel("Role").fill("Site supervisor");
  await p1.getByLabel("Shift starts").fill("00:00");
  await p1.getByLabel("Shift ends").fill("23:59");
  await p1.getByRole("button", { name: "Add worker" }).click();
  await p1.getByText("ST-0001").waitFor();
  await axeOn(p1, "attendance: staff tab");
  await p1.goto(B + "/app/attendance?tab=points");
  const href = await p1.locator("main").getByRole("link", { name: /Create QR|Another QR/ }).first().getAttribute("href");
  globalThis.attendCode = await publish(p1, href, async () => { await p1.getByLabel("QR name (internal)").fill("Gate QR"); });
  t(!!globalThis.attendCode, `attendance: QR for the point published (${globalThis.attendCode})`);
});
await step("customer: check in", async () => {
  const code = globalThis.attendCode;
  const inside = await mobile({ geolocation: { latitude: 13.08275, longitude: 80.27075 }, permissions: ["geolocation"] });
  const ip = await inside.newPage(); watch(ip, "worker");
  await ip.goto(`${B}/q/${code}`);
  await ip.getByRole("heading", { name: "Staff check-in" }).waitFor();
  await ip.screenshot({ path: S + "/shots/p7-attend-en.png", fullPage: true });
  await axeOn(ip, "attendance page EN");
  await ip.getByLabel("Your ID").fill("st-0001");
  await ip.getByLabel("Last 4 digits of your mobile").fill("9999");
  await ip.getByRole("button", { name: "Check in / out" }).click();
  await ip.getByText(/couldn.t match that ID and number/).waitFor();
  t(true, "check-in: a wrong number is refused with a plain message");
  await ip.getByLabel("Last 4 digits of your mobile").fill("0007");
  await ip.getByRole("button", { name: "Check in / out" }).click();
  await ip.getByRole("heading", { name: /Checked in at/ }).waitFor();
  await ip.screenshot({ path: S + "/shots/p7-attend-done.png", fullPage: true });
  await axeOn(ip, "attendance checked in");
  t(await ip.getByText("Location confirmed").isVisible(), "check-in: the location is confirmed against the point");
  await ip.getByRole("button", { name: "Done" }).click();
  await ip.getByLabel("Last 4 digits of your mobile").fill("0007");
  await ip.getByRole("button", { name: "Check in / out" }).click();
  await ip.getByText(/You checked in at/).waitFor();
  t(true, "check-in: scanning again straight away doesn't check out");
  for (const lang of ["ta", "hi"]) { await ip.goto(`${B}/s/${code}?lang=${lang}`); await ip.getByRole("button").last().waitFor(); await ip.screenshot({ path: S + `/shots/p7-attend-${lang}.png`, fullPage: true }); await axeOn(ip, `attendance page ${lang}`); }
  await inside.close();
  const far = await mobile({ geolocation: { latitude: 13.10, longitude: 80.2707 }, permissions: ["geolocation"] });
  const fp = await far.newPage(); watch(fp, "far");
  await fp.goto(`${B}/s/${code}`);
  await fp.getByLabel("Your ID").fill("ST-0001");
  await fp.getByLabel("Last 4 digits of your mobile").fill("0007");
  await fp.getByRole("button", { name: "Check in / out" }).click();
  await fp.getByText(/You are \d+ m away/).waitFor();
  t(true, "check-in: too far from the point is refused with the distance");
  const denied = await mobile();
  const dp = await denied.newPage(); watch(dp, "denied");
  await dp.goto(`${B}/s/${code}`);
  await dp.getByLabel("Your ID").fill("ST-0001");
  await dp.getByLabel("Last 4 digits of your mobile").fill("0007");
  await dp.getByRole("button", { name: "Check in / out" }).click();
  await dp.getByText(/We need your location to check you in/).waitFor();
  t(true, "check-in: no location permission shows what to do");
  await np.goto(`${B}/s/${code}?lang=ta`); await np.getByRole("button").last().waitFor(); await noOverflow(np, "attendance 360 Tamil");
  await far.close(); await denied.close();
  await p1.goto(B + "/app/attendance");
  await p1.getByText("Anand N.").first().waitFor();
  await p1.screenshot({ path: S + "/shots/p7-attendance-today.png", fullPage: true });
  await axeOn(p1, "attendance: today board");
  await p1.goto(B + "/app/attendance?tab=points"); await axeOn(p1, "attendance: points & rules");
});

/* ============================ 2. VISITORS + BOOKINGS ============================ */
const O2 = await owner("Glow Salon", "bookings");
const p2 = O2.page;
pagesToShoot.push(p2);
let vCode = "", bCode = "", evCode = "";
await step("visitors", async () => {
  const q = await O2.ctx.request.post(B + "/api/qr", { data: { name: "Reception QR", type: "visitor", config: { place: "Reception" }, publish: true } });
  vCode = (await q.json()).shortCode;
  await cp.goto(`${B}/q/${vCode}`);
  await cp.getByRole("heading", { name: "Visitor pass" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-visitor-en.png", fullPage: true });
  await axeOn(cp, "visitor page EN");
  await cp.getByLabel("Your name").fill("Prakash V.");
  await cp.getByLabel("Your mobile number").fill("98765 40402");
  await cp.getByLabel("Why are you visiting?").fill("Cement delivery");
  await cp.getByLabel("Who are you meeting?").fill("Anand N.");
  await cp.getByRole("button", { name: "Request pass" }).click();
  await cp.getByRole("heading", { name: "Waiting for approval" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-visitor-waiting.png", fullPage: true });
  await axeOn(cp, "visitor pass: waiting");
  const passUrl = cp.url();
  await p2.goto(B + "/app/attendance?tab=visitors");
  await p2.getByRole("button", { name: "Approve Prakash V." }).click();
  await p2.getByText("APPROVED").waitFor();
  await cp.getByRole("button", { name: "Refresh" }).click();
  await cp.getByRole("heading", { name: "Visitor pass ready" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-visitor-pass.png", fullPage: true });
  await axeOn(cp, "visitor pass: ready");
  t(true, "visitor: the pass updates once the owner approves it");
  await p2.getByRole("button", { name: "Check in Prakash V." }).click();
  await p2.getByText("ON SITE").waitFor();
  await p2.getByRole("button", { name: "Check out Prakash V." }).click();
  await p2.getByText("CHECKED OUT").waitFor();
  await axeOn(p2, "attendance: visitor log");
  t(true, "visitor: checked in and out at the gate");
  for (const lang of ["ta", "hi"]) { await cp.goto(`${passUrl.split("?")[0]}?lang=${lang}`); await cp.getByRole("heading").first().waitFor(); await cp.screenshot({ path: S + `/shots/p7-visitor-pass-${lang}.png`, fullPage: true }); await axeOn(cp, `visitor pass ${lang}`); }
  await np.goto(passUrl); await np.getByRole("heading").first().waitFor(); await noOverflow(np, "visitor pass 360");
});
await step("bookings: service, hours, QR", async () => {
  await p2.goto(B + "/app/bookings?tab=services&new=1");
  await p2.getByLabel("Service name").fill("Haircut");
  await p2.getByLabel("Duration (minutes)").fill("60");
  await p2.getByLabel("Price (₹)").fill("400");
  await p2.getByLabel("Staff (comma separated)").fill("Meena, Ravi");
  await axeOn(p2, "bookings: add service form");
  await p2.getByRole("button", { name: "Add service", exact: true }).click();
  await p2.getByRole("cell", { name: /^Haircut/ }).waitFor();
  // open every day 10:00-18:00 so tomorrow always has times
  for (let d = 0; d < 7; d++) { const sw = p2.getByRole("switch", { name: "Open" }).nth(d); if ((await sw.getAttribute("aria-checked")) === "false") await sw.click(); }
  await p2.getByRole("button", { name: "Save hours" }).click();
  await p2.getByText("Saved.").waitFor();
  await p2.screenshot({ path: S + "/shots/p7-services.png", fullPage: true });
  await axeOn(p2, "bookings: services & hours");
  const href = await p2.locator("main").getByRole("link", { name: /Create QR|Another QR/ }).first().getAttribute("href");
  bCode = await publish(p2, href, async () => { await p2.getByLabel("QR name (internal)").fill("Haircut QR"); });
  t(!!bCode, `bookings: QR for the service published (${bCode})`);
});
await step("customer: book a service", async () => {
  await cp.goto(`${B}/q/${bCode}`);
  await cp.getByRole("heading", { name: "Haircut" }).waitFor();
  await cp.getByRole("group", { name: "Time" }).getByRole("button").first().waitFor();
  await cp.screenshot({ path: S + "/shots/p7-booking-en.png", fullPage: true });
  await axeOn(cp, "booking page EN");
  await noOverflow(cp, "booking 390");
  await cp.getByRole("group", { name: "Date" }).getByRole("button").nth(1).click();
  await cp.getByRole("group", { name: "Time" }).getByRole("button").first().click();
  await cp.getByRole("button", { name: "Meena" }).click();
  await cp.getByLabel("Your name").fill("Arjun");
  await cp.getByLabel("Your mobile number").fill("98765 41001");
  await cp.getByRole("button", { name: /^Confirm / }).click();
  await cp.getByRole("heading", { name: "You are booked" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-booking-done.png", fullPage: true });
  await axeOn(cp, "booking confirmed");
  t(await cp.getByText(/BK-[A-Z2-9]{6}/).first().isVisible() && await cp.getByText(/with Meena/).isVisible(), "booking: confirmed with a code and the chosen staff member");
  const url = cp.url();
  for (const lang of ["ta", "hi"]) { await cp.goto(`${url.split("?")[0]}?lang=${lang}`); await cp.getByRole("heading").first().waitFor(); await cp.screenshot({ path: S + `/shots/p7-booking-done-${lang}.png`, fullPage: true }); await axeOn(cp, `booking confirmed ${lang}`); }
  for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${bCode}?lang=${lang}`); await cp.getByRole("group").first().waitFor(); await cp.screenshot({ path: S + `/shots/p7-booking-${lang}.png`, fullPage: true }); await axeOn(cp, `booking page ${lang}`); }
  await np.goto(`${B}/s/${bCode}`); await np.getByRole("group", { name: "Time" }).getByRole("button").first().waitFor(); await noOverflow(np, "booking 360");
  await np.goto(url); await np.getByRole("heading").first().waitFor(); await noOverflow(np, "booking confirmation 360");
  // owner sees it, then the customer cancels from their link
  await p2.goto(B + "/app/bookings?tab=bookings");
  await p2.getByText("Arjun").waitFor();
  await axeOn(p2, "bookings: list");
  await p2.goto(B + "/app/bookings");
  await p2.getByRole("heading", { name: /This week/ }).waitFor();
  await p2.screenshot({ path: S + "/shots/p7-calendar.png", fullPage: true });
  await axeOn(p2, "bookings: calendar");
  await cp.goto(url);
  await cp.getByRole("button", { name: "Cancel booking" }).click();
  await cp.getByRole("button", { name: "Cancel booking" }).first().click();
  await cp.getByRole("heading", { name: "This booking is cancelled." }).waitFor();
  t(true, "booking: the customer cancels from their own link");
});
await step("events: create, register, gate", async () => {
  await p2.goto(B + "/app/bookings?tab=events&new=1");
  await p2.getByLabel("Event name").fill("Diwali Food Fest");
  await p2.getByLabel("Starts (India time)").fill(new Date(Date.now() + 3 * 86400e3 + 5.5 * 3600e3).toISOString().slice(0, 16));
  await p2.getByLabel("Tickets available").fill("5");
  await p2.getByLabel("Ticket price (₹)").fill("150");
  await p2.getByLabel("Venue").fill("Main hall");
  await axeOn(p2, "bookings: add event form");
  await p2.getByRole("button", { name: "Add event" }).click();
  await p2.getByRole("article", { name: "Diwali Food Fest" }).waitFor();
  const href = await p2.getByRole("article", { name: "Diwali Food Fest" }).getByRole("link", { name: /Create QR/ }).getAttribute("href");
  evCode = await publish(p2, href, async () => { await p2.getByLabel("QR name (internal)").fill("Event QR"); });
  await cp.goto(`${B}/q/${evCode}`);
  await cp.getByRole("heading", { name: "Diwali Food Fest" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-event-en.png", fullPage: true });
  await axeOn(cp, "event page EN");
  await cp.getByRole("button", { name: "2", exact: true }).click();
  await cp.getByLabel("Your name").fill("Sangeetha R.");
  await cp.getByLabel("Your mobile number").fill("98765 43001");
  await cp.getByRole("button", { name: "Get my ticket" }).click();
  await cp.getByRole("heading", { name: "Your ticket" }).waitFor();
  const code = (await cp.getByText(/EV-[A-Z2-9]{6}/).first().innerText()).match(/EV-[A-Z2-9]{6}/)[0];
  await cp.screenshot({ path: S + "/shots/p7-event-ticket.png", fullPage: true });
  await axeOn(cp, "event ticket");
  t(await cp.getByRole("img", { name: /Booking code/ }).isVisible(), "event: the ticket page shows a QR of the code");
  await p2.goto(B + "/app/bookings?tab=events");
  await p2.getByRole("button", { name: "Open gate scanner" }).click();
  const dlg = p2.getByRole("dialog");
  await dlg.getByLabel("Ticket code").fill(code.toLowerCase());
  await dlg.getByRole("button", { name: "Check code" }).click();
  await dlg.getByText("Sangeetha R. · 2 tickets").waitFor();
  await axeOn(p2, "gate scanner open");
  await dlg.getByRole("button", { name: "Check in" }).click();
  await dlg.getByText("Checked in. Let them through.").waitFor();
  t(true, "events: the gate scanner looks the ticket up and checks it in");
  await p2.keyboard.press("Escape");
  await p2.getByText("2 checked in").waitFor();
  await axeOn(p2, "bookings: events tab");
  for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${evCode}?lang=${lang}`); await cp.getByRole("button").last().waitFor(); await cp.screenshot({ path: S + `/shots/p7-event-${lang}.png`, fullPage: true }); await axeOn(cp, `event page ${lang}`); }
  await np.goto(`${B}/s/${evCode}`); await np.getByRole("heading", { name: "Diwali Food Fest" }).waitFor(); await noOverflow(np, "event 360");
});

/* ============================ 3. REAL ESTATE ============================ */
const O3 = await owner("Green Meadows", "plots");
const p3 = O3.page;
pagesToShoot.push(p3);
await step("real estate: project, plots, QR", async () => {
  await p3.goto(B + "/app/real-estate");
  await p3.getByLabel("Project name").fill("Green Meadows Phase 2");
  await p3.getByLabel("Number of plots").fill("12");
  await p3.getByLabel("Plots per row on the map").fill("6");
  await p3.getByLabel("Roads after row(s)").fill("1");
  await p3.getByLabel("Approval").fill("DTCP");
  await p3.getByLabel("Sales WhatsApp number").fill("98765 43210");
  await p3.getByLabel("Brochure link").fill("example.com/brochure.pdf");
  await axeOn(p3, "real estate: new project form");
  await p3.getByRole("button", { name: "Create project" }).click();
  await p3.getByRole("button", { name: "Plot 5, available" }).waitFor();
  await p3.getByRole("button", { name: "Plot 5, available" }).click();
  await p3.getByRole("button", { name: "Edit plot 5" }).click();
  await p3.getByLabel("Size (sq ft)").fill("1200");
  await p3.getByLabel("Facing").selectOption("East");
  await p3.getByLabel("Dimensions").fill("30 × 40 ft");
  await p3.getByLabel("Price (lakh ₹)").fill("42.5");
  await p3.getByRole("button", { name: "Save plot" }).click();
  await p3.getByText("₹42.5 L").waitFor();
  await p3.getByLabel("Status").selectOption("hold");
  await p3.getByRole("button", { name: "Plot 5, on hold" }).waitFor();
  await p3.getByLabel("Status").selectOption("available");
  await p3.getByRole("button", { name: "Plot 5, available" }).waitFor();
  t(true, "real estate: edit a plot's details and move its status; the map follows");
  await p3.screenshot({ path: S + "/shots/p7-plots.png", fullPage: true });
  await axeOn(p3, "real estate: layout map");
  // CSV import
  const csv = "number,size,dims,facing,price,approval,corner,status\n1,1500,30x50,North,50,DTCP,yes,sold\n2,abc\n3,1100,,West,38,,no,on hold\n";
  await p3.locator('input[type="file"]').setInputFiles({ name: "plots.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await p3.getByText("plots.csv: 3 rows").waitFor();
  await p3.getByRole("button", { name: "Import", exact: true }).click();
  await p3.getByText(/0 added, 2 updated, 1 skipped/).waitFor();
  await p3.getByRole("button", { name: "Plot 1, sold" }).waitFor();
  t(true, "real estate: a CSV updates plots and reports the row it skipped");
  await p3.getByRole("button", { name: "Plot 5, available" }).click();
  const href = await p3.getByRole("link", { name: /Create a QR for this plot/ }).getAttribute("href");
  globalThis.plotCode = await publish(p3, href, async () => { await p3.getByLabel("QR name (internal)").fill("Plot 5 stone"); });
  t(!!globalThis.plotCode, `real estate: QR for plot 5 published (${globalThis.plotCode})`);
});
await step("customer: plot page and enquiry", async () => {
  const code = globalThis.plotCode;
  await cp.goto(`${B}/q/${code}`);
  await cp.getByRole("heading", { name: "Plot 5" }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-plot-en.png", fullPage: true });
  await axeOn(cp, "plot page EN");
  await noOverflow(cp, "plot 390");
  t(await cp.getByText("₹42.5 L").isVisible() && await cp.getByText("1,200 sq ft").isVisible(), "plot page: size and price from the owner's plot");
  for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${code}?lang=${lang}`); await cp.getByRole("button").first().waitFor(); await cp.screenshot({ path: S + `/shots/p7-plot-${lang}.png`, fullPage: true }); await axeOn(cp, `plot page ${lang}`); }
  await np.goto(`${B}/s/${code}?lang=ta`); await np.getByRole("button").first().waitFor(); await noOverflow(np, "plot 360 Tamil");
  await cp.goto(`${B}/s/${code}`);
  await cp.getByRole("button", { name: "Book a site visit" }).click();
  await axeOn(cp, "plot enquiry form");
  await cp.getByRole("button", { name: "Send request" }).click();
  t(await cp.getByRole("alert").count() > 0, "plot enquiry: empty form shows what to fix");
  await cp.getByRole("button", { name: "Morning" }).click();
  await cp.getByLabel("Your name").fill("Sangeetha R.");
  await cp.getByLabel("Your mobile number").fill("98765 44001");
  await cp.getByRole("button", { name: "Send request" }).click();
  await cp.getByRole("heading", { name: "Thank you! The team will contact you soon." }).waitFor();
  await cp.screenshot({ path: S + "/shots/p7-plot-thanks.png" });
  await p3.goto(B + "/app/real-estate");
  await p3.getByRole("cell", { name: /Sangeetha R\./ }).waitFor();
  await p3.screenshot({ path: S + "/shots/p7-enquiries.png", fullPage: true });
  await axeOn(p3, "real estate: with enquiries");
  await p3.goto(B + "/app/leads");
  await p3.getByRole("article", { name: "Lead Sangeetha R." }).waitFor();
  t(true, "plot enquiry: the buyer shows in the owner's enquiry list and in Leads");
});

/* ============================ 4. REVIEW FEEDBACK -> TICKET ============================ */
const O4 = await owner("Saravana Cafe", "reviews");
await step("reviews: make a ticket from feedback", async () => {
  const q = await (await O4.ctx.request.post(B + "/api/qr", { data: { name: "Table 4", type: "review", config: { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 4" }, publish: true } })).json();
  const hdr = { "x-forwarded-for": "198.51.100.150", "user-agent": "Mozilla/5.0 Mobile Safari" };
  const rr = await (await O4.ctx.request.post(B + "/api/review/response", { data: { code: q.shortCode, rating: 2, lang: "en" }, headers: hdr })).json();
  await O4.ctx.request.post(B + "/api/review/feedback", { data: { id: rr.id, message: "AC too cold near the window." }, headers: hdr });
  await O4.page.goto(B + "/app/reviews?tab=feedback");
  await O4.page.getByRole("button", { name: /Make a ticket from/ }).click();
  await O4.page.getByRole("link", { name: "Ticket #1" }).waitFor();
  await axeOn(O4.page, "reviews: feedback with a ticket link");
  t(true, "reviews: 'Make ticket' turns private feedback into a ticket and links to it");
});

/* ============================ owner screens at 360 ============================ */
for (const [who, o, paths] of [
  ["O1", O1, ["/app/tickets", "/app/tickets?tab=assets", "/app/tickets?tab=sla", "/app/attendance", "/app/attendance?tab=points"]],
  ["O2", O2, ["/app/bookings", "/app/bookings?tab=services", "/app/bookings?tab=events", "/app/attendance?tab=visitors"]],
  ["O3", O3, ["/app/real-estate"]],
]) {
  await o.page.setViewportSize({ width: 360, height: 800 });
  for (const path of paths) await step(`360 ${path}`, async () => { await o.page.goto(B + path); await o.page.waitForTimeout(300); await noOverflow(o.page, `${who} ${path} @360`); });
}
await step("analytics + sidebar", async () => {
  await p1.setViewportSize({ width: 1440, height: 900 });
  await p1.goto(B + "/app/analytics");
  await p1.getByRole("heading", { name: /Analytics/ }).first().waitFor();
  t(/ticket/.test(await p1.locator("main").innerText()), "analytics: tickets show as actions per code");
  await axeOn(p1, "analytics with Operate actions");
  await p1.goto(B + "/app/studio");
  await p1.getByRole("button", { name: /Feedback → ticket/ }).waitFor();
  t(await p1.getByRole("button", { name: /Real estate plot/ }).isEnabled(), "studio: the Operate types are selectable");
  await axeOn(p1, "studio");
});

fs.writeFileSync(S + "/errs7.txt", errs.join("\n=====\n"));
t(errs.length === 0, `no page or console errors (${errs.length}; see errs7.txt)`);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
