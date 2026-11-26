// Runs everything: type-independent checks, every API suite, the browser tests, then the platform suite again the way
// production behaves. It starts and stops its own dev server (the dev server is needed because sign-in codes are shown
// on screen only outside production).
//
//   npm run test:all                      uses DATABASE_URL if set, otherwise the embedded database in .data
//   SKIP_E2E=1 npm run test:all           API suites only (a few minutes instead of fifteen)
//   PORT=3200 npm run test:all            another port
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";

const port = process.env.PORT ?? "3100";
const base = `http://localhost:${port}`;
const adminDigits = "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const out = new URL("../e2e/out/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const results = [];
const record = (name, ok) => results.push([name, ok]);

if (!process.env.DATABASE_URL) rmSync(new URL("../.data", import.meta.url).pathname, { recursive: true, force: true });

async function startServer(label, extra) {
  const log = openSync(`${out}server-${label}.log`, "w");
  const child = spawn("npx", ["next", "dev", "-p", port], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, ADMIN_PHONES: `+91${adminDigits}`, ADMIN_PHONE: adminDigits, AUTH_SECRET: process.env.AUTH_SECRET ?? "test-secret-test-secret-1234", ...extra },
  });
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base)).status < 500) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopServer(child);
  throw new Error(`the dev server did not start (see ${out}server-${label}.log). Is another one already running in this folder?`);
}
function stopServer(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
}
const run = (name, args, env = {}) => {
  console.log(`\n=== ${name}`);
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ADMIN_PHONE: adminDigits, ...env } });
  record(name, r.status === 0);
};

let server;
try {
  record("net: private-address rules", spawnSync(process.execPath, ["scripts/check-net.mjs"], { stdio: "inherit" }).status === 0);

  server = await startServer("main", { WEBHOOK_ALLOW_PRIVATE: "1" });
  for (const s of ["qr", "auth", "codes", "reviews", "engage", "ops", "platform"]) run(`api: ${s}`, [`scripts/check-${s}.mjs`, base]);
  if (!process.env.SKIP_E2E) run("browser: all phases", ["e2e/run.mjs", base]);
  stopServer(server);
  await new Promise((r) => setTimeout(r, 2500));

  // production never delivers webhooks to local or internal addresses: check that it refuses them
  server = await startServer("production-like", {});
  run("api: platform (private addresses refused)", ["scripts/check-platform.mjs", base]);
} catch (e) {
  console.error(String(e.message ?? e));
  record("setup", false);
} finally {
  if (server) stopServer(server);
}

console.log("\n" + results.map(([n, ok]) => `${ok ? "PASS" : "FAIL"}  ${n}`).join("\n"));
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
