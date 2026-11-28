// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase10-team.mjs [baseUrl]      (screenshots go to e2e/out, which is git-ignored)
// Team roles: the owner invites by mobile number, people join by signing in, each role sees (and is stopped from) the
// right screens, roles change and removal takes effect at once, and the team card works at phone width.
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
const step = async (name, fn) => { try { await fn(); } catch (e) { for (const [i, pg] of pagesToShoot.entries()) await pg.screenshot({ path: `${S}/shots/fail10-${name.replace(/[^a-z0-9]+/gi, "-")}-${i}.png` }).catch(() => {}); const lines = String(e.message).split("\n").slice(0, 6).join(" | "); t(false, `${name} :: ${lines}`); } };

async function signUp(name, phone = rnd(), viewport = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const r = await ctx.request.post(B + "/api/auth/otp/send", { data: { mode: "signup", phone, businessName: name } });
  const j = await r.json();
  if (!j.devCode) throw new Error("no dev code: " + JSON.stringify(j));
  await ctx.request.post(B + "/api/auth/otp/verify", { data: { code: j.devCode } });
  await ctx.request.post(B + "/api/onboarding", { data: { industry: "food", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true } });
  const page = await ctx.newPage();
  watch(page, name);
  return { ctx, page };
}
/** Signs in the way a person does: the login page, the one-time code, the dashboard. */
async function loginUi(phone, who, viewport = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  watch(page, who);
  await page.goto(B + "/login");
  await page.getByLabel(/Mobile number/).fill(phone);
  await page.getByRole("button", { name: "Send OTP on WhatsApp" }).click();
  await page.waitForURL("**/onboarding");
  const dev = (await page.locator("[role=note] strong").innerText()).trim();
  await page.getByLabel("Digit 1 of 6").click();
  await page.keyboard.type(dev);
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  return { ctx, page };
}

const run = Date.now().toString(36).slice(-5);
const BIZ = `Team Cafe ${run}`;
const adm = await signUp("Skanor Staff", ADMIN_PHONE);
const O = await signUp(BIZ);
const F = await signUp(`Solo Shop ${run}`);
const idOf = async (name) => (((await (await adm.ctx.request.get(`${B}/app/admin?q=${encodeURIComponent(name)}`)).text()).match(new RegExp(`data-tenant="([0-9a-f-]{36})" data-name="${name}"`)) ?? [])[1]);
await adm.ctx.request.patch(`${B}/api/admin/tenants/${await idOf(BIZ)}`, { data: { plan: "growth" } });

const STAFF = rnd(), MGR = rnd();
let staff, mgr;

