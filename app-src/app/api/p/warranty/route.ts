import { NextResponse } from "next/server";
import { parseWarranty } from "@/lib/product-input";
import { getPublicProduct, registerWarranty } from "@/lib/products";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A buyer registers their warranty from the product page. One per code; a different phone on a registered code raises an alert. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const pp = await getPublicProduct(String(b.token ?? ""));
  if (!pp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pp.suspended) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseWarranty(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, pp.codeId);
  if (!(await allow(visitor, "warranty", 8))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await registerWarranty(pp, p.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, created: r.created, validUntil: r.validUntil, status: r.status }, { status: r.created ? 201 : 200 });
}
