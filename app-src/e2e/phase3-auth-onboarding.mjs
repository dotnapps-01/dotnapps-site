// Browser test (Playwright + axe). Needs the dev server running: see e2e/README.md.
//   node e2e/phase3-auth-onboarding.mjs [baseUrl]      (screenshots and downloads go to e2e/out, which is git-ignored)
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { makePng } from "../scripts/images.mjs";
const require = createRequire(import.meta.url);
const S = process.env.E2E_OUT ?? new URL("./out", import.meta.url).pathname;
fs.mkdirSync(S + "/shots", { recursive: true });
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8").replace(/\/\/# sourceMappingURL.*/, "");
const B = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "9000000001";
let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const phone = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const axe = async (label) => { const q = await ctx.newPage(); await q.goto(p.url()); await q.evaluate(axeSrc); const r = await q.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] })); await q.close(); t(r.violations.length === 0, `axe: ${label} (${r.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.html.slice(0, 120)).join(" || ")).join("; ") || "0 violations"})`); };

// --- signup validation
await p.goto(B + "/signup");
await p.screenshot({ path: S + "/shots/signup-1440.png" });
await axe("/signup");
await p.getByRole("button", { name: "Send OTP on WhatsApp" }).click();
t(await p.getByText("Enter your business name.").isVisible() && await p.getByText("Enter a valid 10-digit Indian mobile number.").isVisible(), "signup: empty submit shows both errors");
t(await p.getByLabel("Business name").evaluate((e) => e === document.activeElement), "signup: focus goes to first invalid field");
await p.getByRole("button", { name: /Continue with Google/ }).click();
t(await p.getByText("Google sign-in isn’t set up yet").isVisible(), "signup: Google button explains it isn't configured");
await p.getByLabel("Business name").fill("Saravana Cafe");
await p.getByLabel(/Mobile number/).fill("12345");
await p.getByRole("button", { name: "Send OTP on WhatsApp" }).click();
t(await p.getByText("Enter a valid 10-digit Indian mobile number.").isVisible(), "signup: short number rejected client-side");
await p.getByLabel(/Mobile number/).fill(phone);
await p.getByRole("button", { name: "Send OTP on WhatsApp" }).click();
await p.waitForURL("**/onboarding");

