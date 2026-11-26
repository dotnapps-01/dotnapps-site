import { NextResponse } from "next/server";
import { parseReport } from "@/lib/product-input";
import { getPublicProduct, reportSeller } from "@/lib/products";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** "Report this seller": goes to the brand's counterfeit alerts. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true });
  const pp = await getPublicProduct(String(b.token ?? ""));
  if (!pp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pp.suspended) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseReport(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, pp.codeId);
  if (!(await allow(visitor, "report", 3))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  await reportSeller(pp, p.value.note);
  return NextResponse.json({ ok: true }, { status: 201 });
}
