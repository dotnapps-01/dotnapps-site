import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parsePlot } from "@/lib/ops-input";
import { updatePlot } from "@/lib/realestate";

export const dynamic = "force-dynamic";

/** Edit a plot's details or change its status (available, on hold, booked, sold). */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "work");
  if ("error" in a) return a.error;
  const p = parsePlot(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updatePlot(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}
