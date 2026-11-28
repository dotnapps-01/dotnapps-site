import { NextResponse } from "next/server";
import { authedJson, notFound, planRequired, type Ctx } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { canUse } from "@/lib/plans";
import { batchCodes, getBatch } from "@/lib/products";
import { getShortLinkBase } from "@/lib/short-link";

export const dynamic = "force-dynamic";

/** CSV of every serial and the URL to print as its QR code, for a packaging-line printer. */
export async function GET(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "export", { body: false });
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "products")) return planRequired("products");
  const batch = await getBatch(a.ws.id, (await params).id);
  if (!batch) return notFound();
  const { base } = await getShortLinkBase();
  const origin = process.env.SHORT_LINK_BASE?.replace(/\/+$/, "") ?? base.replace(/\/q$/, "");
  const codes = await batchCodes(a.ws.id, batch.id);
  await auditAs(a.ws.id, "batch.exported", `${batch.label}: ${codes.length} codes`);
  const out = ["serial,url", ...codes.map((c) => `${c.serial},${origin}/p/${c.token}`)].join("\n");
  return new NextResponse(out + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${batch.label}-codes.csv"`, "cache-control": "no-store" } });
}
