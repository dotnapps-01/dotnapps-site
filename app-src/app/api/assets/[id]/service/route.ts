import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parseServiceLog } from "@/lib/ops-input";
import { logService } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** Records a service visit; the asset's last-serviced date and next due date follow. */
export async function POST(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "work");
  if ("error" in a) return a.error;
  const p = parseServiceLog(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await logService(a.ws.id, (await params).id, p.value)) ? ok({}, 201) : notFound();
}