// --- OTP step
await p.getByRole("heading", { name: "Enter the code we sent on WhatsApp" }).waitFor();
const dev = (await p.locator("[role=note] strong").innerText()).trim();
t(/^\d{6}$/.test(dev), `otp: dev banner shows code (${dev})`);
t((await p.getByText(/Sent to \+91 \d\dxxx xx\d{3}/).count()) === 1, "otp: masked number shown");
await p.screenshot({ path: S + "/shots/onb-0-1440.png" });
await axe("onboarding step 1 (OTP)");
// wrong code first, via typing
const wrong = dev === "123456" ? "654321" : "123456";
await p.getByLabel("Digit 1 of 6").click();
await p.keyboard.type(wrong);
await p.getByText(/That code isn't right\. 4 tries left/).waitFor();
t(true, "otp: typing 6 wrong digits auto-submits and shows '4 tries left'");
t((await p.getByLabel("Digit 1 of 6").inputValue()) === "", "otp: boxes cleared after a wrong code");
// typing advances focus, backspace goes back
await p.getByLabel("Digit 1 of 6").click();
await p.keyboard.type("12");
t(await p.getByLabel("Digit 3 of 6").evaluate((e) => e === document.activeElement), "otp: typing auto-advances focus");
await p.keyboard.press("Backspace");
await p.keyboard.press("Backspace");
t((await p.getByLabel("Digit 1 of 6").inputValue()) === "" && (await p.getByLabel("Digit 2 of 6").inputValue()) === "" && await p.getByLabel("Digit 1 of 6").evaluate((e) => e === document.activeElement), "otp: backspace on an empty box clears the previous digit and moves back");
// paste full code
await p.getByLabel("Digit 1 of 6").click();
await p.evaluate((code) => { const el = document.activeElement; const dt = new DataTransfer(); dt.setData("text", code); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, dev);
await p.getByRole("heading", { name: "What kind of business do you run?" }).waitFor({ timeout: 5000 });
t(true, "otp: pasting the code verifies it and moves to step 2");
t(await p.getByRole("heading", { name: "What kind of business do you run?" }).evaluate((e) => e === document.activeElement), "focus moves to the new step heading");
t(await p.locator("li[aria-current=step]").innerText().then((x) => x.includes("Business")), "stepper marks step 2 current");
t((await p.getByRole("button", { name: "Back" }).isVisible()) === false, "Back hidden on first verified step");

// --- step 2 industry
await p.screenshot({ path: S + "/shots/onb-1-1440.png" });
await axe("onboarding step 2 (industry)");
await p.getByRole("button", { name: "Continue" }).click();
t(await p.getByText("Pick the closest match to continue.").isVisible(), "industry: Continue without a pick shows a hint");
await p.getByRole("button", { name: "Salon / spa" }).click();
t((await p.getByRole("button", { name: "Salon / spa" }).getAttribute("aria-pressed")) === "true", "industry: tile aria-pressed");
await p.getByRole("button", { name: "Continue" }).click();

// --- step 3 goals (recommended preselected for salon: reviews, bookings, loyalty)
await p.getByRole("heading", { name: "What should your QR codes do first?" }).waitFor();
t(/salon \/ spa/.test(await p.locator("main p").first().innerText()), "goals: copy names the chosen industry");
const pressed = await p.locator("button[aria-pressed=true]").allInnerTexts();
t(pressed.length === 3 && pressed.some((x) => x.includes("Bookings")), `goals: 3 recommended goals preselected (${pressed.map((x) => x.split("\n")[0]).join(", ")})`);
await p.screenshot({ path: S + "/shots/onb-2-1440.png" });
await axe("onboarding step 3 (goals)");
for (const g of ["Get more Google reviews", "Bookings & appointments", "Loyalty stamp card"]) await p.getByRole("button", { name: new RegExp(g) }).click();
await p.getByRole("button", { name: "Continue" }).click();
t(await p.getByText("Pick at least one goal to continue.").isVisible(), "goals: zero goals blocked");
await p.getByRole("button", { name: /Collect leads/ }).click();
await p.getByRole("button", { name: /Wi-Fi/ }).click();
await p.getByRole("button", { name: "Continue" }).click();

// --- step 4 location
await p.getByRole("heading", { name: "Add your first location" }).waitFor();
await p.screenshot({ path: S + "/shots/onb-3-1440.png" });
await axe("onboarding step 4 (location)");
await p.getByRole("button", { name: "Create my workspace" }).click();
t(await p.getByText("Enter a location name to continue.").isVisible(), "location: empty name blocked");
await p.getByRole("button", { name: "Connect", exact: true }).click();
t(await p.getByText(/after setup, from Integrations/).isVisible(), "location: Connect explains it comes after setup");
await p.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: makePng(128, 128) });
await p.getByText("Your logo is saved").waitFor();
t(await p.getByRole("img", { name: "Your logo" }).isVisible(), "location: uploading a logo works during onboarding");
await p.getByLabel("Location name").fill("Anna Nagar, Chennai");
// refresh mid-wizard resumes at this step with data kept? (saved server-side up to step 3)
await p.reload();
await p.getByRole("heading", { name: "Add your first location" }).waitFor();
t(true, "refresh resumes the wizard at step 4");
t(await p.getByText("Your logo is saved").isVisible(), "refresh keeps the uploaded logo");
await p.getByLabel("Location name").fill("Anna Nagar, Chennai");
await p.getByRole("button", { name: "Back" }).click();
t(await p.getByRole("button", { name: /Wi-Fi/ }).getAttribute("aria-pressed") === "true", "back: goal selections kept");
await p.getByRole("button", { name: "Continue" }).click();
await p.getByLabel("Location name").fill("Anna Nagar, Chennai");
await p.getByRole("button", { name: "Create my workspace" }).click();

