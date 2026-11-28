import { authedJson, invalid, ok } from "@/lib/api-auth";
import { parseAsset } from "@/lib/ops-input";
import { createAsset } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseAsset(a.body);
  if (!p.ok) return invalid(p.fields);
  return ok({ id: await createAsset(a.ws.id, p.value) }, 201);
}
