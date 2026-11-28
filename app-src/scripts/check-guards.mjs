// Every owner API route must choose a permission. This reads the route files and fails if one doesn't, so a new route
// can't ship open to every role by accident.   npm run check:guards   (no server needed)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../app", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const routes = walk(root).filter((f) => /\/route\.ts$/.test(f)).map((f) => relative(root, f));

// not owner APIs: sign-in, what customers scan and submit, short links, files served by address, the public API (its own keys),
// the admin console (its own check), and sign-up progress (checks the role itself)
const PUBLIC = [/^api\/auth\//, /^api\/s\//, /^api\/p\//, /^api\/o\//, /^api\/review\//, /^api\/demo-request\//, /^api\/v1\//, /^api\/admin\//, /^api\/onboarding\//, /^q\//, /^f\//];

let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const guarded = /authorize\("[a-z]+"\)|authedJson\(req, "[a-z]+"/;
let checked = 0;
for (const r of routes) {
  if (PUBLIC.some((re) => re.test(r))) continue;
  const src = readFileSync(join(root, r), "utf8");
  checked++;
  t(guarded.test(src), `guard: ${r} chooses a permission`);
  t(!/currentWorkspace\(/.test(src), `guard: ${r} doesn't read the workspace without a role check`);
  const methods = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].length;
  const calls = [...src.matchAll(/authorize\("[a-z]+"\)|authedJson\(req, "[a-z]+"/g)].length;
  t(calls >= methods, `guard: ${r} checks in every handler (${calls} checks, ${methods} handlers)`);
}
t(checked >= 55, `guard: found the owner routes (${checked})`);
// the onboarding route is the one owner route that does its own check
const onb = readFileSync(join(root, "api/onboarding/route.ts"), "utf8");
t(/role !== "owner"/.test(onb), "guard: onboarding is owner-only");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
