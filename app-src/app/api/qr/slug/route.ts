import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { query } from "@/lib/db";
import { slugError } from "@/lib/qr-types";

export const dynamic = "force-dynamic";

/** GET /api/qr/slug?slug=an-t4 -> { available: boolean, error?: string } */
export async function GET(req: Request) {
  if (!(await currentWorkspace())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim().toLowerCase();
  const err = slugError(slug);
  if (err) return NextResponse.json({ available: false, error: err });
  const taken = await query("select 1 from qr_codes where short_code = $1", [slug]);
  return NextResponse.json({ available: taken.length === 0, ...(taken.length ? { error: "That short link is taken." } : {}) });
}
