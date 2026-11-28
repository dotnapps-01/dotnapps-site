import { authedJson, conflict, invalid, ok, planRequired } from "@/lib/api-auth";
import { createKey, isScope } from "@/lib/api-keys";
import { auditAs } from "@/lib/audit";
import { canUse } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Creates an API key. The plain key is in this response and nowhere else, ever. */
export async function POST(req: Request) {
  const a = await authedJson(req, "owner");
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "api")) return planRequired("api");
  const name = String(a.body.name ?? "").trim().slice(0, 60);
  const f: Record<string, string> = {};
  if (name.length < 2) f.name = "Name the key after what uses it, like “Packaging line”.";
  if (!isScope(a.body.scope)) f.scope = "Choose what the key may do.";
  if (Object.keys(f).length) return invalid(f);
  const r = await createKey(a.ws.id, name, a.body.scope as Parameters<typeof createKey>[2]);
  if (!r.ok) return conflict("limit");
  await auditAs(a.ws.id, "api_key.created", `${name} (${a.body.scope})`);
  return ok({ id: r.id, key: r.key }, 201);
}
