// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase8-platform.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
import fs from "node:fs";
import { createServer } from "node:http";
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
const pagesToShoot = [];
const watch = (page, who) => {
  pagesToShoot.push(page);
  page.on("pageerror", (e) => errs.push(`${who}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (401|403|404|409|422|429)|caret-color/.test(m.text())) errs.push(`${who} console: ${m.text().slice(0, 200)}`); });
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
const step = async (name, fn) => { try { await fn(); } catch (e) { for (const [i, pg] of pagesToShoot.entries()) await pg.screenshot({ path: `${S}/shots/fail8-${name.replace(/[^a-z0-9]+/gi, "-")}-${i}.png` }).catch(() => {}); const lines = String(e.message).split("\n"); t(false, `${name} :: ${lines[0].slice(0, 120)} | ${(lines.find((l) => /waiting for|resolved to/.test(l)) ?? "").trim().slice(0, 200)}`); } };

async function signUp(name, phone = rnd(), viewport = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const r = await ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: name } });
  const j = await r.json();
  if (!j.devCode) throw new Error("no dev code: " + JSON.stringify(j));
  await ctx.request.post(B + "/api/auth/otp/verify", { data: { code: j.devCode } });
  await ctx.request.post(B + "/api/onboarding", { data: { industry: "retail", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true } });
  const page = await ctx.newPage();
  watch(page, name);
  return { ctx, page };
}
const mobile = (ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36") => b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, isMobile: true, hasTouch: true, locale: "en-IN" });

const run = Date.now().toString(36).slice(-5);
const adm = await signUp("Skanor Staff", ADMIN_PHONE);
const T = await signUp(`Free Shop ${run}`);      // free, then upgraded through the admin UI
const Q = await signUp(`Aqua Corp ${run}`);      // enterprise (set through the API by the admin)
const idOf = async (name) => (((await (await adm.ctx.request.get(`${B}/app/admin?q=${encodeURIComponent(name)}`)).text()).match(new RegExp(`data-tenant="([0-9a-f-]{36})" data-name="${name}"`)) ?? [])[1]);
await adm.ctx.request.patch(`${B}/api/admin/tenants/${await idOf(`Aqua Corp ${run}`)}`, { data: { plan: "enterprise" } });

/* ============================ SETTINGS ============================ */
await step("settings", async () => {
  const p = T.page;
  await p.goto(B + "/app/settings");
  await p.getByRole("heading", { name: "Settings" }).waitFor();
  await p.screenshot({ path: S + "/shots/p8-settings.png", fullPage: true });
  await axeOn(p, "settings");
  await p.getByLabel("Business name").fill(`Free Shop ${run} & Co`);
  await p.getByLabel("GSTIN (optional)").fill("bad gstin");
  await p.getByRole("button", { name: "Save profile" }).click();
  await p.getByText(/A GSTIN has 15 characters/).waitFor();
  t(true, "settings: a bad GSTIN shows what's wrong");
  await p.getByLabel("GSTIN (optional)").fill("33abcde1234f1z5");
  await p.getByLabel("Category").selectOption("salon");
  await p.getByLabel("Default language on scan pages").selectOption("ta");
  await p.getByRole("button", { name: "Save profile" }).click();
  await p.getByText("Saved.").first().waitFor();
  await p.reload();
  t((await p.getByLabel("Business name").inputValue()) === `Free Shop ${run} & Co` && (await p.getByLabel("GSTIN (optional)").inputValue()) === "33ABCDE1234F1Z5", "settings: the profile persists");
  await p.getByRole("button", { name: "+ Add location" }).click();
  await p.getByLabel("Location name").fill("Peelamedu");
  await p.getByLabel("Address").fill("Coimbatore");
  await p.getByRole("button", { name: "Add location", exact: true }).click();
  await p.getByText("Peelamedu").first().waitFor();
  await p.getByRole("button", { name: "Make Peelamedu primary" }).click();
  await p.getByRole("button", { name: "Remove Peelamedu" }).waitFor({ state: "detached" });
  t(true, "settings: add a location and make it primary");
  await p.getByText("Business profile updated").first().waitFor();
  await p.getByRole("button", { name: /Make .* primary/ }).first().click();
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Remove Peelamedu" }).click();
  await p.getByText("Peelamedu").first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  await axeOn(p, "settings after changes");
  // data panel
  await p.getByLabel("Keep scan and lead data for").selectOption("12");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByRole("status").filter({ hasText: /Saved/ }).first().waitFor();
  t((await p.getByRole("link", { name: "Export contacts" }).getAttribute("href")) === "/api/export/contacts", "settings: export links point at the CSV downloads");
  await p.setViewportSize({ width: 360, height: 800 });
  await p.goto(B + "/app/settings");
  await noOverflow(p, "settings @360");
});
await step("settings: delete workspace", async () => {
  const D = await signUp("Doomed Ltd");
  const p = D.page;
  await p.goto(B + "/app/settings");
  await p.getByRole("button", { name: "Delete workspace" }).click();
  const dlg = p.getByRole("dialog");
  await dlg.getByLabel(/Type “Doomed Ltd” to confirm/).fill("Wrong name");
  await dlg.getByRole("button", { name: "Delete everything" }).click();
  await dlg.getByText("Type your business name exactly to confirm.").waitFor();
  await axeOn(p, "delete dialog open");
  await dlg.getByLabel(/Type “Doomed Ltd” to confirm/).fill("Doomed Ltd");
  await dlg.getByRole("button", { name: "Delete everything" }).click();
  await p.waitForURL(B + "/");
  const r = await D.ctx.request.get(B + "/api/export/contacts");
  t(r.status() === 401, "settings: deleting the workspace signs you out and removes your data");
});

/* ============================ ADMIN ============================ */
await step("admin", async () => {
  const p = adm.page;
  await p.goto(B + "/app/admin");
  await p.getByRole("heading", { name: "Admin console" }).waitFor();
  t(await p.getByRole("link", { name: "Admin console" }).first().isVisible(), "admin: the sidebar link is there for staff");
  await p.screenshot({ path: S + "/shots/p8-admin.png", fullPage: true });
  await axeOn(p, "admin console");
  await p.getByRole("searchbox", { name: "Search tenants" }).fill(`Free Shop ${run}`);
  await p.getByRole("button", { name: "Search" }).click();
  await p.getByRole("row", { name: new RegExp(`Free Shop ${run}`) }).waitFor();
  t((await p.getByRole("row", { name: /Aqua Corp/ }).count()) === 0, "admin: search narrows the list");
  await p.waitForLoadState("networkidle"); // let the page hydrate before using the plan picker
  await p.getByLabel(/Plan for/).selectOption("enterprise");
  await p.getByRole("button", { name: /Apply Enterprise plan/ }).click();
  await p.getByText("Plan changed.").waitFor();
  t(true, "admin: change a tenant's plan from the table");
  await p.getByRole("button", { name: /^Suspend/ }).click();
  await p.getByRole("row", { name: /Free Shop/ }).getByText("SUSPENDED").waitFor();
  const tp = T.page; await tp.goto(B + "/app/dashboard");
  t(await tp.getByRole("heading", { name: "This account is paused" }).isVisible(), "admin: a suspended tenant sees the paused notice");
  await axeOn(tp, "paused account notice");
  await p.getByRole("button", { name: /^Resume/ }).click();
  await p.getByRole("row", { name: /Free Shop/ }).getByText("ACTIVE").waitFor();
  await p.getByRole("button", { name: /Log in as/ }).click();
  await p.waitForURL("**/app/dashboard");
  await p.getByText(/you are viewing/).waitFor();
  await p.screenshot({ path: S + "/shots/p8-viewas.png" });
  await axeOn(p, "dashboard while viewing as a tenant");
  await p.getByRole("button", { name: /Exit and go back/ }).click();
  await p.waitForURL("**/app/admin");
  t(true, "admin: view a tenant as its owner and exit back to the console");
  // switches
  await Promise.all([p.waitForResponse((r) => r.url().includes("/api/admin/flags")), p.getByRole("switch", { name: "New sign-ups" }).click()]);
  await p.getByRole("switch", { name: "New sign-ups" }).and(p.locator('[aria-checked="false"]')).waitFor();
  const r = await adm.ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone: rnd(), businessName: "Late Co" } });
  t(r.status() === 403, "admin: switching sign-ups off closes them");
  await Promise.all([p.waitForResponse((r) => r.url().includes("/api/admin/flags")), p.getByRole("switch", { name: "New sign-ups" }).click()]);
  await p.getByRole("switch", { name: "New sign-ups" }).and(p.locator('[aria-checked="true"]')).waitFor();
  await p.setViewportSize({ width: 360, height: 800 });
  await p.goto(B + "/app/admin");
  await noOverflow(p, "admin @360");
  await p.setViewportSize({ width: 1440, height: 900 });
  const f = T.page; await f.goto(B + "/app/admin");
  await f.getByRole("heading", { name: /couldn.t find that page/i }).waitFor();
  t(true, "admin: a normal owner gets the not-found page");
});

/* ============================ INTEGRATIONS ============================ */
const hits = [];
const receiver = createServer((req, res) => { let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => { hits.push({ url: req.url, body }); res.writeHead(200); res.end("ok"); }); });
await new Promise((r) => receiver.listen(0, "127.0.0.1", r));
const rport = receiver.address().port;
await step("integrations: apps and docs", async () => {
  const p = Q.page;
  await p.goto(B + "/app/integrations");
  await p.getByRole("heading", { name: /Integrations/ }).waitFor();
  await p.screenshot({ path: S + "/shots/p8-integrations.png", fullPage: true });
  await axeOn(p, "integrations: apps");
  await p.goto(B + "/app/integrations?tab=whitelabel"); await axeOn(p, "integrations: white-label");
  const f = T.page; await f.goto(B + "/app/integrations?tab=webhooks");
});
await step("integrations: API keys", async () => {
  const p = Q.page;
  await p.goto(B + "/app/integrations?tab=api");
  await p.getByRole("button", { name: "Create API key" }).first().click();
  await p.getByLabel("Name").fill("Packaging line");
  await p.getByLabel("What it may do").selectOption("qr:write");
  await axeOn(p, "integrations: new key form");
  await p.getByRole("button", { name: "Create key" }).click();
  const box = p.getByRole("status").filter({ hasText: /Copy it now/ });
  await box.waitFor();
  const key = await box.locator("code").innerText();
  t(/^sk_live_[\w-]{30,}$/.test(key), "keys: the new key is shown once in a panel");
  await box.getByRole("button", { name: "Copy the new API key" }).click();
  await box.getByText("Copied").waitFor();
  t((await p.evaluate(() => navigator.clipboard.readText())) === key, "keys: Copy puts the key on the clipboard");
  await axeOn(p, "integrations: key just created");
  await box.getByRole("button", { name: /saved it/ }).click();
  await p.getByRole("cell", { name: `sk_live_••••••${key.slice(-4)}` }).waitFor();
  t(!(await p.content()).includes(key), "keys: after that the page never contains the key");
  const r = await fetch(B + "/v1/qr", { headers: { authorization: `Bearer ${key}` } });
  t(r.status === 200, "keys: the key works against /v1/qr");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Revoke Packaging line" }).click();
  await p.getByText("REVOKED", { exact: true }).waitFor();
  t((await fetch(B + "/v1/qr", { headers: { authorization: `Bearer ${key}` } })).status === 401, "keys: revoking stops it at once");
  await axeOn(p, "integrations: keys with a revoked key");
});
await step("integrations: webhooks", async () => {
  const p = Q.page;
  await p.goto(B + "/app/integrations?tab=webhooks");
  await p.getByRole("button", { name: "+ Add endpoint" }).click();
  await p.getByLabel("Endpoint URL").fill("ftp://example.com/hook");
  await p.getByRole("button", { name: "Add endpoint", exact: true }).click();
  await p.getByText(/must start with https/).waitFor();
  t(true, "webhooks: a non-https address shows why");
  await p.getByLabel("Endpoint URL").fill(`http://127.0.0.1:${rport}/hook`);
  await p.getByRole("checkbox", { name: /ticket\.created/ }).check();
  await axeOn(p, "integrations: new webhook form");
  await p.getByRole("button", { name: "Add endpoint", exact: true }).click();
  const box = p.getByRole("status").filter({ hasText: /signing secret/ });
  const refused = await p.getByText(/must start with https|private or internal/).count();
  if (refused) { t(true, "webhooks: this server refuses a local address (WEBHOOK_ALLOW_PRIVATE is off), so delivery isn't exercised in the browser"); return; }
  await box.waitFor();
  t(/^whsec_/.test(await box.locator("code").innerText()), "webhooks: the signing secret is shown once");
  await box.getByRole("button", { name: /saved it/ }).click();
  await p.getByRole("button", { name: /Send a test to/ }).click();
  await p.getByText(/Delivered \(HTTP 200\)/).waitFor();
  t(hits.some((h) => JSON.parse(h.body).type === "ping"), "webhooks: Send test reaches the receiver");
  await p.screenshot({ path: S + "/shots/p8-webhooks.png", fullPage: true });
  await axeOn(p, "integrations: webhooks with an endpoint");
  await p.getByRole("button", { name: /Pause http/ }).click();
  await p.getByText("PAUSED").first().waitFor();
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: /Remove http/ }).click();
  await p.getByText(/No endpoints yet/).waitFor();
});
receiver.close();
await step("docs", async () => {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); watch(p, "docs");
  await p.goto(B + "/docs");
  await p.getByRole("heading", { name: "Skanor API" }).waitFor();
  t(await p.getByRole("heading", { name: "GET /v1/qr", exact: false }).first().isVisible() || await p.getByText("/v1/qr").first().isVisible(), "docs: the API reference is real");
  await p.screenshot({ path: S + "/shots/p8-docs.png", fullPage: true });
  await axeOn(p, "docs");
  await p.setViewportSize({ width: 360, height: 800 }); await p.goto(B + "/docs"); await noOverflow(p, "docs @360");
});

