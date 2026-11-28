import { authedJson, conflict, invalid, ok } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { addLocation, parseLocation } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "settings");
  if ("error" in a) return a.error;
  const p = parseLocation(a.body);
  if (!p.ok) return invalid(p.fields);
  const r = await addLocation(a.ws.id, p.value);
  if (!r.ok) return conflict("limit");
  await auditAs(a.ws.id, "location.added", p.value.name);
  return ok({ id: r.id }, 201);
}
