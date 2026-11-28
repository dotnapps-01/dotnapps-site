import { authedJson, invalid, ok } from "@/lib/api-auth";
import { createWorker } from "@/lib/attendance";
import { parseWorker } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseWorker(a.body);
  if (!p.ok) return invalid(p.fields);
  const w = await createWorker(a.ws.id, p.value);
  return ok({ id: w.id, code: w.code }, 201);
}