/* ============================ OWNER INVITES ============================ */
await step("owner: invite", async () => {
  const p = O.page;
  await p.goto(B + "/app/settings");
  const team = p.locator("#team");
  await team.getByRole("heading", { name: "Team & roles" }).waitFor();
  t(await team.getByText(/1 of 10/).isVisible(), "owner: the card says how many of the plan's seats are used");
  t((await team.getByRole("region", { name: /Team members/ }).getByRole("row").filter({ hasText: "OWNER" }).count()) === 1, "owner: the table starts with the owner");
  await axeOn(p, "settings: team card");
  await team.getByRole("button", { name: "Invite member" }).click();
  const form = team.getByRole("form", { name: "Invite a team member" });
  await form.getByRole("button", { name: "Add to team" }).click();
  await form.getByText("Enter their name (2+ characters).").waitFor();
  t(await form.getByText("Enter a valid 10-digit Indian mobile number.").isVisible(), "owner: an empty form says what's missing");
  t((await form.getByLabel("Role").locator("option").allInnerTexts()).join() === "Staff,Manager", "owner: can offer Staff or Manager");
  await axeOn(p, "settings: invite form with errors");
  await form.getByLabel("Name").fill("Ravi Kumar");
  await form.getByLabel("Mobile number").fill(STAFF);
  await form.getByRole("button", { name: "Add to team" }).click();
  await form.getByRole("status").waitFor();
  t(/Ravi Kumar.*on the team as Staff/.test(await form.getByRole("status").innerText()), "owner: adding someone confirms it and says how they join");
  const wa = await form.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href");
  t(wa.startsWith(`https://wa.me/91${STAFF}?text=`) && decodeURIComponent(wa).includes(BIZ) && decodeURIComponent(wa).includes("/login"), "owner: a ready-made WhatsApp message to pass on the invitation");
  await form.getByRole("button", { name: "Copy message" }).click();
  await form.getByRole("button", { name: "Copied" }).waitFor();
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  t(clip.includes("Hi Ravi") && clip.includes(BIZ) && clip.includes("Staff") && clip.includes("/login"), "owner: Copy message puts the invitation text on the clipboard");
  await p.screenshot({ path: S + "/shots/p10-invited.png", fullPage: true });
  const row = team.getByRole("row").filter({ hasText: "Ravi Kumar" });
  await row.waitFor();
  t(await row.getByText("INVITED").isVisible(), "owner: the new member shows as Invited");
  // the same number again
  await form.getByLabel("Name").fill("Ravi Again");
  await form.getByLabel("Mobile number").fill(STAFF);
  await form.getByRole("button", { name: "Add to team" }).click();
  await form.getByRole("alert").filter({ hasText: "already on your team" }).waitFor();
  t(true, "owner: adding the same number again says so");
  // a manager, for later
  await form.getByLabel("Name").fill("Meena S");
  await form.getByLabel("Mobile number").fill(MGR);
  await form.getByLabel("Role").selectOption("manager");
  await form.getByRole("button", { name: "Add to team" }).click();
  await team.getByRole("row").filter({ hasText: "Meena S" }).waitFor();
  t(true, "owner: a Manager can be added too");
});

/* ============================ STAFF SIGNS IN ============================ */
await step("staff: signs in and works", async () => {
  staff = await loginUi(STAFF, "staff");
  const p = staff.page;
  await p.getByRole("heading", { level: 1 }).first().waitFor();
  t(await p.getByText(`Staff · ${BIZ}`).isVisible(), "staff: the sidebar says their role and the business");
  const nav = p.getByRole("navigation", { name: "App" });
  const links = await nav.getByRole("link").allInnerTexts();
  const has = (n) => links.some((l) => l.includes(n));
  t(has("Dashboard") && has("Analytics") && has("Leads") && has("Offers") && has("Tickets") && has("Attendance") && has("Bookings") && has("Real estate"), "staff: the menu has their day-to-day screens");
  t(!has("Create QR") && !has("QR Library") && !has("Pages") && !has("Reviews") && !has("Product") && !has("Integrations") && !has("Settings"), "staff: the menu leaves out set-up, billing and settings");
  t(!(await p.getByRole("link", { name: /Upgrade to/ }).count()) && !(await p.getByRole("link", { name: "Create QR" }).count()), "staff: no upgrade link, no Create QR button");
  await p.screenshot({ path: S + "/shots/p10-staff-dashboard.png", fullPage: true });
  await axeOn(p, "staff: dashboard");
  // a screen that isn't theirs, by address
  await p.goto(B + "/app/studio");
  await p.getByRole("heading", { name: "This screen isn't available to your role" }).waitFor();
  t(/Staff/.test(await p.getByRole("status").innerText()), "staff: a screen that isn't theirs explains why, in words");
  await p.screenshot({ path: S + "/shots/p10-noaccess.png", fullPage: true });
  await axeOn(p, "staff: no-access screen");
  await p.getByRole("link", { name: "Back to the dashboard" }).click();
  await p.waitForURL("**/app/dashboard");
  t(true, "staff: ...with a way back");
  // a tab that isn't theirs
  await p.goto(B + "/app/leads?tab=forms");
  await p.getByRole("heading", { name: "This screen isn't available to your role" }).waitFor();
  await p.goto(B + "/app/leads");
  await p.getByRole("heading", { name: "Leads & contacts" }).waitFor();
  const tabs = await p.getByRole("navigation", { name: "Leads sections" }).getByRole("link").allInnerTexts();
  t(tabs.length === 2 && tabs[0].startsWith("Pipeline") && tabs[1].startsWith("Contacts"), `staff: leads shows only the pipeline and contacts tabs (${tabs.map((x) => x.split("\n")[0]).join(", ")})`);
  t(!(await p.getByRole("link", { name: "New form" }).count()), "staff: ...and no New form button");
  await axeOn(p, "staff: leads");
  // real work: raise a ticket, redeem a code
  await p.goto(B + "/app/tickets?new=1");
  await p.getByRole("button", { name: "New ticket" }).first().waitFor().catch(() => {});
  t(!(await p.getByRole("link", { name: "Add asset" }).count()) && !(await p.getByRole("link", { name: "SLA rules" }).count()), "staff: tickets has no asset or SLA set-up");
  await axeOn(p, "staff: tickets");
  await p.goto(B + "/app/offers");
  await p.getByRole("heading", { name: "Redeem offers & stamp cards" }).waitFor();
  t(!(await p.getByRole("link", { name: "New offer" }).count()), "staff: offers is for redeeming, with no New offer");
  await p.getByRole("button", { name: "Redeem a code" }).click();
  const dlg = p.getByRole("dialog", { name: "Redeem a code" });
  await dlg.getByLabel("Code").fill("NOPE-0000");
  await dlg.getByRole("button", { name: "Check code" }).click();
  await dlg.getByText("We can't find that code.").waitFor();
  t(true, "staff: the redeem box works for them");
  await p.keyboard.press("Escape");
  await axeOn(p, "staff: offers (redeem only)");
  await p.goto(B + "/app/analytics");
  await p.getByRole("heading", { name: "Analytics" }).first().waitFor();
  t(!(await p.getByRole("link", { name: "Export CSV" }).count()), "staff: analytics is view-only, no CSV download");
  await p.goto(B + "/app/real-estate");
  await p.getByRole("heading", { name: "Real estate plots" }).waitFor();
  await axeOn(p, "staff: real estate");
});

