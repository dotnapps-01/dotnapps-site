// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase9-files.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
// File storage: logo upload (Settings, onboarding), PDF QR codes, centre logo on a QR code that still scans, brochure and
// manual uploads, the file list, and the logo on customer pages.
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { makePdf, makePng } from "../scripts/images.mjs";
const require = createRequire(import.meta.url);
const S = process.env.E2E_OUT ?? new URL("./out", import.meta.url).pathname;
fs.mkdirSync(S + "/shots", { recursive: true });
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8").replace(/\/\/# sourceMappingURL.*/, "");
const Z = require("@zxing/library");
const B = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const b = await chromium.launch();
const errs = [];
const pagesToShoot = [];
const watch = (page, who) => {
  pagesToShoot.push(page);
  page.on("pageerror", (e) => errs.push(`${who}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (401|403|404|409|413|422|429)|caret-color/.test(m.text())) errs.push(`${who} console: ${m.text().slice(0, 200)}`); });
};
const axeOn = async (page, label) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!(await page.title())) await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()));
  await page.evaluate(axeSrc);
  const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
  t(res.violations.length === 0, `axe: ${label}${res.violations.length ? " :: " + res.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 110)).join(" || ")).join("; ") : ""}`);
};
const noOverflow = async (page, label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(o <= 0, `no horizontal page scroll: ${label} (${o}px)`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { for (const [i, pg] of pagesToShoot.entries()) await pg.screenshot({ path: `${S}/shots/fail9-${name.replace(/[^a-z0-9]+/gi, "-")}-${i}.png` }).catch(() => {}); const lines = String(e.message).split("\n").slice(0, 6).join(" | "); t(false, `${name} :: ${lines}`); } };
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); } return false; };

async function signUp(name, phone = rnd(), viewport = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  let j = {};
  for (let i = 0; i < 3; i++) {
    const r = await ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: name } });
    j = await r.json();
    if (j.error === "rate_limited" && j.retryAfter <= 40) { await new Promise((x) => setTimeout(x, (j.retryAfter + 1) * 1000)); continue; } // a number used a moment ago (the admin's) has a resend cooldown
    break;
  }
  if (!j.devCode) throw new Error("no dev code: " + JSON.stringify(j));
  await ctx.request.post(B + "/api/auth/otp/verify", { data: { code: j.devCode } });
  await ctx.request.post(B + "/api/onboarding", { data: { industry: "retail", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true } });
  const page = await ctx.newPage();
  watch(page, name);
  return { ctx, page };
}
const decodePng = async (ctx, file) => {
  const data = fs.readFileSync(file).toString("base64");
  const dp = await ctx.newPage();
  await dp.setContent("<html><body></body></html>");
  const px = await dp.evaluate(async (d) => { const i = new Image(); i.src = "data:image/png;base64," + d; await i.decode(); const c = document.createElement("canvas"); const k = Math.min(1, 700 / i.width); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); const im = x.getImageData(0, 0, c.width, c.height); return { w: c.width, h: c.height, d: Array.from(im.data) }; }, data);
  await dp.close();
  const lum = new Uint8ClampedArray(px.w * px.h); for (let i = 0; i < lum.length; i++) lum[i] = (px.d[i * 4] * .299 + px.d[i * 4 + 1] * .587 + px.d[i * 4 + 2] * .114) | 0;
  try { return new Z.QRCodeReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, px.w, px.h))), new Map([[Z.DecodeHintType.TRY_HARDER, true]])).getText(); } catch { return null; }
};
const filesTable = (page) => page.getByRole("region", { name: /Uploaded files/ });
const imgLoaded = (page, sel) => page.locator(sel).first().evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false);

const run = Date.now().toString(36).slice(-5);
const png = (name, w = 200, h = 200, rgb) => ({ name, mimeType: "image/png", buffer: makePng(w, h, rgb) });
const pdf = (name, pad = 1500) => ({ name, mimeType: "application/pdf", buffer: makePdf(pad) });
const adm = await signUp("Skanor Staff", ADMIN_PHONE);
const O = await signUp(`Logo Cafe ${run}`);
const Q = await signUp(`Aqua Corp ${run}`);
const idOf = async (name) => (((await (await adm.ctx.request.get(`${B}/app/admin?q=${encodeURIComponent(name)}`)).text()).match(new RegExp(`data-tenant="([0-9a-f-]{36})" data-name="${name}"`)) ?? [])[1]);
await adm.ctx.request.patch(`${B}/api/admin/tenants/${await idOf(`Aqua Corp ${run}`)}`, { data: { plan: "enterprise" } });

/* ============================ SETTINGS: LOGO ============================ */
await step("settings: logo", async () => {
  const p = O.page;
  await p.goto(B + "/app/settings");
  await p.getByRole("heading", { name: "Brand kit & files" }).waitFor();
  t(await p.getByText("No logo yet").isVisible() && await p.getByRole("button", { name: "Upload logo" }).isVisible(), "settings: starts with no logo and an Upload button");
  await axeOn(p, "settings: brand card (empty)");
  // wrong things first: each answers in words, in an alert
  await p.locator("#brand input[type=file]").setInputFiles(pdf("notalogo.pdf"));
  await p.getByRole("alert").filter({ hasText: /PNG, JPG or WebP/ }).waitFor();
  t(true, "settings: a PDF as a logo is refused with a plain message");
  await p.locator("#brand input[type=file]").setInputFiles(png("tiny.png", 32, 32));
  await p.getByRole("alert").filter({ hasText: /too small/ }).waitFor();
  t(true, "settings: a 32px image is refused as too small");
  await p.locator("#brand input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>') });
  await p.getByRole("alert").filter({ hasText: /SVG/ }).waitFor();
  t(true, "settings: SVG pretending to be a PNG is refused");
  // the real thing
  await p.locator("#brand input[type=file]").setInputFiles(png("cafe logo.png", 256, 256, [91, 69, 184]));
  await p.getByRole("status").filter({ hasText: "Logo saved." }).waitFor();
  await p.getByRole("button", { name: "Replace logo" }).waitFor();
  t(await until(() => imgLoaded(p, 'img[alt="Your logo"]')), "settings: the logo uploads and shows");
  t(await p.getByRole("button", { name: "Remove logo" }).isVisible(), "settings: Remove logo appears");
  await p.screenshot({ path: S + "/shots/p9-settings-logo.png", fullPage: true });
  await axeOn(p, "settings: brand card with a logo");
  // replace it
  await p.locator("#brand input[type=file]").setInputFiles(png("cafe logo 2.png", 256, 256, [31, 107, 69]));
  await p.getByRole("status").filter({ hasText: "Logo saved." }).waitFor();
  const rows = await p.locator("#brand table tbody tr").count();
  t(rows === 1, `settings: replacing the logo leaves one file in the list (${rows})`);
  await p.getByRole("link", { name: /cafe logo 2\.png/ }).waitFor();
  t(true, "settings: the list shows the new logo");
  // plan usage bar
  t(await p.getByRole("progressbar", { name: "File storage", exact: true }).count() === 1 && await p.getByRole("progressbar", { name: "File storage used", exact: true }).count() === 1, "settings: storage shows in the plan usage and in the files card");
  // mobile
  const m = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  for (const c of await O.ctx.cookies()) await m.addCookies([c]);
  const mp = await m.newPage(); watch(mp, "mobile");
  await mp.goto(B + "/app/settings"); await mp.getByRole("heading", { name: "Brand kit & files" }).waitFor();
  await noOverflow(mp, "settings @360 with files");
  await mp.close(); await m.close();
});

/* ============================ STUDIO: PDF + CENTRE LOGO ============================ */
let pdfQr = { slug: "", url: "" };
await step("studio: PDF upload and centre logo", async () => {
  const p = O.page;
  await p.goto(B + "/app/studio");
  await p.getByRole("button", { name: /PDF \/ file/ }).click();
  await p.getByRole("button", { name: "Next step" }).click();
  await p.getByLabel("QR name (internal)").fill("Price list");
  await p.getByRole("button", { name: "Upload a PDF instead" }).waitFor();
  // wrong file first
  await p.locator('input[type=file]').setInputFiles(png("pic.png"));
  await p.getByRole("alert").filter({ hasText: /Upload a PDF/ }).waitFor();
  t(true, "studio: an image where a PDF is wanted is refused");
  await p.locator('input[type=file]').setInputFiles(pdf("Price List.pdf"));
  await until(async () => /\/f\/[0-9a-f-]{36}$/.test(await p.getByLabel("Link to the PDF or file").inputValue()));
  const url = await p.getByLabel("Link to the PDF or file").inputValue();
  t(/^https?:\/\/.+\/f\/[0-9a-f-]{36}$/.test(url), `studio: uploading fills the link with the file's address (${url.replace(/^https?:\/\/[^/]+/, "")})`);
  const slug = "pl-" + Math.random().toString(36).slice(2, 7);
  await p.getByLabel("Short link").fill(slug);
  await p.getByText("Available").waitFor();
  await axeOn(p, "studio: PDF content step");
  await p.getByRole("button", { name: "Next step" }).click();
  // design: logo in centre
  const sw = p.getByRole("switch", { name: "Logo in centre of the QR code" });
  await sw.waitFor();
  t((await sw.getAttribute("aria-checked")) === "false" && (await p.locator('svg[role="img"] image').count()) === 0, "studio: the centre-logo switch starts off, no logo in the preview");
  await sw.click();
  t((await sw.getAttribute("aria-checked")) === "true" && (await p.locator('svg[role="img"] image').count()) === 1, "studio: switching it on puts the logo in the preview");
  await p.screenshot({ path: S + "/shots/p9-studio-logo.png", fullPage: true });
  await axeOn(p, "studio: design step with the logo switch");
  await p.getByRole("button", { name: "Next step" }).click();
  await p.getByRole("button", { name: "Finish" }).click();
  await p.getByText(/Published\. Your short link is/).waitFor();
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /^PNG/ }).click()]);
  const pngPath = S + "/dl9-" + dl.suggestedFilename(); await dl.saveAs(pngPath);
  const decoded = await decodePng(O.ctx, pngPath);
  t(!!decoded && decoded.endsWith("/" + slug), `studio: the PNG with the logo in its centre still scans (${decoded})`);
  const [dl2] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /^SVG/ }).click()]);
  const svgPath = S + "/dl9.svg"; await dl2.saveAs(svgPath);
  const svg = fs.readFileSync(svgPath, "utf8");
  t(/<image[^>]+href="data:image\/png;base64,/.test(svg), "studio: the saved SVG carries the logo inside it (no outside link)");
  // the code leads to the PDF
  const scan = await O.ctx.request.get(decoded, { maxRedirects: 0, headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari" } });
  t(scan.status() === 307 && scan.headers()["location"] === url, `scan: the code redirects to the uploaded PDF (${scan.status()})`);
  const file = await O.ctx.request.get(url);
  t(file.status() === 200 && file.headers()["content-type"] === "application/pdf" && (await file.body()).subarray(0, 5).toString() === "%PDF-", "scan: and the address serves a real PDF");
  pdfQr = { slug, url };
  // library: download with the logo works too
  await p.goto(B + "/app/library");
  await p.getByRole("heading", { name: "QR Library" }).waitFor();
  await axeOn(p, "library with a logo code");
});

/* ============================ FILE LIST ============================ */
await step("settings: file list", async () => {
  const p = O.page;
  await p.goto(B + "/app/settings#brand");
  await p.getByRole("link", { name: "Price List.pdf" }).waitFor();
  const row = filesTable(p).getByRole("row").filter({ hasText: "Price List.pdf" });
  t(await row.getByText("In use").isVisible(), "files: a PDF a QR code links to is marked In use");
  // an unused one
  await p.goto(B + "/app/studio");
  await p.getByRole("button", { name: /PDF \/ file/ }).click();
  await p.getByRole("button", { name: "Next step" }).click();
  await p.locator('input[type=file]').setInputFiles(pdf("Spare.pdf", 3000));
  await until(async () => /\/f\//.test(await p.getByLabel("Link to the PDF or file").inputValue()));
  await p.goto(B + "/app/settings#brand");
  const spare = filesTable(p).getByRole("row").filter({ hasText: "Spare.pdf" });
  await spare.waitFor();
  t(await spare.getByText("Not used").isVisible(), "files: an upload nothing links to is marked Not used");
  await axeOn(p, "settings: file list");
  await spare.getByRole("button", { name: "Copy link to Spare.pdf" }).click();
  await p.getByRole("status").filter({ hasText: "Link to Spare.pdf copied." }).waitFor();
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  t(/^https?:\/\/[^/]+\/f\/[0-9a-f-]{36}$/.test(clip), `files: Copy link puts the full address on the clipboard (${clip.replace(/^https?:\/\/[^/]+/, "")})`);
  // delete the used one: warns, and we decline
  let said = "";
  p.once("dialog", async (d) => { said = d.message(); await d.dismiss(); });
  await p.getByRole("button", { name: "Delete Price List.pdf" }).click();
  t(/stop working/.test(said), "files: deleting a file a QR code uses warns that it will stop working");
  t(await p.getByRole("link", { name: "Price List.pdf" }).isVisible(), "files: declining keeps it");
  // clean up unused
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: /Delete 1 unused file/ }).click();
  await p.getByRole("status").filter({ hasText: /1 unused file deleted/ }).waitFor();
  await p.getByRole("link", { name: "Spare.pdf" }).waitFor({ state: "detached" });
  t(true, "files: Delete unused removes only what nothing uses");
  t(await p.getByRole("link", { name: "Price List.pdf" }).isVisible(), "files: the one in use stays");
  // delete the used file for real
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Delete Price List.pdf" }).click();
  await p.getByRole("status").filter({ hasText: "Price List.pdf deleted." }).waitFor();
  const gone = await O.ctx.request.get(pdfQr.url);
  t(gone.status() === 404, "files: a deleted file's address stops working");
});

