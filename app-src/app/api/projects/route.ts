import { authedJson, invalid, ok } from "@/lib/api-auth";
import { parseProject } from "@/lib/ops-input";
import { createProject } from "@/lib/realestate";

export const dynamic = "force-dynamic";

/** A project with N numbered plots, ready to edit or import over. */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseProject(a.body, true);
  if (!p.ok) return invalid(p.fields);
  return ok({ id: await createProject(a.ws.id, p.value) }, 201);
}
