import { authedJson, deleted, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parseAsset } from "@/lib/ops-input";
import { retireAsset, updateAsset } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseAsset(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateAsset(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  return deleted(await retireAsset(a.ws.id, (await params).id));
}
