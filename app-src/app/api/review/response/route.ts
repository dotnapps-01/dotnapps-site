import { NextResponse } from "next/server";
import { createResponse, getRatingPage, recentResponsesBy } from "@/lib/reviews";
import { isLang } from "@/lib/review-i18n";
import { visitorHash } from "@/lib/scan";

export const dynamic = "force-dynamic";
const MAX_PER_HOUR = 20;

/** A customer tapped a star. Public endpoint: validated against the code's own settings and rate-limited. */
export async function POST(req: Request) {
  let b: { code?: unknown; rating?: unknown; lang?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const page = await getRatingPage(String(b.code ?? "").toLowerCase());
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (page.state !== "active") return NextResponse.json({ error: "unavailable" }, { status: 409 });

  const visitor = await visitorHash(req.headers, page.qrId);
  if ((await recentResponsesBy(visitor)) >= MAX_PER_HOUR) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const lang = isLang(b.lang) && page.settings.languages.includes(b.lang) ? b.lang : page.settings.languages[0];
  const id = await createResponse({ page, rating, lang, chips: [], visitor });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
