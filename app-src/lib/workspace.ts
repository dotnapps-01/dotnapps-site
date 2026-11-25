import "server-only";
import { query, tx } from "@/lib/db";
import { goalOptions, industryOptions, type GoalKey, type IndustryKey } from "./content/onboarding";

export type Plan = "free" | "starter" | "growth" | "business" | "enterprise";

/** The signed-in business: its workspace row plus its primary location. */
export type Workspace = {
  id: string;
  /** owner's phone number (the session subject) */
  sub: string;
  businessName: string;
  industry: IndustryKey | "";
  goals: GoalKey[];
  plan: Plan;
  /** primary location (created in onboarding step 4) */
  locationName: string;
  address: string;
  /** furthest wizard step reached: 0 verify … 4 live */
  step: number;
  onboarded: boolean;
};

type Row = {
  id: string;
  phone: string;
  name: string;
  industry: string;
  goals: string[];
  plan: Plan;
  step: number;
  onboarded: boolean;
  location_name: string | null;
  location_address: string | null;
};

const SELECT = `
  select w.id, u.phone, w.name, w.industry, w.goals, w.plan, w.step, w.onboarded,
         l.name as location_name, l.address as location_address
    from users u
    join workspaces w on w.owner_id = u.id
    left join locations l on l.workspace_id = w.id and l.is_primary`;

const toWorkspace = (r: Row): Workspace => ({
  id: r.id,
  sub: r.phone,
  businessName: r.name,
  industry: r.industry as Workspace["industry"],
  goals: r.goals as GoalKey[],
  plan: r.plan,
  locationName: r.location_name ?? "",
  address: r.location_address ?? "",
  step: r.step,
  onboarded: r.onboarded,
});

export async function getWorkspace(sub: string): Promise<Workspace | null> {
  const [r] = await query<Row>(`${SELECT} where u.phone = $1`, [sub]);
  return r ? toWorkspace(r) : null;
}

/** Finds or creates the user + workspace for a verified phone number. */
export async function ensureWorkspace(sub: string, businessName = ""): Promise<Workspace> {
  await tx(async (q) => {
    const [u] = await q.query<{ id: string }>(
      "insert into users (phone) values ($1) on conflict (phone) do update set phone = excluded.phone returning id",
      [sub],
    );
    await q.query("insert into workspaces (owner_id, name) values ($1, $2) on conflict (owner_id) do nothing", [u.id, businessName]);
    if (businessName) await q.query("update workspaces set name = $2 where owner_id = $1 and name = ''", [u.id, businessName]);
  });
  return (await getWorkspace(sub))!;
}

/** Persists the wizard fields; the primary location is created or updated alongside. */
export async function saveWorkspace(ws: Workspace): Promise<void> {
  await tx(async (q) => {
    await q.query(
      "update workspaces set name = $2, industry = $3, goals = $4, step = $5, onboarded = $6 where id = $1",
      [ws.id, ws.businessName, ws.industry, ws.goals, ws.step, ws.onboarded],
    );
    if (ws.locationName) {
      const updated = await q.query(
        "update locations set name = $2, address = $3 where workspace_id = $1 and is_primary returning id",
        [ws.id, ws.locationName, ws.address],
      );
      if (updated.length === 0) {
        await q.query("insert into locations (workspace_id, name, address, is_primary) values ($1, $2, $3, true)", [
          ws.id,
          ws.locationName,
          ws.address,
        ]);
      }
    }
  });
}

const industryKeys = new Set<string>(industryOptions.map((i) => i.key));
const goalKeys = new Set<string>(goalOptions.map((g) => g.key));

/** Whitelists and trims untrusted onboarding input. */
export function sanitizeWorkspacePatch(input: Record<string, unknown>): Partial<Workspace> {
  const out: Partial<Workspace> = {};
  if (typeof input.industry === "string" && industryKeys.has(input.industry)) out.industry = input.industry as IndustryKey;
  if (Array.isArray(input.goals)) out.goals = [...new Set(input.goals.filter((g): g is GoalKey => typeof g === "string" && goalKeys.has(g)))];
  if (typeof input.locationName === "string") out.locationName = input.locationName.trim().slice(0, 120);
  if (typeof input.address === "string") out.address = input.address.trim().slice(0, 240);
  if (typeof input.step === "number" && Number.isInteger(input.step)) out.step = Math.min(4, Math.max(1, input.step));
  return out;
}
