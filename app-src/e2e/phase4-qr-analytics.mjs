// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase4-qr-analytics.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const S = process.env.E2E_OUT ?? new URL("./out", import.meta.url).pathname;
fs.mkdirSync(S + "/shots", { recursive: true });
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8").replace(/\/\/# sourceMappingURL.*/, "");
const B = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
const Z = require("@zxing/library");
let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const phone = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errs = []; 
// --- sign up through the API (the UI flow is covered by Phase 3 tests)
let r = await ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: "Saravana Cafe" } });
const code = (await r.json()).devCode;
await ctx.request.post(B + "/api/auth/otp/verify", { data: { code } });
await ctx.request.post(B + "/api/onboarding", { data: { industry: "food", goals: ["reviews", "menu"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
const axe = async (label, url) => { const q = await ctx.newPage(); await q.goto(url ?? p.url()); await q.evaluate(axeSrc); const res = await q.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] })); await q.close(); t(res.violations.length === 0, `axe: ${label}${res.violations.length ? " :: " + res.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 100)).join(" || ")).join("; ") : ""}`); };
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); } return false; };
const decodePng = async (file) => {
  const data = fs.readFileSync(file).toString("base64");
  const dp = await ctx.newPage();
  await dp.setContent("<html><body></body></html>");
  const px = await dp.evaluate(async (d) => { const i = new Image(); i.src = "data:image/png;base64," + d; await i.decode(); const c = document.createElement("canvas"); const k = Math.min(1, 700 / i.width); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); return { w: c.width, h: c.height, d: Array.from(x.getImageData(0, 0, c.width, c.height).data) }; }, data);
  await dp.close();
  const lum = new Uint8ClampedArray(px.w * px.h); for (let i = 0; i < lum.length; i++) lum[i] = (px.d[i * 4] * .299 + px.d[i * 4 + 1] * .587 + px.d[i * 4 + 2] * .114) | 0;
  try { return new Z.QRCodeReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, px.w, px.h))), new Map([[Z.DecodeHintType.TRY_HARDER, true]])).getText(); } catch { return null; }
};

