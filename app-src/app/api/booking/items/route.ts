import { authedJson, invalid, ok } from "@/lib/api-auth";
import { createEvent, createService } from "@/lib/bookings";
import { parseEvent, parseService } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** Creates a service ({ kind: "service" }) or an event ({ kind: "event" }). */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  if (a.body.kind === "event") {
    const p = parseEvent(a.body);
    if (!p.ok) return invalid(p.fields);
    return ok({ id: await createEvent(a.ws.id, p.value) }, 201);
  }
  const p = parseService(a.body);
  if (!p.ok) return invalid(p.fields);
  return ok({ id: await createService(a.ws.id, p.value) }, 201);
}