/* ============================ BROCHURE + MANUAL ============================ */
await step("brochure and manual uploads", async () => {
  const p = O.page;
  await p.goto(B + "/app/real-estate");
  await p.getByLabel("Project name").fill("Green Meadows");
  await p.getByRole("form", { name: "New project" }).locator("input[type=file]").setInputFiles(pdf("Brochure.pdf", 4000));
  await until(async () => /\/f\//.test(await p.getByLabel("Brochure link").inputValue()));
  t(/\/f\/[0-9a-f-]{36}$/.test(await p.getByLabel("Brochure link").inputValue()), "real estate: uploading a brochure fills the brochure link");
  await axeOn(p, "real estate: project form with upload");
  const q = Q.page;
  await q.goto(B + "/app/products?tab=products&new=1");
  await q.getByLabel("Product name").fill("AquaPure RO 8L");
  await q.locator('input[type=file]').setInputFiles(pdf("Manual.pdf", 5000));
  await until(async () => /\/f\//.test(await q.getByLabel("User manual link (PDF)").inputValue()));
  t(/\/f\/[0-9a-f-]{36}$/.test(await q.getByLabel("User manual link (PDF)").inputValue()), "products: uploading a manual fills the manual link");
  await q.getByRole("button", { name: "Add product", exact: true }).click();
  await q.getByRole("cell", { name: /AquaPure RO 8L/ }).first().waitFor();
  await q.goto(B + "/app/settings#brand");
  const row = filesTable(q).getByRole("row").filter({ hasText: "Manual.pdf" });
  await row.waitFor();
  t(await row.getByText("In use").isVisible(), "products: the manual shows as In use in the file list");
});

/* ============================ CUSTOMER PAGES ============================ */
await step("customer pages show the logo", async () => {
  const x = await O.ctx.request.post(B + "/api/qr", { data: { name: "Table 1", type: "review", config: { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 1" }, publish: true } });
  const code = (await x.json()).shortCode;
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-IN" });
  const mp = await m.newPage(); watch(mp, "customer");
  await mp.goto(`${B}/r/${code}`);
  await mp.getByRole("heading").first().waitFor();
  await mp.waitForLoadState("networkidle").catch(() => {});
  t(await imgLoaded(mp, 'header img'), "customer: the review page header shows the business logo");
  await mp.screenshot({ path: S + "/shots/p9-review-logo.png", fullPage: true });
  await axeOn(mp, "customer: review page with a logo");
  await noOverflow(mp, "customer: review page @390");
  // a business without a logo: initials, and nothing broken
  const y = await Q.ctx.request.post(B + "/api/qr", { data: { name: "Table 1", type: "review", config: { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 1" }, publish: true } });
  await mp.goto(`${B}/r/${(await y.json()).shortCode}`);
  await mp.getByRole("heading").first().waitFor();
  t((await mp.locator("header img").count()) === 0, "customer: without a logo the header shows initials, no image");
  await m.close();
});

fs.writeFileSync(S + "/errs9.txt", errs.join("\n=====\n"));
t(errs.length === 0, "no page or console errors (" + errs.length + ", see errs9.txt)");
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
