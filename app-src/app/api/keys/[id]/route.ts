import { authedJson, notFound, ok, type Ctx } from "@/lib/api-auth";
import { revokeKey } from "@/lib/api-keys";
import { auditAs } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Revokes a key at once. Anything still using it gets 401. */
export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "owner", { body: false });
  if ("error" in a) return a.error;
  const id = (await params).id;
  if (!(await revokeKey(a.ws.id, id))) return notFound();
  await auditAs(a.ws.id, "api_key.revoked", id.slice(0, 8));
  return ok();
}
