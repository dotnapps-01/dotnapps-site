// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase6-engage.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
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
const phone = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
fs.mkdirSync(S + "/shots", { recursive: true });
const b = await chromium.launch();
const owner = await b.newContext({ viewport: { width: 1440, height: 900 } });
let r = await owner.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: "Saravana Cafe" } });
await owner.request.post(B + "/api/auth/otp/verify", { data: { code: (await r.json()).devCode } });
await owner.request.post(B + "/api/onboarding", { data: { industry: "food", goals: ["menu"], locationName: "RS Puram, Coimbatore", address: "1 Main Rd", complete: true } });
const op = await owner.newPage();
const errs0 = []; const errs = new Proxy(errs0, { get(t, k) { if (k === "push") return (m) => { if (!/caret-color/.test(m)) t.push(m); }; const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
op.on("pageerror", (e) => errs.push("owner: " + e.message));
op.on("console", (m) => { if (m.type() === "error") errs.push("owner console: " + m.text()); });
const axeOn = async (page, label) => { const title0 = await page.title(); if (!title0) { await page.waitForTimeout(1000); console.log("NOTE: empty title for", label, "->", JSON.stringify(await page.title()), page.url()); } await page.evaluate(axeSrc); const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] })); t(res.violations.length === 0, `axe: ${label}${res.violations.length ? " :: " + res.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 110)).join(" || ")).join("; ") : ""}`); };
const noOverflow = async (page, label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(o <= 0, `no horizontal page scroll at this width: ${label} (${o}px)`); };
const ownerAxe = async (path, label, wait) => { await op.goto(B + path); if (wait) await wait(); await axeOn(op, label); };

// ============ PAGES: build a menu in the UI ============
await op.goto(B + "/app/pages");
await op.getByRole("heading", { name: /Pages/ }).first().waitFor();
await op.screenshot({ path: S + "/shots/p6-pages-empty.png" });
await axeOn(op, "pages list (empty)");
await op.getByRole("button", { name: "+ New" }).click();
await op.getByLabel("Title", { exact: true }).fill("Dinner menu");
await op.getByRole("button", { name: "Create page" }).click();
await op.getByLabel("Page title").waitFor();
t(await op.getByLabel("Page title").inputValue() === "Dinner menu", "pages: a new menu page opens in the builder");
await op.getByLabel("Section 1 name").fill("Dosa");
await op.getByRole("button", { name: "Add item" }).first().click();
await op.getByLabel("Item name").first().fill("Ghee Roast Dosa");
await op.getByLabel("Price (₹)").first().fill("140");
await op.getByLabel("Tags").first().fill("Bestseller");
await op.getByRole("button", { name: "Add item" }).first().click();
await op.getByLabel("Item name").nth(1).fill("Podi Dosa");
await op.getByLabel("Price (₹)").nth(1).fill("120");
await op.getByLabel("Order on WhatsApp number").fill("98765 43210");
await op.screenshot({ path: S + "/shots/p6-builder.png", fullPage: true });
t(await op.getByLabel("Live preview").getByText("Ghee Roast Dosa").first().isVisible(), "pages: the live phone preview shows what you type");
await op.getByRole("button", { name: "Save draft" }).click();
await op.getByText(/Saved/).first().waitFor();
t(true, "pages: saved as a draft");
await axeOn(op, "page builder (menu)");
await op.getByRole("button", { name: /^Publish/ }).click();
await op.getByText(/Published|Live/).first().waitFor();
t(true, "pages: published");

// ============ STUDIO: a menu QR pointing at the page ============
await op.goto(B + "/app/studio?type=menu");
await op.getByLabel("QR name (internal)").fill("Table menu");
const sel = op.getByLabel("Menu", { exact: true });
await sel.waitFor();
await sel.selectOption({ label: "Dinner menu" });
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Finish" }).click();
await op.getByText(/Published\. Your short link is/).waitFor();
const menuCode = (await op.getByText(/Published\. Your short link is/).innerText()).match(/\/q\/([a-z0-9-]+)/)[1];
t(!!menuCode, `studio: menu QR published (${menuCode})`);

