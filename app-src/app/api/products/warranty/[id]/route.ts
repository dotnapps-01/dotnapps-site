import { authedJson, invalid, notFound, ok, planRequired, type Ctx } from "@/lib/api-auth";
import { canUse } from "@/lib/plans";
import { setWarrantyStatus } from "@/lib/products";

export const dynamic = "force-dynamic";

/** Verify or reject a warranty registration that was held for review. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  if (a.body.status !== "verified" && a.body.status !== "rejected") return invalid({ status: "Choose verified or rejected." });
  return (await setWarrantyStatus(a.ws.id, (await params).id, a.body.status)) ? ok() : notFound();
}