/* ============================ PRODUCTS ============================ */
let tokens = [];
await step("products: product and batch", async () => {
  const p = Q.page;
  await p.goto(B + "/app/products?tab=products&new=1");
  await p.getByLabel("Product name").fill("AquaPure RO 8L");
  await p.getByLabel("Model").fill("RO 8L");
  await p.getByLabel("Made in").fill("Chennai");
  await p.getByLabel("Buy accessories link").fill("example.com/filters");
  await axeOn(p, "products: add product form");
  await p.getByRole("button", { name: "Add product", exact: true }).click();
  await p.getByRole("cell", { name: /AquaPure RO 8L/ }).first().waitFor();
  await p.goto(B + "/app/products");
  await p.getByLabel("Quantity").fill("120");
  await p.getByRole("button", { name: /^Generate/ }).click();
  await p.getByText(/Use 2 to 14 letters/).waitFor();
  t(true, "products: a missing prefix shows what to fix");
  await p.getByLabel("Serial prefix").fill("aq-26-");
  await p.getByRole("button", { name: /^Generate/ }).click();
  await p.getByText(/B-01 created: AQ-26-000001 to AQ-26-000120/).waitFor();
  t(true, "products: 120 codes generated");
  await p.screenshot({ path: S + "/shots/p8-products.png", fullPage: true });
  await axeOn(p, "products: overview");
  await p.goto(B + "/app/products?tab=batches");
  await p.getByRole("link", { name: "Download B-01 as CSV" }).waitFor();
  const csv = await (await Q.ctx.request.get(B + (await p.getByRole("link", { name: "Download B-01 as CSV" }).getAttribute("href")))).text();
  tokens = csv.trim().split("\n").slice(1).map((r) => r.split(",")[1]);
  t(tokens.length === 120 && /\/p\/[0-9a-f]{16}$/.test(tokens[0]), "products: the CSV has a URL for every serial");
  await axeOn(p, "products: batches tab");
  await p.getByRole("button", { name: "Mark B-01 as in market" }).click();
  await p.getByText("IN MARKET").first().waitFor();
  await p.getByRole("link", { name: "Print sheet for B-01" }).click();
  await p.waitForURL("**/print/batch/**");
  await p.getByRole("heading", { name: /B-01 · page 1 of 2/ }).waitFor();
  await p.screenshot({ path: S + "/shots/p8-print.png" });
  await axeOn(p, "print sheet");
  await p.setViewportSize({ width: 360, height: 800 }); await noOverflow(p, "print sheet @360"); await p.setViewportSize({ width: 1440, height: 900 });
});
await step("products: buyer's page", async () => {
  const url = tokens[0].replace(/^https?:\/\/[^/]+/, B);
  const c1 = await mobile(); const p1 = await c1.newPage(); watch(p1, "buyer1");
  await p1.goto(url);
  await p1.getByRole("heading", { name: "Genuine AquaPure RO 8L" }).waitFor();
  t((await p1.locator("[data-verdict]").getAttribute("data-verdict")) === "first", "buyer: the first scan reads genuine");
  await p1.screenshot({ path: S + "/shots/p8-product-first.png", fullPage: true });
  await axeOn(p1, "product page: first scan");
  await noOverflow(p1, "product page 390");
  for (const lang of ["ta", "hi"]) { await p1.goto(`${url}?lang=${lang}`); await p1.getByRole("heading").first().waitFor(); await p1.screenshot({ path: S + `/shots/p8-product-${lang}.png`, fullPage: true }); await axeOn(p1, `product page ${lang}`); }
  const n = await mobile(); /* same phone as the first buyer, so it is not "another device" */ const np = await n.newPage(); await np.setViewportSize({ width: 360, height: 740 });
  await np.goto(`${url}?lang=ta`); await np.getByRole("heading").first().waitFor(); await noOverflow(np, "product page 360 Tamil");
  // warranty on the first phone
  await p1.goto(url);
  await p1.getByRole("button", { name: "Register warranty" }).click();
  await axeOn(p1, "product page: warranty form");
  await p1.getByRole("button", { name: /Activate 1-year warranty/ }).click();
  await p1.getByText("Enter your name.").waitFor();
  t(true, "buyer: an empty warranty form shows what to fix");
  await p1.getByLabel("Your name").fill("Ramesh Gopalan");
  await p1.getByLabel("Your mobile number").fill("98765 00210");
  await p1.getByLabel("Bought from (shop or website)").fill("Sri Ganesh Electricals");
  await p1.getByRole("button", { name: /Activate 1-year warranty/ }).click();
  await p1.getByText(/^Until /).waitFor();
  await p1.screenshot({ path: S + "/shots/p8-product-warranty.png", fullPage: true });
  t(true, "buyer: the warranty is registered and shown on the page");
  t(!(await p1.content()).includes("Ramesh"), "buyer: the page never carries the buyer's name");
  await axeOn(p1, "product page: warranty registered");
  // service
  await p1.getByRole("button", { name: "Book service" }).click();
  await p1.getByLabel("What's wrong?").fill("Water is leaking from the bottom");
  await p1.getByLabel("Your name").fill("Ramesh Gopalan");
  await p1.getByLabel("Your mobile number").fill("98765 00210");
  await p1.getByRole("button", { name: "Send request" }).click();
  await p1.getByRole("heading", { name: /Service request #\d+ sent/ }).waitFor();
  await axeOn(p1, "product page: service request sent");
  await p1.getByRole("link", { name: "See request status" }).click();
  await p1.waitForURL("**/o/t*");
  t(await p1.getByText(/Service: AquaPure RO 8L/).first().isVisible(), "buyer: follows the service request on their own link");
  // other devices: scanned before, then a flag
  const c2 = await mobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1"); const p2 = await c2.newPage(); watch(p2, "buyer2");
  await p2.goto(url);
  await p2.getByRole("heading", { name: "This code was scanned before" }).waitFor();
  t((await p2.locator("[data-verdict]").getAttribute("data-verdict")) === "scanned_before", "buyer: another phone reads 'scanned before'");
  await p2.screenshot({ path: S + "/shots/p8-product-warn.png", fullPage: true });
  await axeOn(p2, "product page: scanned before");
  for (const lang of ["ta", "hi"]) { await p2.goto(`${url}?lang=${lang}`); await p2.getByRole("heading").first().waitFor(); await axeOn(p2, `product page warning ${lang}`); }
  await p2.goto(url);
  await p2.getByRole("button", { name: "Report this seller" }).click();
  await p2.getByLabel("Where did you buy it?").fill("A roadside stall in Madurai");
  await p2.getByRole("button", { name: "Send report" }).click();
  await p2.getByText("Thank you. The brand has been told.").waitFor();
  await axeOn(p2, "product page: report sent");
  const c3 = await mobile("Mozilla/5.0 (Linux; Android 13; Third) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36"); const p3 = await c3.newPage(); watch(p3, "buyer3");
  await p3.goto(url);
  await p3.getByRole("heading", { name: "This code was scanned before" }).waitFor();
  // owner side
  const o = Q.page;
  await o.goto(B + "/app/products?tab=authenticity");
  await o.getByText("MANY DEVICES").waitFor();
  await o.screenshot({ path: S + "/shots/p8-authenticity.png", fullPage: true });
  await axeOn(o, "products: authenticity");
  await o.getByRole("button", { name: /^Investigate AQ-26-000001/ }).first().click();
  await o.getByText("INVESTIGATING").first().waitFor();
  await o.getByRole("button", { name: /^Confirm AQ-26-000001 as a fake/ }).first().click();
  await o.getByText("CONFIRMED FAKE").first().waitFor();
  t(true, "owner: investigate and confirm an alert");
  await o.goto(B + "/app/products?tab=warranty");
  await o.getByText("Ramesh Gopalan").waitFor();
  await axeOn(o, "products: warranty tab");
  await o.goto(B + "/app/tickets");
  await o.getByText("PRODUCT QR").first().waitFor();
  t(true, "owner: the service request is in Tickets as PRODUCT QR");
  await o.goto(B + "/app/studio");
  t(await o.getByRole("link", { name: /Product \(serialized\)/ }).isVisible(), "studio: Product (serialized) points to Products");
  await o.goto(B + "/app/dashboard");
  t(await o.getByRole("link", { name: /Product QR & warranty/ }).isVisible(), "sidebar: Products is there");
  for (const path of ["/app/products", "/app/products?tab=batches", "/app/integrations?tab=api", "/app/integrations?tab=webhooks"]) {
    await o.setViewportSize({ width: 360, height: 800 }); await o.goto(B + path); await o.waitForTimeout(300); await noOverflow(o, `${path} @360`);
  }
});
await step("products: gated for a free tenant", async () => {
  const f = await signUp("Plain Shop");
  await f.page.goto(B + "/app/products");
  await f.page.getByText(/part of the Enterprise plan/).first().waitFor();
  await f.page.screenshot({ path: S + "/shots/p8-products-gated.png" });
  await axeOn(f.page, "products: plan notice");
  await f.page.goto(B + "/app/integrations?tab=api"); await f.page.getByText(/part of the Enterprise plan/).first().waitFor(); await axeOn(f.page, "integrations: plan notice");
});

fs.writeFileSync(S + "/errs8.txt", errs.join("\n=====\n"));
t(errs.length === 0, `no page or console errors (${errs.length}; see errs8.txt)`);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
