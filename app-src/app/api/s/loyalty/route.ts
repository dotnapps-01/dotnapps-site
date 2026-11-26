import { NextResponse } from "next/server";
import { addStamp, getProgram, joinCard, viewCard } from "@/lib/engage";
import { normPhone } from "@/lib/engage-input";
import { getEngageQr } from "@/lib/engage-public";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** Loyalty card actions from the customer page: join, view, or (with the staff PIN) add a stamp. */
export async function POST(req: Request) {
  let b: { code?: unknown; action?: unknown; phone?: unknown; name?: unknown; pin?: unknown; optIn?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "loyalty");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const program = await getProgram(qr.workspaceId);
  if (!program?.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const phone = normPhone(String(b.phone ?? ""));
  if (!phone) return NextResponse.json({ error: "invalid", fields: { phone: "Enter a valid WhatsApp number." } }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);

  if (b.action === "join") {
    if (!(await allow(visitor, "join", 10))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    const card = await joinCard({ workspaceId: qr.workspaceId, qrId: qr.id, phone, name: String(b.name ?? "").trim().slice(0, 80), optIn: b.optIn === true });
    return NextResponse.json({ ok: true, card });
  }
  if (b.action === "view") {
    if (!(await allow(visitor, "view", 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    const card = await viewCard(qr.workspaceId, phone);
    return card ? NextResponse.json({ ok: true, card }) : NextResponse.json({ error: "no_card" }, { status: 404 });
  }
  if (b.action === "stamp") {
    if (!(await allow(visitor, "stamp", 30))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    const r = await addStamp({ workspaceId: qr.workspaceId, phone, pin: String(b.pin ?? ""), qrId: qr.id });
    if (r.ok) return NextResponse.json({ ok: true, card: r.card, rewardEarned: r.rewardEarned });
    const status = r.reason === "locked" ? 429 : r.reason === "bad_pin" ? 401 : r.reason === "no_card" ? 404 : 409;
    return NextResponse.json({ error: r.reason, ...(r.attemptsLeft !== undefined ? { attemptsLeft: r.attemptsLeft } : {}), ...(r.card ? { card: r.card } : {}) }, { status });
  }
  return NextResponse.json({ error: "invalid" }, { status: 422 });
}
