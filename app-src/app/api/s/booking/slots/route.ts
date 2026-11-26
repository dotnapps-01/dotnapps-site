import { NextResponse } from "next/server";
import { availableSlots, getHours, getItem } from "@/lib/bookings";
import { getEngageQr } from "@/lib/engage-public";
import { validDay } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** Free times for one day of a bookable service: GET ?code=<qr code>&date=YYYY-MM-DD. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const day = validDay(u.searchParams.get("date"));
  if (!day) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const qr = await getEngageQr((u.searchParams.get("code") ?? "").toLowerCase(), "booking");
  if (!qr || !qr.active) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const item = await getItem(qr.workspaceId, qr.config.itemId ?? "");
  if (!item || item.kind !== "service" || !item.durationMin) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const slots = await availableSlots({ id: item.id, staff: item.staff, durationMin: item.durationMin }, await getHours(qr.workspaceId), day);
  return NextResponse.json({ ok: true, date: day, slots }, { headers: { "cache-control": "no-store" } });
}
