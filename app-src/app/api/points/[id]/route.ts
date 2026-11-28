import { authedJson, deleted, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { deletePoint, updatePoint } from "@/lib/attendance";
import { parsePoint } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parsePoint(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updatePoint(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build", { body: false });
  if ("error" in a) return a.error;
  return deleted(await deletePoint(a.ws.id, (await params).id));
}