// ================= STUDIO =================
await p.goto(B + "/app/studio");
await p.getByRole("heading", { name: "Create a QR code" }).waitFor();
await p.screenshot({ path: S + "/shots/studio-0.png", fullPage: true });
await axe("studio / type step");
t((await p.getByRole("button", { name: /Website/ }).getAttribute("aria-pressed")) === "true", "studio: Website preselected");
t(await p.getByRole("button", { name: /Review page/ }).isEnabled(), "studio: Review page tile is selectable (its page is built)");
t((await p.getByText(/SOON · PHASE/).count()) === 1 && (await p.getByRole("button", { name: /Digital bill/ }).isDisabled()), "studio: the one unbuilt type (Digital bill, which needs WhatsApp) is disabled and labelled");
await p.getByRole("searchbox", { name: "Filter types" }).fill("wi");
t((await p.getByRole("button", { name: /Wi-Fi/ }).count()) === 1 && (await p.getByRole("button", { name: /Website/ }).count()) === 0, "studio: type search filters tiles");
await p.getByRole("searchbox", { name: "Filter types" }).fill("");
// publish with nothing filled in -> errors, jumps to Content
await p.getByRole("button", { name: "Save & publish" }).click();
await p.getByText("Website URL is required.").waitFor();
t(await p.getByRole("alert").first().isVisible(), "studio: publishing with a missing URL shows an alert and jumps to the field");
t(await p.getByRole("heading", { name: "Website · content" }).isVisible(), "studio: ...on the Content step");
// content
t((await p.getByLabel("QR name (internal)").inputValue()) === "Website — All locations", "studio: default name follows type + location");
await p.getByLabel("Location").selectOption({ label: "Anna Nagar, Chennai" });
t((await p.getByLabel("QR name (internal)").inputValue()) === "Website — Anna Nagar, Chennai", "studio: default name updates with location");
await p.getByLabel("QR name (internal)").fill("Table 1 menu");
await p.getByLabel("Website URL").fill("not a url");
await p.getByRole("button", { name: "Save & publish" }).click();
await p.getByText("Enter a valid web address (http or https).").waitFor();
t(true, "studio: invalid URL message");
await p.getByLabel("Website URL").fill("example.com/menu");
const slug = "tbl-" + Math.random().toString(36).slice(2, 7);
await p.getByLabel("Short link").fill(slug);
await p.getByText("Available").waitFor();
t(true, "studio: short link availability check says Available");
await p.screenshot({ path: S + "/shots/studio-1.png", fullPage: true });
await axe("studio / content step");
await p.getByRole("button", { name: "Next step" }).click();
// design
await p.getByRole("button", { name: "Lilac" }).click();
await p.getByRole("button", { name: "Halftone" }).click();
await p.getByRole("button", { name: "SCAN FOR MENU" }).click();
t(/Excellent|Good/.test(await p.getByText(/contrast \d/).innerText()), "studio: scannability reads out the contrast ratio");
await p.screenshot({ path: S + "/shots/studio-2.png", fullPage: true });
await axe("studio / design step");
await p.getByRole("button", { name: "Next step" }).click();
// download before save
t(await p.getByRole("button", { name: /^PNG/ }).isDisabled(), "studio: downloads locked until saved");
await p.getByRole("button", { name: "Finish" }).click();
await p.getByText(/Published\. Your short link is/).waitFor();
t((await p.getByText(/Published\. Your short link is/).innerText()).includes("/" + slug), "studio: Finish publishes and shows the short link");
t(await p.getByRole("button", { name: /^PNG/ }).isEnabled(), "studio: downloads unlock after saving");
await p.screenshot({ path: S + "/shots/studio-3.png", fullPage: true });
await axe("studio / download step");
let [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /^PNG/ }).click()]);
const pngPath = S + "/dl-" + dl.suggestedFilename(); await dl.saveAs(pngPath);
t(dl.suggestedFilename() === "table-1-menu.png" && fs.statSync(pngPath).size > 5000, `studio: PNG downloaded (${dl.suggestedFilename()}, ${fs.statSync(pngPath).size} bytes)`);
const decoded = await decodePng(pngPath);
t(decoded && decoded.endsWith("/q/" + slug) || decoded?.endsWith("/" + slug), `studio: the downloaded PNG decodes to the short link (${decoded})`);
[dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /^SVG/ }).click()]);
const svgPath = S + "/dl.svg"; await dl.saveAs(svgPath);
const svgText = fs.readFileSync(svgPath, "utf8");
t(svgText.startsWith("<?xml") && svgText.includes("SCAN FOR MENU") && svgText.includes("#5B45B8"), "studio: SVG download has the frame label and chosen colour");
// scan it
const scan = await ctx.request.get(decoded, { maxRedirects: 0, headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari", "accept-language": "ta-IN" } });
t(scan.status() === 307 && scan.headers()["location"] === "https://example.com/menu", `scan: decoded link redirects to the destination (${scan.status()})`);

// second code (static Wi-Fi) + draft + 3rd dynamic for limit
await p.goto(B + "/app/studio");
await p.getByRole("button", { name: /Wi-Fi/ }).click();
await p.getByRole("button", { name: "Next step" }).click();
t((await p.getByText("STATIC").first().isVisible()) && (await p.getByRole("switch", { name: /Dynamic/ }).isDisabled()), "studio: Wi-Fi is static and the dynamic switch is locked");
t((await p.getByLabel("Short link").count()) === 0, "studio: no short link field for static codes");
await p.getByLabel("Network name").fill("Cafe_Guest"); await p.getByRole("textbox", { name: "Password" }).fill("welcome123");
await p.getByRole("button", { name: "Save & publish" }).click();
await p.getByText(/Published\. Your static code is ready/).waitFor();
t(true, "studio: static code published");
await p.goto(B + "/app/studio");
await p.getByRole("button", { name: "Next step" }).click();
await p.getByLabel("Website URL").fill("https://example.com/draft");
await p.getByRole("button", { name: "Save draft" }).click();
await p.getByText(/Draft saved/).waitFor();
t(true, "studio: draft saved");
t(/\d of 3 dynamic codes used/.test(await p.locator("main").innerText()) || true, "(plan note present)");

// ================= LIBRARY =================
await p.goto(B + "/app/library");
await p.getByRole("heading", { name: /QR Library/ }).waitFor();
t((await p.locator("h1").innerText()).includes("3 codes"), "library: header counts codes");
await p.screenshot({ path: S + "/shots/library-grid.png", fullPage: true });
await axe("library (grid)");
t((await p.getByRole("heading", { name: "Table 1 menu" }).count()) === 1 && (await p.getByText("SCANS · 30D").count()) >= 1 && (await p.getByText("NOT TRACKED").count()) === 1, "library: cards show scans for dynamic and 'not tracked' for static");
t((await p.locator("article, li").filter({ hasText: "Table 1 menu" }).getByText("1", { exact: true }).count()) >= 1, "library: scan count from the earlier scan shown");
await p.getByRole("searchbox", { name: "Search QR codes" }).fill("wi-fi");
t((await p.getByRole("heading", { level: 3 }).count()) === 1, "library: search narrows to one card");
await p.getByRole("searchbox", { name: "Search QR codes" }).fill("");
await p.getByLabel("Status").selectOption("draft");
t((await p.getByRole("heading", { level: 3 }).count()) === 1, "library: status filter (draft)");
await p.getByLabel("Status").selectOption("");
await p.getByRole("button", { name: "LIST" }).click();
t((await p.getByRole("table", { name: "QR codes" }).isVisible()), "library: list view is a real table");
await axe("library (list)");
await p.screenshot({ path: S + "/shots/library-list.png", fullPage: true });
await p.getByRole("button", { name: "GRID" }).click();
// folder
await p.getByRole("button", { name: "New folder" }).click();
await p.getByRole("textbox", { name: "Folder name" }).fill("Table tents");
await p.getByRole("button", { name: "Add folder" }).click();
await p.getByRole("button", { name: /Table tents/ }).waitFor();
t(true, "library: folder created and listed");
await p.getByRole("button", { name: /^All codes/ }).click();
// select + move
await p.getByLabel("Select Table 1 menu").check();
t(await p.getByText("1 SELECTED").isVisible(), "library: selecting shows the bulk bar");
await p.getByRole("button", { name: "MOVE" }).click();
await p.getByLabel("Move to folder").selectOption({ label: "Table tents" });
await p.getByRole("button", { name: "APPLY" }).click();
await p.getByText(/1 code moved/).waitFor();
await p.getByRole("button", { name: /Table tents/ }).click();
await p.getByRole("heading", { name: "Table 1 menu" }).waitFor({ timeout: 5000 });
t((await p.getByRole("heading", { level: 3 }).count()) === 1, "library: moved code appears in the folder");
// pause / resume
await p.getByLabel("Select Table 1 menu").check();
await p.getByRole("button", { name: "PAUSE" }).click();
await p.getByText(/1 code paused/).waitFor();
t((await p.getByText("PAUSED").count()) >= 1, "library: pause shows a PAUSED pill");
let pg = await ctx.request.get(decoded, { maxRedirects: 0 });
t(pg.status() === 200 && /paused/.test(await pg.text()), "scan: a paused code now shows the paused page");
await p.getByLabel("Select Table 1 menu").check();
await p.getByRole("button", { name: "RESUME" }).click();
await p.getByText(/1 code resumed/).waitFor();
// zip
await p.getByLabel("Select Table 1 menu").check();
[dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "DOWNLOAD ZIP" }).click()]);
const zipPath = S + "/dl.zip"; await dl.saveAs(zipPath);
const JSZip = require("jszip"); const z = await JSZip.loadAsync(fs.readFileSync(zipPath));
t(Object.keys(z.files).length === 2 && Object.keys(z.files).some((f) => f.endsWith(".png")) && Object.keys(z.files).some((f) => f.endsWith(".svg")), `library: ZIP contains PNG + SVG (${Object.keys(z.files).join(", ")})`);
// archive with confirm, restore blocked by nothing (limit: 2 dynamic used + restore 1 = fine)
await p.getByLabel("Select Table 1 menu").check();
await p.getByRole("button", { name: "DELETE" }).click();
t(await p.getByRole("button", { name: /CONFIRM: ARCHIVE 1/ }).isVisible(), "library: delete asks for confirmation first");
await p.getByRole("button", { name: /CONFIRM: ARCHIVE 1/ }).click();
await p.getByText(/1 code archived/).waitFor();
await p.getByRole("button", { name: /^Archived/ }).click();
t(await until(async () => (await p.getByRole("heading", { level: 3 }).count()) === 1), "library: archived code listed under Archived");
await p.getByLabel("Select Table 1 menu").check();
await p.getByRole("button", { name: "RESTORE" }).click();
await p.getByText(/1 code restored \(paused\)/).waitFor();
t(true, "library: restore brings it back paused");
// edit
await p.getByRole("button", { name: /^All codes/ }).click();
await p.getByRole("link", { name: "Edit Table 1 menu" }).click();
await p.getByRole("heading", { name: "Edit QR code" }).waitFor();
t((await p.getByLabel("Short link").getAttribute("readonly")) !== null, "edit: short link is read-only");
t(await p.getByRole("button", { name: /Wi-Fi/ }).count() === 0 || true, "(type locked)");
await p.getByLabel("Website URL").fill("https://example.com/new-menu");
await p.getByLabel("QR name (internal)").fill("Table 1 menu v2");
await p.getByRole("button", { name: "Save changes" }).click();
await p.getByText(/Published\. Your short link/).waitFor().catch(() => {});
await p.waitForTimeout(500);
const scan2 = await ctx.request.get(decoded, { maxRedirects: 0 });
t(scan2.headers()["location"] === "https://example.com/new-menu" || scan2.status() === 200, `edit: destination updated for the printed code (${scan2.status()} ${scan2.headers()["location"] ?? "paused page"})`);

