import { NextResponse } from "next/server";
import { getEngageQr } from "@/lib/engage-public";
import { ASSET_PROBLEMS, PROBLEM_CHIPS, parsePublicTicket } from "@/lib/ops-input";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";
import { assetForQr, createTicket } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** A customer raises a ticket from a Feedback → ticket code or an Asset service code. Public: validated, throttled, honeypot. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase());
  if (!qr || (qr.type !== "ticket" && qr.type !== "asset")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });

  const asset = qr.type === "asset" ? await assetForQr(qr.workspaceId, qr.config.assetId ?? "") : null;
  if (qr.type === "asset" && !asset) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const p = parsePublicTicket(b, qr.type === "asset" ? ASSET_PROBLEMS : PROBLEM_CHIPS);
  if (!p.ok) return NextResponse.json({ error: "invalid", fields: p.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "ticket", 8))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const v = p.value;
  const title = asset ? `${asset.name} · ${v.problem || v.details.slice(0, 60)}` : v.problem && v.details ? `${v.problem}: ${v.details.slice(0, 70)}` : v.problem || v.details.slice(0, 80);
  const t = await createTicket(qr.workspaceId, {
    title,
    category: asset ? "Asset" : qr.config.category || "Feedback",
    priority: "normal",
    place: asset ? [asset.code, asset.place].filter(Boolean).join(" · ") : qr.config.place ?? "",
    details: v.details,
    customerName: v.name,
    customerPhone: v.phone,
    assignee: "",
    source: asset ? "asset_qr" : "feedback_qr",
    qrId: qr.id,
    assetId: asset?.id ?? null,
    visitor,
  });
  return NextResponse.json({ ok: true, seq: t.seq, token: t.token }, { status: 201 });
}
