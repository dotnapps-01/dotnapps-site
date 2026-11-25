import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { waDigits } from "@/lib/qr-types";
import { createFeedback } from "@/lib/reviews";
import { ISSUE_KEYS } from "@/lib/review-i18n";
import { visitorHash } from "@/lib/scan";

export const dynamic = "force-dynamic";

/** Private feedback, an extra channel next to Google (never a replacement for it). */
export async function POST(req: Request) {
  let b: { id?: unknown; message?: unknown; phone?: unknown; chips?: unknown; website?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot

  const id = String(b.id ?? "");
  const message = String(b.message ?? "").trim().slice(0, 1000);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid" }, { status: 422 });
  if (message.length < 3) return NextResponse.json({ error: "invalid", fields: { message: "Tell us a little more." } }, { status: 422 });

  const phoneIn = String(b.phone ?? "").trim();
  const digits = phoneIn ? waDigits(phoneIn) : "";
  if (phoneIn && !digits) return NextResponse.json({ error: "invalid", fields: { phone: "That number doesn't look right." } }, { status: 422 });
  const chips = (Array.isArray(b.chips) ? b.chips : []).map(String).filter((c) => (ISSUE_KEYS as readonly string[]).includes(c)).slice(0, 6);

  const [row] = await query<{ qr_id: string | null }>("select qr_id from review_responses where id = $1", [id]);
  if (!row?.qr_id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const visitor = await visitorHash(req.headers, row.qr_id);

  const r = await createFeedback({ responseId: id, visitor, message, phone: digits ? `+${digits}` : "", chips });
  if (r === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, duplicate: r === "duplicate" }, { status: r === "ok" ? 201 : 200 });
}
