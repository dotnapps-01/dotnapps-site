import { NextResponse } from "next/server";
import { parseServiceRequest } from "@/lib/product-input";
import { getPublicProduct, requestService } from "@/lib/products";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** "Book service" on the product page: raises a ticket for the business. */
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
  if (pp.suspended || !pp.product.serviceEnabled) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseServiceRequest(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, pp.codeId);
  if (!(await allow(visitor, "service", 5))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const t = await requestService(pp, p.value, visitor);
  return NextResponse.json({ ok: true, seq: t.seq, token: t.token }, { status: 201 });
}
