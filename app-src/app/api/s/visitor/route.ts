import { NextResponse } from "next/server";
import { createVisitor } from "@/lib/attendance";
import { getEngageQr } from "@/lib/engage-public";
import { parseVisitor } from "@/lib/ops-input";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A visitor asks for a pass. It stays "awaiting" until the business approves it. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "visitor");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseVisitor(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "visitor", 6))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const token = await createVisitor(qr.workspaceId, qr.id, p.value, visitor);
  return NextResponse.json({ ok: true, token }, { status: 201 });
}
