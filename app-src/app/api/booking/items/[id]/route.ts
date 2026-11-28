import { authedJson, deleted, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { getItem, retireItem, updateEvent, updateService } from "@/lib/bookings";
import { parseEvent, parseService } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const id = (await params).id;
  const item = await getItem(a.ws.id, id);
  if (!item) return notFound();
  if (item.kind === "event") {
    const p = parseEvent(a.body);
    if (!p.ok) return invalid(p.fields);
    const r = await updateEvent(a.ws.id, id, p.value);
    return r === "ok" ? ok() : r === "below_booked" ? invalid({ capacity: "More tickets than this are already booked." }) : notFound();
  }
  const p = parseService(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateService(a.ws.id, id, p.value)) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build", { body: false });
  if ("error" in a) return a.error;
  return deleted(await retireItem(a.ws.id, (await params).id));
}
