import { authedJson, invalid, notFound, ok, planRequired, type Ctx } from "@/lib/api-auth";
import { canUse } from "@/lib/plans";
import { setAlertStatus } from "@/lib/products";

export const dynamic = "force-dynamic";
const STATUSES = ["new", "investigating", "dismissed", "confirmed"] as const;

/** Move a counterfeit alert along: investigating, dismissed (a false alarm) or confirmed (a fake). */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  const status = a.body.status as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) return invalid({ status: "Unknown status." });
  return (await setAlertStatus(a.ws.id, (await params).id, status)) ? ok() : notFound();
}
