import { adminJson } from "@/lib/admin-api";
import { setTenantPlan, setTenantSuspended } from "@/lib/admin";
import { invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { isPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Change a tenant's plan, or suspend / resume them. Every change is written to that tenant's audit log. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await adminJson(req);
  if ("error" in a) return a.error;
  const id = (await params).id;
  const who = `Skanor admin ${a.actor.real}`;
  if (a.body.plan !== undefined) {
    if (!isPlan(a.body.plan)) return invalid({ plan: "Unknown plan." });
    const r = await setTenantPlan(id, a.body.plan);
    if (!r) return notFound();
    await audit(id, who, "plan.changed", `${r.from} → ${a.body.plan}`);
  }
  if (typeof a.body.suspended === "boolean") {
    const r = await setTenantSuspended(id, a.body.suspended);
    if (!r) return notFound();
    await audit(id, who, a.body.suspended ? "account.suspended" : "account.resumed");
  }
  return ok();
}