/* ============================ MANAGER ============================ */
await step("manager", async () => {
  mgr = await loginUi(MGR, "manager");
  const p = mgr.page;
  t(await p.getByText(`Manager · ${BIZ}`).isVisible(), "manager: the sidebar says Manager");
  const nav = p.getByRole("navigation", { name: "App" });
  const links = await nav.getByRole("link").allInnerTexts();
  const has = (n) => links.some((l) => l.includes(n));
  t(has("Create QR") && has("QR Library") && has("Settings") && has("Reviews") && !has("Integrations"), "manager: the menu has the set-up screens and Settings, not Integrations");
  await p.goto(B + "/app/settings");
  const team = p.locator("#team");
  await team.getByRole("heading", { name: "Team & roles" }).waitFor();
  t(!(await p.getByRole("button", { name: "Delete workspace" }).count()) && !(await p.getByRole("heading", { name: "Security & audit log" }).count()), "manager: no delete-workspace and no audit log");
  t(await p.getByText("Only the owner can change the plan or billing details.").isVisible(), "manager: billing says it's the owner's");
  await team.getByRole("button", { name: "Invite member" }).click();
  const form = team.getByRole("form", { name: "Invite a team member" });
  t((await form.getByLabel("Role").locator("option").allInnerTexts()).join() === "Staff", "manager: can offer Staff only");
  const ravi = team.getByRole("row").filter({ hasText: "Ravi Kumar" });
  t((await ravi.getByRole("combobox").count()) === 0, "manager: can't change anyone's role");
  t((await team.getByRole("row").filter({ hasText: "Meena S" }).getByRole("button", { name: /Remove/ }).count()) === 0, "manager: can't remove themself or another Manager");
  t(await ravi.getByRole("button", { name: "Remove Ravi Kumar" }).isVisible(), "manager: can remove Staff");
  await axeOn(p, "manager: settings with the team card");
  await p.goto(B + "/app/integrations");
  await p.getByRole("heading", { name: "This screen isn't available to your role" }).waitFor();
  t(true, "manager: Integrations is the owner's");
});

