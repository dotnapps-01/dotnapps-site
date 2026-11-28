import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { updateWorker } from "@/lib/attendance";
import { parseWorker } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** Edit a worker, or switch them off (active: false). Their attendance history stays. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseWorker(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateWorker(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}
