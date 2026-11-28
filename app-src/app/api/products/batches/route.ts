import { authedJson, invalid, notFound, ok, planRequired } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { canUse } from "@/lib/plans";
import { parseBatch } from "@/lib/product-input";
import { createBatch } from "@/lib/products";

export const dynamic = "force-dynamic";

/** Generates serialized codes for a product. */
export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  const p = parseBatch(a.body);
  if (!p.ok) return invalid(p.fields);
  const r = await createBatch(a.ws.id, p.value);
  if (!r.ok) return notFound();
  await auditAs(a.ws.id, "batch.created", `${r.batch.label}: ${r.batch.qty} codes for ${r.batch.product}`);
  return ok({ id: r.batch.id, label: r.batch.label, firstSerial: r.batch.firstSerial, lastSerial: r.batch.lastSerial }, 201);
}
