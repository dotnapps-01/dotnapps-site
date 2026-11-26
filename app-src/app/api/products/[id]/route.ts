import { authedJson, invalid, notFound, ok, planRequired, type Ctx } from "@/lib/api-auth";
import { canUse } from "@/lib/plans";
import { parseProduct } from "@/lib/product-input";
import { retireProduct, updateProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  const p = parseProduct(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateProduct(a.ws.id, (await params).id, p.value)) ? ok() : notFound();
}

/** Hides the product. Codes already printed keep working. */
export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  return (await retireProduct(a.ws.id, (await params).id)) ? ok() : notFound();
}
