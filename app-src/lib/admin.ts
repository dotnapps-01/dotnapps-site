import "server-only";
import { query } from "@/lib/db";
import { PLAN_ORDER } from "@/lib/plans";
import { istDay, istInstant } from "@/lib/ops-input";
import type { Plan } from "@/lib/workspace";

export type Health = "healthy" | "low" | "risk" | "new";
export type TenantRecord = { id: string; name: string; phone: string; industry: string; plan: Plan; suspended: boolean; onboarded: boolean; locations: number; scans30: number; health: Health; createdAt: string };
export const TENANT_FILTERS = [
  { key: "all", label: "ALL" },
  { key: "free", label: "FREE" },
  { key: "paid", label: "PAID" },
  { key: "suspended", label: "SUSPENDED" },
] as const;
export type TenantFilter = (typeof TENANT_FILTERS)[number]["key"];

const healthOf = (scans30: number, createdAt: Date): Health => (scans30 >= 20 ? "healthy" : scans30 > 0 ? "low" : Date.now() - createdAt.getTime() > 14 * 86_400_000 ? "risk" : "new");

export async function listTenants(opts: { q?: string; filter?: TenantFilter; limit?: number } = {}): Promise<TenantRecord[]> {
  const where = ["true"];
  const params: unknown[] = [];
  const q = (opts.q ?? "").trim().slice(0, 60);
  if (q) {
    params.push(`%${q.replace(/[%_]/g, "")}%`);
    where.push(`(w.name ilike $${params.length} or u.phone ilike $${params.length} or w.gstin ilike $${params.length})`);
  }
  if (opts.filter === "free") where.push("w.plan = 'free'");
  if (opts.filter === "paid") where.push("w.plan <> 'free'");
  if (opts.filter === "suspended") where.push("w.suspended");
  params.push(opts.limit ?? 100);
  const rows = await query<{ id: string; name: string; phone: string; industry: string; plan: Plan; suspended: boolean; onboarded: boolean; locations: number; scans30: number; created_at: Date }>(
    `select w.id, w.name, u.phone, w.industry, w.plan, w.suspended, w.onboarded, w.created_at,
            (select count(*)::int from locations l where l.workspace_id = w.id) as locations,
            (select count(*)::int from scans s where s.workspace_id = w.id and s.scanned_at > now() - interval '30 days') as scans30
       from workspaces w join users u on u.id = w.owner_id
      where ${where.join(" and ")} order by w.created_at desc limit $${params.length}`,
    params,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, industry: r.industry, plan: r.plan, suspended: r.suspended, onboarded: r.onboarded, locations: r.locations, scans30: r.scans30, health: healthOf(r.scans30, r.created_at), createdAt: r.created_at.toISOString() }));
}

export type AdminStats = { tenants: number; new30: number; active30: number; scansToday: number; suspended: number; mix: { plan: Plan; n: number }[] };
export async function adminStats(): Promise<AdminStats> {
  const [r] = await query<{ tenants: number; new30: number; active30: number; today: number; suspended: number }>(
    `select (select count(*)::int from workspaces) as tenants,
            (select count(*)::int from workspaces where created_at > now() - interval '30 days') as new30,
            (select count(distinct workspace_id)::int from scans where scanned_at > now() - interval '30 days') as active30,
            (select count(*)::int from scans where scanned_at >= $1) as today,
            (select count(*)::int from workspaces where suspended) as suspended`,
    [istInstant(istDay(), 0)],
  );
  const mix = await query<{ plan: Plan; n: number }>("select plan, count(*)::int as n from workspaces group by plan");
  return { tenants: r.tenants, new30: r.new30, active30: r.active30, scansToday: r.today, suspended: r.suspended, mix: PLAN_ORDER.map((p) => ({ plan: p, n: mix.find((m) => m.plan === p)?.n ?? 0 })) };
}

export async function setTenantPlan(id: string, plan: Plan): Promise<{ from: Plan; name: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [old] = await query<{ plan: Plan; name: string }>("select plan, name from workspaces where id = $1", [id]);
  if (!old) return null;
  await query("update workspaces set plan = $2 where id = $1", [id, plan]);
  return { from: old.plan, name: old.name };
}

export async function setTenantSuspended(id: string, suspended: boolean): Promise<{ name: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<{ name: string }>("update workspaces set suspended = $2 where id = $1 returning name", [id, suspended]);
  return rows[0] ?? null;
}

export async function tenantOwnerPhone(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await query<{ phone: string }>("select u.phone from workspaces w join users u on u.id = w.owner_id where w.id = $1", [id]);
  return r?.phone ?? null;
}

export type HealthLine = { label: string; value: string; tone: "ok" | "warn" | "bad" };
/** What the platform can honestly measure about itself from here. */
export async function systemHealth(): Promise<HealthLine[]> {
  const t0 = Date.now();
  await query("select 1");
  const dbMs = Date.now() - t0;
  const [r] = await query<{ scans_hr: number; d_ok: number; d_all: number; keys: number; hooks: number; codes: number }>(
    `select (select count(*)::int from scans where scanned_at > now() - interval '1 hour') as scans_hr,
            (select count(*) filter (where ok)::int from webhook_deliveries where at > now() - interval '24 hours') as d_ok,
            (select count(*)::int from webhook_deliveries where at > now() - interval '24 hours') as d_all,
            (select count(*)::int from api_keys where revoked_at is null) as keys,
            (select count(*)::int from webhook_endpoints where active) as hooks,
            (select count(*)::int from product_codes) as codes`,
  );
  const pct = r.d_all ? Math.round((r.d_ok / r.d_all) * 1000) / 10 : null;
  const prod = process.env.NODE_ENV === "production";
  return [
    { label: "Database round trip", value: `${dbMs} ms`, tone: dbMs < 100 ? "ok" : dbMs < 400 ? "warn" : "bad" },
    { label: "Scans in the last hour", value: String(r.scans_hr), tone: "ok" },
    { label: "Webhook deliveries (24 h)", value: pct === null ? "none sent" : `${pct}% delivered of ${r.d_all}`, tone: pct === null || pct >= 95 ? "ok" : pct >= 80 ? "warn" : "bad" },
    { label: "Active API keys · webhook endpoints", value: `${r.keys} · ${r.hooks}`, tone: "ok" },
    { label: "Serialized product codes", value: r.codes.toLocaleString("en-IN"), tone: "ok" },
    { label: "Sign-in codes (OTP)", value: process.env.AUTH_OTP_PROVIDER === "whatsapp" ? "WhatsApp" : prod ? "not configured" : "development mode", tone: process.env.AUTH_OTP_PROVIDER === "whatsapp" || !prod ? "ok" : "bad" },
    { label: "Short links", value: process.env.SHORT_LINK_BASE ? process.env.SHORT_LINK_BASE.replace(/^https?:\/\//, "") : "this app's /q path", tone: "ok" },
  ];
}
