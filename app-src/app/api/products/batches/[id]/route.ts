import { authedJson, notFound, ok, planRequired, type Ctx } from "@/lib/api-auth";
import { canUse } from "@/lib/plans";
import { markInMarket } from "@/lib/products";

export const dynamic = "force-dynamic";

/** Marks a batch as printed and shipped ("in market"). */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build", { body: false });
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  return (await markInMarket(a.ws.id, (await params).id)) ? ok() : notFound();
}
