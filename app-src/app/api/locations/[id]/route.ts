import { authedJson, conflict, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { makePrimary, parseLocation, removeLocation, updateLocation } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Rename or re-address a location, or make it the primary one ({ primary: true }). */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const id = (await params).id;
  if (a.body.primary === true) {
    if (!(await makePrimary(a.ws.id, id))) return notFound();
    await auditAs(a.ws.id, "location.primary", id.slice(0, 8));
    return ok();
  }
  const p = parseLocation(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateLocation(a.ws.id, id, p.value)) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  const r = await removeLocation(a.ws.id, (await params).id);
  if (r === "ok") {
    await auditAs(a.ws.id, "location.removed");
    return ok();
  }
  return r === "primary" ? conflict("primary") : notFound();
}
