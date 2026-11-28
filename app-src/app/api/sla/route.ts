import { authedJson, invalid, ok } from "@/lib/api-auth";
import { parseSla } from "@/lib/ops-input";
import { saveSla } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** Hours to resolve a ticket, by priority. Open tickets are re-dated to the new rules. */
export async function PUT(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseSla(a.body);
  if (!p.ok) return invalid(p.fields);
  await saveSla(a.ws.id, p.value);
  return ok();
}
