import { authedJson, invalid, ok } from "@/lib/api-auth";
import { createPoint } from "@/lib/attendance";
import { parsePoint } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parsePoint(a.body);
  if (!p.ok) return invalid(p.fields);
  return ok({ id: await createPoint(a.ws.id, p.value) }, 201);
}
