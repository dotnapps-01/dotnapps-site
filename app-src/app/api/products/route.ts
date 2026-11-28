import { authedJson, invalid, ok, planRequired } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { canUse } from "@/lib/plans";
import { parseProduct } from "@/lib/product-input";
import { createProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  const p = parseProduct(a.body);
  if (!p.ok) return invalid(p.fields);
  const id = await createProduct(a.ws.id, p.value);
  await auditAs(a.ws.id, "product.created", p.value.name);
  return ok({ id }, 201);
}
