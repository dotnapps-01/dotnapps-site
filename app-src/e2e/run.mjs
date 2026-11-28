// Runs every browser test in order and prints a summary:  node e2e/run.mjs [baseUrl]
// The server must be running with ADMIN_PHONES (and ADMIN_PHONE exported to match) and WEBHOOK_ALLOW_PRIVATE=1.
import { spawnSync } from "node:child_process";

const base = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const scripts = ["phase3-auth-onboarding", "phase4-qr-analytics", "phase5-reviews", "phase6-engage", "phase7-operate", "phase8-platform", "phase9-files", "phase10-team"];
const only = process.env.ONLY?.split(",");
const results = [];
for (const s of scripts.filter((x) => !only || only.some((o) => x.includes(o)))) {
  console.log(`\n=== ${s}`);
  const r = spawnSync(process.execPath, [new URL(`./${s}.mjs`, import.meta.url).pathname, base], { stdio: "inherit", env: process.env });
  results.push([s, r.status === 0]);
}
console.log("\n" + results.map(([s, ok]) => `${ok ? "PASS" : "FAIL"}  ${s}`).join("\n"));
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
