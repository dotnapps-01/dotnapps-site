import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { markGoogleClicked, updateChips, updateRating } from "@/lib/reviews";
import { visitorHash } from "@/lib/scan";

export const dynamic = "force-dynamic";

/** Follow-ups on a response by the same visitor: they tapped "Post on Google", or picked chips. */
export async function POST(req: Request) {
  let b: { id?: unknown; type?: unknown; chips?: unknown; rating?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const [row] = await query<{ qr_id: string | null }>("select qr_id from review_responses where id = $1", [id]);
  if (!row?.qr_id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const visitor = await visitorHash(req.headers, row.qr_id);

  let ok = false;
  if (b.type === "google") ok = await markGoogleClicked(id, visitor);
  else if (b.type === "rating" && Number.isInteger(Number(b.rating)) && Number(b.rating) >= 1 && Number(b.rating) <= 5) ok = await updateRating(id, visitor, Number(b.rating));
  else if (b.type === "chips" && Array.isArray(b.chips)) {
    const chips = [...new Set(b.chips.map((c) => String(c).trim().slice(0, 24)).filter(Boolean))].slice(0, 6);
    ok = await updateChips(id, visitor, chips);
  } else return NextResponse.json({ error: "invalid" }, { status: 422 });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
