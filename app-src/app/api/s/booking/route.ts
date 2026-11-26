import { NextResponse } from "next/server";
import { bookService, getItem, registerEvent } from "@/lib/bookings";
import { getEngageQr } from "@/lib/engage-public";
import { parseBookingRequest } from "@/lib/ops-input";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A customer books a service slot, or registers for an event. Slots and seats are taken under a lock, so nothing is double-booked. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "booking");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const item = await getItem(qr.workspaceId, qr.config.itemId ?? "");
  if (!item) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseBookingRequest(b, item.kind);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "booking", 8))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const args = { workspaceId: qr.workspaceId, qrId: qr.id, itemId: item.id, req: p.value, visitor };
  const r = item.kind === "event" ? await registerEvent(args) : await bookService(args);
  if (r.ok) return NextResponse.json({ ok: true, ...r.booking }, { status: 201 });
  return NextResponse.json({ error: r.reason, left: r.left }, { status: r.reason === "taken" || r.reason === "sold_out" ? 409 : r.reason === "past" ? 422 : 409 });
}
