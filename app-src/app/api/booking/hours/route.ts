import { authedJson, invalid, ok } from "@/lib/api-auth";
import { saveHours } from "@/lib/bookings";
import { parseHours } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** Weekly opening hours that every service's time slots are built from. */
export async function PUT(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseHours(a.body.hours);
  if (!p.ok) return invalid(p.fields);
  await saveHours(a.ws.id, p.value);
  return ok();
}
