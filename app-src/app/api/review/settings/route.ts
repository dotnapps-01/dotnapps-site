import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { saveReviewSettings } from "@/lib/reviews";
import { parseReviewSettings } from "@/lib/review-settings";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = parseReviewSettings(body);
  if (!parsed.ok) return NextResponse.json({ error: "invalid", fields: parsed.fields }, { status: 422 });
  await saveReviewSettings(ws.id, parsed.value);
  return NextResponse.json({ ok: true });
}