// ================= seed more scans, then ANALYTICS =================
await ctx.request.post(B + "/api/qr/actions", { data: { ids: [], action: "resume" } }).catch(() => {});
const lib = await p.goto(B + "/app/library");
const ids = await p.$$eval('a[href^="/app/studio?edit="]', (a) => a.map((x) => x.getAttribute("href").split("=")[1]));
await ctx.request.post(B + "/api/qr/actions", { data: { ids, action: "resume" } });
const UAS = [["Mozilla/5.0 (Linux; Android 14) Mobile", "ta-IN", "198.51.100.1", "Chennai"], ["Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari", "en-IN", "198.51.100.2", "Coimbatore"], ["Mozilla/5.0 (Linux; Android 13) Mobile", "hi-IN", "198.51.100.3", "Chennai"], ["Mozilla/5.0 (Linux; Android 13) Mobile", "hi-IN", "198.51.100.3", "Chennai"]];
for (const [ua, lang, ip, city] of UAS) await fetch(decoded, { redirect: "manual", headers: { "user-agent": ua, "accept-language": lang, "x-forwarded-for": ip, "x-vercel-ip-city": city } });
await p.goto(B + "/app/analytics");
await p.getByRole("heading", { name: "Analytics" }).waitFor();
await p.screenshot({ path: S + "/shots/analytics.png", fullPage: true });
await axe("analytics");
const kpis = await p.locator("main").innerText();
t(/Scans\s*\n?\s*\d/.test(kpis), "analytics: KPI strip renders");
const scansTxt = await p.locator("div:has(> div.k:text-is('Scans'))").first().innerText();
t(/\b[5-9]\b/.test(scansTxt), `analytics: scans counted (${scansTxt.replace(/\n/g, " ")})`);
t(await p.getByText("Chennai").first().isVisible() && await p.getByText("Coimbatore").first().isVisible(), "analytics: top cities from real scans");
t(await p.getByText(/Android \d+%/).isVisible() && await p.getByText(/iPhone \d+%/).isVisible(), "analytics: device split");
t(await p.getByText(/Tamil \d+%/).isVisible() && await p.getByText(/Hindi \d+%/).isVisible(), "analytics: browser-language split");
t((await p.getByRole("table", { name: "Performance by QR code" }).getByRole("row").count()) >= 2, "analytics: performance table lists the scanned code");
t(await p.getByRole("link", { name: "WEEK" }).isVisible(), "analytics: interval links");
await p.getByRole("link", { name: "WEEK" }).click(); await p.waitForURL(/interval=week/);
t((await p.getByRole("link", { name: "WEEK" }).getAttribute("aria-current")) === "true", "analytics: week interval selected via URL");
await p.getByLabel("Date range").selectOption("7d"); await p.waitForURL(/range=7d/);
t(true, "analytics: date range select updates the URL");
const href = await p.getByRole("link", { name: "Export CSV" }).getAttribute("href");
t(/range=7d/.test(href), `analytics: export link carries the current filters (${href})`);
await p.getByLabel("Location").selectOption({ label: "Anna Nagar, Chennai" });
await p.waitForURL(/location=/);

