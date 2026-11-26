import { authedJson, invalid, ok } from "@/lib/api-auth";
import { parseManualTicket } from "@/lib/ops-input";
import { createTicket } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** The owner raises a ticket by hand (a phone call, a walk-in, something they noticed). */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseManualTicket(a.body);
  if (!p.ok) return invalid(p.fields);
  const t = await createTicket(a.ws.id, { ...p.value, source: "manual" });
  return ok({ id: t.id, seq: t.seq }, 201);
}
