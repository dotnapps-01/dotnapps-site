import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parseTicketPatch } from "@/lib/ops-input";
import { updateTicket } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** Status, assignee, priority, an internal note, or a reply the customer sees on their ticket page. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseTicketPatch(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateTicket(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}