// --- step 5 live
await p.getByRole("heading", { name: "Your first QR is ready." }).waitFor();
t(/2 flows for your salon \/ spa workspace/.test(await p.locator("main").innerText()), "live: copy shows 2 flows + industry");
await p.screenshot({ path: S + "/shots/onb-4-1440.png" });
await axe("onboarding step 5 (live)");
await p.getByRole("link", { name: "Go to dashboard" }).click();
await p.waitForURL("**/app/dashboard");
const side = await p.locator("aside").innerText();
t(side.includes("Saravana Cafe") && side.includes("Anna Nagar, Chennai") && side.includes("FREE PLAN") && side.includes("0/3 QR"), "dashboard sidebar: real business, location, Free plan 0/3");
t((await p.locator('nav[aria-label=App] a span.bg-ink').count()) === 0, "dashboard sidebar: no fake notification badges");
await p.screenshot({ path: S + "/shots/dashboard-1440.png" });
t((await p.goto(B + "/onboarding")) && p.url().endsWith("/app/dashboard"), "finished user visiting /onboarding is sent to dashboard");

// --- logout then login again (same browser: workspace cookie persists)
await p.getByRole("button", { name: "Log out" }).click();
await new Promise((r) => setTimeout(r, 31000)); // wait out the 30s resend cooldown for this number
await p.waitForURL("**/login");
await p.screenshot({ path: S + "/shots/login-1440.png" });
await axe("/login");
await p.getByLabel(/Mobile number/).fill(phone);
await p.getByRole("button", { name: "Send OTP on WhatsApp" }).click();
await p.waitForURL("**/onboarding");
const dev2 = (await p.locator("[role=note] strong").innerText()).trim();
await p.getByLabel("Digit 1 of 6").click();
await p.keyboard.type(dev2);
await p.waitForURL("**/app/dashboard", { timeout: 5000 });
t(true, "login: returning user goes OTP -> dashboard (no wizard)");

// --- mobile 360
const m = await b.newContext({ viewport: { width: 360, height: 800 } });
const mp = await m.newPage();
const mphone = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const noOverflow = async (label) => t(await mp.evaluate(() => document.documentElement.scrollWidth <= 360), `360px: no horizontal overflow on ${label}`);
await mp.goto(B + "/signup"); await noOverflow("/signup"); await mp.screenshot({ path: S + "/shots/signup-360.png", fullPage: true });
await mp.getByLabel("Business name").fill("Glow Salon"); await mp.getByLabel(/Mobile number/).fill(mphone);
await mp.getByRole("button", { name: "Send OTP on WhatsApp" }).click(); await mp.waitForURL("**/onboarding");
await noOverflow("onboarding OTP"); await mp.screenshot({ path: S + "/shots/onb-0-360.png", fullPage: true });
const d3 = (await mp.locator("[role=note] strong").innerText()).trim();
await mp.getByLabel("Digit 1 of 6").click(); await mp.keyboard.type(d3);
await mp.getByRole("heading", { name: "What kind of business do you run?" }).waitFor();
await noOverflow("onboarding industry"); await mp.screenshot({ path: S + "/shots/onb-1-360.png", fullPage: true });
await mp.getByRole("button", { name: "Restaurant / café" }).click(); await mp.getByRole("button", { name: "Continue" }).click();
await noOverflow("onboarding goals"); await mp.getByRole("button", { name: "Continue" }).click();
await mp.getByLabel("Location name").fill("RS Puram"); await noOverflow("onboarding location");
await mp.getByRole("button", { name: "Create my workspace" }).click();
await mp.getByRole("heading", { name: "Your first QR is ready." }).waitFor(); await noOverflow("onboarding live"); await mp.screenshot({ path: S + "/shots/onb-4-360.png", fullPage: true });
await mp.goto(B + "/app/dashboard"); await mp.getByRole("button", { name: "Open menu" }).click(); await mp.waitForTimeout(300);
t(await mp.getByRole("button", { name: "Log out" }).isVisible(), "360px: log out reachable in the drawer");
await mp.screenshot({ path: S + "/shots/dashboard-360-drawer.png" });

t(errs.length === 0, "no uncaught page errors" + (errs.length ? ": " + errs.join("|") : ""));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
