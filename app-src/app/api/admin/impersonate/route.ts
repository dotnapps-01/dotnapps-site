import { adminJson } from "@/lib/admin-api";
import { tenantOwnerPhone } from "@/lib/admin";
import { notFound, ok } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { startImpersonation } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** "Log in as": view a tenant's workspace as its owner would, for 4 hours or until you exit. Recorded in their audit log. */
export async function POST(req: Request) {
  const a = await adminJson(req);
  if ("error" in a) return a.error;
  const id = String(a.body.workspaceId ?? "");
  const phone = await tenantOwnerPhone(id);
  if (!phone) return notFound();
  await startImpersonation(phone, a.actor.real);
  await audit(id, `Skanor admin ${a.actor.real}`, "admin.viewed_as_owner");
  return ok();
}