/* ============================ ROLE CHANGE, REMOVAL ============================ */
await step("owner: change role, remove", async () => {
  const p = O.page;
  await p.goto(B + "/app/settings");
  const team = p.locator("#team");
  await team.getByRole("heading", { name: "Team & roles" }).waitFor();
  const row = team.getByRole("row").filter({ hasText: "Ravi Kumar" });
  t(await row.getByText("ACTIVE").isVisible(), "owner: Ravi shows as Active once he has signed in");
  await row.getByLabel("Role for Ravi Kumar").selectOption("manager");
  await team.getByRole("status").filter({ hasText: "Ravi Kumar is now Manager." }).waitFor();
  t(true, "owner: changes a role from the table");
  await staff.page.goto(B + "/app/studio");
  await staff.page.getByRole("heading", { name: "Create a QR code" }).waitFor();
  t(true, "role change: Ravi can open Create QR on his next click, without signing in again");
  await row.getByLabel("Role for Ravi Kumar").selectOption("staff");
  await team.getByRole("status").filter({ hasText: "Ravi Kumar is now Staff." }).waitFor();
  await staff.page.goto(B + "/app/studio");
  await staff.page.getByRole("heading", { name: "This screen isn't available to your role" }).waitFor();
  t(true, "role change: and loses it the same way");
  await p.screenshot({ path: S + "/shots/p10-team-card.png", fullPage: true });
  // remove him
  p.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Remove Ravi Kumar" }).click();
  await team.getByRole("status").filter({ hasText: "Ravi Kumar removed." }).waitFor();
  await row.waitFor({ state: "detached" });
  t(true, "owner: removes a member");
  await staff.page.goto(B + "/app/dashboard");
  await staff.page.waitForLoadState("networkidle");
  t(!(await staff.page.getByText(BIZ).count()), "removal: Ravi's open session no longer reaches the business");
  const audit = await p.locator("#security").innerText();
  t(/Team member added/.test(audit) && /Team role changed/.test(audit) && /Team member removed/.test(audit), "audit: invitations, role changes and removals are listed");
  // seat bar
  await p.goto(B + "/app/settings");
  t(await p.getByRole("progressbar", { name: "Team seats" }).count() === 1, "settings: team seats show in plan usage");
});

/* ============================ FREE PLAN, PHONE WIDTH ============================ */
await step("free plan and mobile", async () => {
  const p = F.page;
  await p.goto(B + "/app/settings");
  const team = p.locator("#team");
  await team.getByRole("heading", { name: "Team & roles" }).waitFor();
  t(await team.getByRole("button", { name: "Invite member" }).isDisabled(), "free plan: Invite member is off when every seat is taken");
  t(await team.getByText(/All seats are taken/).isVisible(), "free plan: and says why");
  const m = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  for (const c of await O.ctx.cookies()) await m.addCookies([c]);
  const mp = await m.newPage(); watch(mp, "owner mobile");
  await mp.goto(B + "/app/settings");
  await mp.locator("#team").getByRole("heading", { name: "Team & roles" }).waitFor();
  await mp.locator("#team").getByRole("button", { name: "Invite member" }).click();
  await mp.locator("#team").getByLabel("Name").waitFor();
  await noOverflow(mp, "settings team card @360");
  await mp.screenshot({ path: S + "/shots/p10-team-360.png", fullPage: true });
  await mp.close(); await m.close();
  const m2 = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  for (const c of await mgr.ctx.cookies()) await m2.addCookies([c]);
  const sp = await m2.newPage(); watch(sp, "manager mobile");
  await sp.goto(B + "/app/dashboard"); await sp.getByRole("heading", { level: 1 }).first().waitFor();
  await noOverflow(sp, "manager dashboard @360");
  await sp.goto(B + "/app/integrations"); await sp.getByRole("heading", { name: "This screen isn't available to your role" }).waitFor();
  await noOverflow(sp, "no-access screen @360");
  await m2.close();
});

fs.writeFileSync(S + "/errs10.txt", errs.join("\n=====\n"));
t(errs.length === 0, "no page or console errors (" + errs.length + ", see errs10.txt)");
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
