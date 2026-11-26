import { NextResponse } from "next/server";
import { claimCoupon } from "@/lib/engage";
import { normPhone } from "@/lib/engage-input";
import { getEngageQr } from "@/lib/engage-public";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A customer claims a coupon with their number and gets a one-use code to show at the counter. */
export async function POST(req: Request) {
  let b: { code?: unknown; phone?: unknown; name?: unknown; optIn?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "coupon");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const phone = normPhone(String(b.phone ?? ""));
  if (!phone) return NextResponse.json({ error: "invalid", fields: { phone: "Enter a valid WhatsApp number." } }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "claim", 10))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const r = await claimCoupon({
    workspaceId: qr.workspaceId,
    couponId: qr.config.couponId ?? "",
    qrId: qr.id,
    phone,
    name: String(b.name ?? "").trim().slice(0, 80),
    optIn: b.optIn === true,
    visitor,
  });
  if (r.ok) return NextResponse.json({ ok: true, claim: r.claim }, { status: 201 });
  return NextResponse.json({ error: r.reason, ...(r.claim ? { claim: r.claim } : {}) }, { status: r.reason === "limit_reached" ? 200 : 409 });
}