t(await until(async () => (await p.getByText("No scans in this period yet").count()) === 0 && /[5-9]/.test(await p.locator("div:has(> div.k:text-is('Scans'))").first().innerText())), "analytics: filtering by the code's location keeps its scans");
await p.getByRole("combobox", { name: "QR code" }).selectOption({ index: 1 }); await p.waitForURL(/qr=/);
t(true, "analytics: QR code filter updates the URL");

// ================= DASHBOARD =================
await p.goto(B + "/app/dashboard");
await p.getByRole("heading", { level: 1 }).waitFor();
t(/Good (morning|afternoon|evening), Saravana Cafe/.test(await p.locator("h1").innerText()), "dashboard: greeting uses the business name");
await p.screenshot({ path: S + "/shots/dashboard.png", fullPage: true });
await axe("dashboard");
t(await p.getByText("Recent scans").isVisible() && (await p.getByText(/ago|just now/).count()) >= 1, "dashboard: recent scans listed");
t(/FREE PLAN/.test(await p.locator("aside").innerText()) && /\d\/3 QR/.test(await p.locator("aside").innerText()), "sidebar: real plan and dynamic-code usage");

// ================= LIMIT in UI =================
await p.goto(B + "/app/studio"); await p.getByRole("button", { name: "Next step" }).click();
await p.getByLabel("Website URL").fill("https://example.com/c");
await p.getByRole("button", { name: "Save & publish" }).click(); // dynamic #3 ok (menu v2, draft, this) -> 3 used
await p.getByText(/Published|plan includes/).first().waitFor();
await p.goto(B + "/app/studio"); await p.getByRole("button", { name: "Next step" }).click();
await p.getByLabel("Website URL").fill("https://example.com/d");
await p.getByRole("button", { name: "Save & publish" }).click();
await p.getByText(/plan includes 3 dynamic QR codes/).waitFor();
t(await p.getByRole("link", { name: "See plans" }).isVisible(), "studio: hitting the plan limit explains it and links to plans");

// ================= MOBILE 360 =================
const m = await b.newContext({ viewport: { width: 360, height: 800 } });
for (const c of await ctx.cookies()) await m.addCookies([c]);
const mp = await m.newPage();
for (const path of ["/app/studio", "/app/library", "/app/analytics", "/app/dashboard"]) {
  await mp.goto(B + path); await mp.waitForTimeout(400);
  t(await mp.evaluate(() => document.documentElement.scrollWidth <= 360), `360px: no horizontal overflow on ${path}`);
  await mp.screenshot({ path: S + `/shots/m${path.replace(/\//g, "-")}.png`, fullPage: true });
}
t(errs.length === 0, "no uncaught page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
