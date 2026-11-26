import { authedJson, deleted, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parseProject } from "@/lib/ops-input";
import { deleteProject, updateProject } from "@/lib/realestate";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseProject(a.body, false);
  if (!p.ok) return invalid(p.fields);
  return (await updateProject(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  return deleted(await deleteProject(a.ws.id, (await params).id));
}
