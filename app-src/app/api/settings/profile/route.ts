import { authedJson, invalid, ok } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { parseProfile, saveProfile } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const a = await authedJson(req, "settings");
  if ("error" in a) return a.error;
  const p = parseProfile(a.body);
  if (!p.ok) return invalid(p.fields);
  await saveProfile(a.ws.id, p.value);
  await auditAs(a.ws.id, "profile.updated", p.value.name);
  return ok();
}
