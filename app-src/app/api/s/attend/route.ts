import { NextResponse } from "next/server";
import { checkIn, getPoint } from "@/lib/attendance";
import { getEngageQr } from "@/lib/engage-public";
import { parseCheckIn } from "@/lib/ops-input";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/**
 * A worker checks in (or out) from the attendance point's QR code.
 * They prove who they are with their ID and the last 4 digits of their number, and (when the point asks) that they are on site.
 * Failed guesses are limited per worker ID and per phone, so the 4 digits can't be brute-forced.
 */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "attend");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const point = await getPoint(qr.workspaceId, qr.config.pointId ?? "");
  if (!point) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parseCheckIn(b);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });

  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "attend", 40)) || !(await allow(`w:${qr.workspaceId}:${p.value.workerCode}`, "attend_try", 10, 15))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const r = await checkIn({ workspaceId: qr.workspaceId, qrId: qr.id, point, code: p.value.workerCode, last4: p.value.last4, lat: p.value.lat, lng: p.value.lng });
  if (r.ok) return NextResponse.json(r);
  // an unknown ID and a wrong number look the same, so the screen can't be used to find valid IDs
  if (r.reason === "no_worker" || r.reason === "bad_phone") return NextResponse.json({ error: "no_match" }, { status: 401 });
  return NextResponse.json({ error: r.reason, at: r.at, distM: r.distM, radiusM: r.radiusM }, { status: r.reason === "done" || r.reason === "too_soon" ? 409 : 403 });
}