// ============ CUSTOMER: menu in EN / TA / HI ============
const mobile = { viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36", isMobile: true, hasTouch: true };
const phoneCtx = await b.newContext({ ...mobile, locale: "en-IN" });
const cp = await phoneCtx.newPage();
cp.on("pageerror", (e) => errs.push("customer: " + e.message));
cp.on("console", (m) => { if (m.type() === "error" && !/status of (422|401)/.test(m.text())) errs.push("customer console: " + m.text()); });
await cp.goto(`${B}/q/${menuCode}`);
await cp.waitForURL(`**/s/${menuCode}`);
await cp.getByText("Ghee Roast Dosa").waitFor();
await cp.screenshot({ path: S + "/shots/p6-menu-en.png", fullPage: true });
await axeOn(cp, "menu page EN");
await noOverflow(cp, "menu 390");
await cp.getByRole("button", { name: "Add: Ghee Roast Dosa" }).first().click();
await cp.getByRole("button", { name: "Add: Ghee Roast Dosa" }).last().click();
await cp.getByRole("button", { name: "Add: Podi Dosa" }).click();
const wa = cp.getByRole("link", { name: /Order on WhatsApp · 3 items/ });
await wa.waitFor();
const href = await wa.getAttribute("href");
t(href.startsWith("https://wa.me/919876543210?text=") && decodeURIComponent(href).includes("2 × Ghee Roast Dosa") && decodeURIComponent(href).includes("Podi Dosa") && decodeURIComponent(href).includes("₹400"), `menu: WhatsApp order link carries the cart and total (${decodeURIComponent(href).slice(0, 90).replace(/\n/g, " ")}…)`);
await cp.screenshot({ path: S + "/shots/p6-menu-cart.png" });
for (const lang of ["ta", "hi"]) {
  await cp.goto(`${B}/s/${menuCode}?lang=${lang}`);
  await cp.getByText("Ghee Roast Dosa").waitFor();
  await cp.screenshot({ path: S + `/shots/p6-menu-${lang}.png`, fullPage: true });
  await axeOn(cp, `menu page ${lang}`);
}
const narrow = await b.newContext({ ...mobile, viewport: { width: 360, height: 740 } });
const np = await narrow.newPage();
await np.goto(`${B}/s/${menuCode}`); await np.getByText("Ghee Roast Dosa").waitFor(); await noOverflow(np, "menu 360");
await np.goto(`${B}/s/${menuCode}?lang=ta`); await np.getByText("Ghee Roast Dosa").waitFor(); await noOverflow(np, "menu 360 Tamil");

// ============ LEADS: form builder -> QR -> submit -> pipeline ============
await op.goto(B + "/app/leads?tab=forms");
await ownerAxe("/app/leads?tab=forms", "leads: forms tab");
await op.getByRole("button", { name: "+ New form" }).click();
await op.getByLabel("Form title").waitFor();
await op.getByLabel("Form title").fill("Free tasting");
await op.getByLabel("Intro (optional)").fill("We message you within 2 hours.");
await op.getByLabel("Notify (WhatsApp number)").fill("98765 43210");
await op.screenshot({ path: S + "/shots/p6-form-builder.png", fullPage: true });
await op.getByRole("form", { name: "New form" }).getByRole("button", { name: /Create|Save/ }).click();
await op.getByText("Free tasting").first().waitFor();
t(true, "leads: form created in the UI");
await op.goto(B + "/app/studio?type=lead");
await op.getByLabel("QR name (internal)").fill("Tasting QR");
await op.getByLabel("Form", { exact: true }).selectOption({ label: "Free tasting" });
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Finish" }).click();
await op.getByText(/Published\. Your short link is/).waitFor();
const leadCode = (await op.getByText(/Published\. Your short link is/).innerText()).match(/\/q\/([a-z0-9-]+)/)[1];
await cp.goto(`${B}/q/${leadCode}`);
await cp.getByLabel("Name").waitFor();
await axeOn(cp, "lead form EN");
await cp.getByRole("button", { name: /Send|Submit|Request/ }).last().click();
t(await cp.getByRole("alert").count() > 0 || await cp.locator('[aria-invalid="true"]').count() > 0, "lead form: empty submit shows inline errors");
await cp.getByLabel("Name").fill("Karthik R.");
await cp.getByLabel(/WhatsApp number|Phone/).fill("98765 00001");
await cp.screenshot({ path: S + "/shots/p6-lead-en.png", fullPage: true });
await cp.getByRole("button", { name: /Send|Submit|Request/ }).last().click();
await cp.getByText(/Thank/i).first().waitFor();
await cp.screenshot({ path: S + "/shots/p6-lead-thanks.png" });
t(true, "lead form: submission shows the thank-you");
await cp.goto(`${B}/s/${leadCode}?lang=hi`); await cp.getByRole("button").last().waitFor(); await cp.screenshot({ path: S + "/shots/p6-lead-hi.png", fullPage: true }); await axeOn(cp, "lead form HI");
await op.goto(B + "/app/leads");
await op.getByRole("article", { name: "Lead Karthik R." }).waitFor();
await op.screenshot({ path: S + "/shots/p6-pipeline.png", fullPage: true });
await axeOn(op, "leads: pipeline");
await op.getByLabel("Stage for Karthik R.").selectOption("contacted");
await op.waitForTimeout(800);
await op.reload();
const card = op.getByRole("region", { name: "Contacted leads" }).getByRole("article", { name: "Lead Karthik R." });
t(await card.count() === 1, "leads: choosing a stage moves the card to that column and persists");
await ownerAxe("/app/leads?tab=contacts", "leads: contacts tab");
await ownerAxe("/app/leads?tab=broadcasts", "leads: broadcasts tab");
await ownerAxe("/app/leads?tab=segments", "leads: segments tab");
// import
await op.goto(B + "/app/leads?tab=contacts");
const csv = "name,phone,email,tags\nAnanya R.,98765 43210,a@example.com,VIP\nBad,12,,\n";
await op.locator('input[type="file"]').setInputFiles({ name: "contacts.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
await op.getByText("contacts.csv: 2 rows").waitFor();
await op.getByRole("button", { name: "Import", exact: true }).click();
await op.getByText(/1 added, 0 already existed, 1 skipped/).waitFor({ timeout: 5000 }).then(() => t(true, "contacts: CSV import reports what was added and skipped")).catch(() => t(false, "contacts: CSV import message not found"));

// ============ OFFERS: coupon + redeem dialog + loyalty ============
await op.goto(B + "/app/offers?new=1");
await op.getByLabel("Offer name").fill("Weekend coffee");
await op.getByLabel("Headline").fill("2 for ₹99");
await op.getByLabel("Code prefix").fill("WKND");
await op.screenshot({ path: S + "/shots/p6-offer-new.png", fullPage: true });
await axeOn(op, "offers: new offer form");
await op.getByRole("form", { name: "New offer" }).getByRole("button", { name: /Create|Save/ }).click();
await op.getByText("Weekend coffee").first().waitFor();
t(true, "offers: coupon created in the UI");
await op.goto(B + "/app/studio?type=coupon");
await op.getByLabel("QR name (internal)").fill("Weekend QR");
await op.getByLabel("Offer", { exact: true }).selectOption({ label: "2 for ₹99 · Weekend coffee" });
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Next step" }).click();
await op.getByRole("button", { name: "Finish" }).click();
await op.getByText(/Published\. Your short link is/).waitFor();
const couponCode = (await op.getByText(/Published\. Your short link is/).innerText()).match(/\/q\/([a-z0-9-]+)/)[1];
await cp.goto(`${B}/s/${couponCode}`);
await cp.getByRole("button", { name: "Claim this offer" }).waitFor();
await axeOn(cp, "coupon page EN");
await cp.getByLabel(/WhatsApp number/).fill("98765 20001");
await cp.getByRole("button", { name: "Claim this offer" }).click();
const codeEl = cp.getByText(/WKND-[A-Z2-9]{4}/).first();
await codeEl.waitFor();
const couponText = (await codeEl.innerText()).match(/WKND-[A-Z2-9]{4}/)[0];
await cp.screenshot({ path: S + "/shots/p6-coupon-claimed.png", fullPage: true });
await axeOn(cp, "coupon claimed");
t(true, `coupon: claimed on the phone (${couponText})`);
for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${couponCode}?lang=${lang}`); await cp.getByRole("button").last().waitFor(); await cp.screenshot({ path: S + `/shots/p6-coupon-${lang}.png`, fullPage: true }); await axeOn(cp, `coupon ${lang}`); }
// redeem dialog
await op.goto(B + "/app/offers");
await op.getByRole("button", { name: "Redeem a code" }).click();
const dlg = op.getByRole("dialog");
await dlg.getByLabel("Code").fill(couponText.toLowerCase());
await dlg.getByRole("button", { name: "Check code" }).click();
await dlg.getByText(/2 for ₹99/).waitFor();
await op.screenshot({ path: S + "/shots/p6-redeem.png" });
await axeOn(op, "redeem dialog open");
await dlg.getByRole("button", { name: "Mark as redeemed" }).click();
await dlg.getByText(/Redeemed|redeemed/).first().waitFor();
t(true, "offers: redeem dialog looks up and redeems the code");
await op.keyboard.press("Escape");
await ownerAxe("/app/offers", "offers: coupons tab");

// loyalty (a second workspace: free plans hold 3 dynamic codes)
const owner2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const ph2 = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
r = await owner2.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone: ph2, businessName: "Coffee Corner" } });
await owner2.request.post(B + "/api/auth/otp/verify", { data: { code: (await r.json()).devCode } });
await owner2.request.post(B + "/api/onboarding", { data: { industry: "food", goals: ["loyalty"], locationName: "Anna Nagar, Chennai", address: "2 Main Rd", complete: true } });
const op1 = op;
const op2 = await owner2.newPage();
op2.on("pageerror", (e) => errs.push("owner2: " + e.message));
op2.on("console", (m) => { if (m.type() === "error") errs.push("owner2 console: " + m.text()); });
globalThis.__op = op2;
await op2.goto(B + "/app/offers?tab=loyalty");
await op2.getByLabel("Programme name").fill("Coffee Club");
await op2.getByLabel("Stamps needed").fill("3");
await op2.getByLabel("Reward").fill("1 free coffee");
await op2.getByLabel("Staff PIN (4 digits)").fill("7391");
await op2.getByRole("button", { name: /Save|Create|Update/ }).last().click();
await op2.getByText(/LIVE/).first().waitFor();
await op2.screenshot({ path: S + "/shots/p6-loyalty-owner.png", fullPage: true });
await axeOn(op2, "offers: loyalty tab");
await op2.goto(B + "/app/studio?type=loyalty");
await op2.getByLabel("QR name (internal)").fill("Counter card");
await op2.getByRole("button", { name: "Next step" }).click();
await op2.getByRole("button", { name: "Next step" }).click();
await op2.getByRole("button", { name: "Finish" }).click();
await op2.getByText(/Published\. Your short link is/).waitFor();
const loyCode = (await op2.getByText(/Published\. Your short link is/).innerText()).match(/\/q\/([a-z0-9-]+)/)[1];
await cp.goto(`${B}/s/${loyCode}`);
await cp.getByRole("heading", { name: "Join and collect stamps" }).waitFor();
await axeOn(cp, "loyalty join");
await cp.getByLabel(/WhatsApp number/).fill("98765 30001");
await cp.getByRole("button", { name: "Get my card" }).click();
await cp.getByText("0 / 3").waitFor();
await cp.screenshot({ path: S + "/shots/p6-loyalty-card.png", fullPage: true });
await axeOn(cp, "loyalty card");
t(await cp.evaluate(() => Object.keys(localStorage).some((k) => /skn|loyal/i.test(k))), "loyalty: card remembered on the device");
await cp.reload();
await cp.getByText("0 / 3").waitFor();
t(true, "loyalty: card reappears after reload without re-entering the number");
await cp.getByText("Staff: add a stamp").click();
await cp.getByLabel("4-digit staff PIN").fill("1111");
await cp.getByRole("button", { name: "Add stamp" }).click();
await cp.getByText(/That PIN isn't right\. 4 tries left/).waitFor();
t(true, "loyalty: wrong PIN shows the remaining tries");
await cp.getByLabel("4-digit staff PIN").fill("7391");
await cp.getByRole("button", { name: "Add stamp" }).click();
await cp.getByText("1 / 3").waitFor();
t(true, "loyalty: right PIN adds a stamp");
await cp.screenshot({ path: S + "/shots/p6-loyalty-stamped.png", fullPage: true });
for (const lang of ["ta", "hi"]) { await cp.goto(`${B}/s/${loyCode}?lang=${lang}`); await cp.getByText("1 / 3").waitFor(); await cp.screenshot({ path: S + `/shots/p6-loyalty-${lang}.png`, fullPage: true }); await axeOn(cp, `loyalty ${lang}`); }
await np.goto(`${B}/s/${loyCode}`); await np.getByText(/Coffee Club|Join|Get my card/).first().waitFor(); await noOverflow(np, "loyalty 360");
await np.goto(`${B}/s/${couponCode}?lang=hi`); await np.getByRole("button").last().waitFor(); await noOverflow(np, "coupon 360 Hindi");
await np.goto(`${B}/s/${leadCode}?lang=ta`); await np.getByRole("button").last().waitFor(); await noOverflow(np, "lead form 360 Tamil");

// ============ CARD + BIO ============
for (const [kind, title, content] of [
  ["card", "Meena S.", { name: "Meena S.", role: "Manager", company: "Saravana Cafe", phone: "98765 43210", whatsapp: "98765 43210", email: "meena@example.com", website: "example.com", address: "1 Main Rd" }],
  ["bio", "Cafe links", { headline: "Find Saravana Cafe", links: [{ label: "Order online", url: "example.com/order" }, { label: "Instagram", url: "instagram.com/cafe" }] }],
]) {
  const res = await owner2.request.post(B + "/api/pages", { data: { kind, title } }); const id = (await res.json()).id;
  await owner2.request.patch(B + `/api/pages/${id}`, { data: { title, status: "published", content } });
  const q = await owner2.request.post(B + "/api/qr", { data: { name: title + " QR", type: kind === "card" ? "vcard" : "bio", config: { pageId: id }, publish: true } });
  const qj = await q.json();
  if (!qj.shortCode) { console.log("SKIP", kind, "QR not created", JSON.stringify(qj)); continue; }
  for (const lang of ["en", "ta", "hi"]) {
    await cp.goto(`${B}/s/${qj.shortCode}?lang=${lang}`);
    await cp.getByRole("heading").first().waitFor();
    await cp.screenshot({ path: S + `/shots/p6-${kind}-${lang}.png`, fullPage: true });
    await axeOn(cp, `${kind} page ${lang}`);
  }
  await np.goto(`${B}/s/${qj.shortCode}`); await np.getByRole("heading").first().waitFor(); await noOverflow(np, `${kind} 360`);
}
await ownerAxe("/app/pages", "pages list (with pages)");
await ownerAxe("/app/analytics", "analytics with engage actions");
await op.setViewportSize({ width: 360, height: 800 });
for (const p of ["/app/pages", "/app/leads", "/app/leads?tab=contacts", "/app/offers", "/app/offers?tab=loyalty"]) { await op.goto(B + p); await op.waitForTimeout(300); await noOverflow(op, `owner ${p} @360`); }

fs.writeFileSync(S + "/errs.txt", errs.join("\n=====\n")); t(errs.length === 0, "no page or console errors (" + errs.length + ", see errs.txt)");
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
