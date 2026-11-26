import { NextResponse } from "next/server";
import { getEngageQr } from "@/lib/engage-public";
import { parseEnquiry } from "@/lib/ops-input";
import { createEnquiry } from "@/lib/realestate";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A buyer asks about a plot (price, a site visit, the brochure). It lands in Leads and in the plot's enquiry list. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "plot");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseEnquiry(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "plot", 6))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const done = await createEnquiry({ workspaceId: qr.workspaceId, plotId: qr.config.plotId ?? "", qrId: qr.id, input: p.value, visitor });
  return done ? NextResponse.json({ ok: true }, { status: 201 }) : NextResponse.json({ error: "unavailable" }, { status: 409 });
}
