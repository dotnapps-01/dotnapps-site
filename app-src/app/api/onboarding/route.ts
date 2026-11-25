import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ensureWorkspace, sanitizeWorkspacePatch, saveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** Saves wizard progress. `complete: true` finishes setup (all required fields must be present). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const current = await ensureWorkspace(session.sub);
  const next = { ...current, ...sanitizeWorkspacePatch(body) };

  if (body.complete === true) {
    const fields: Record<string, string> = {};
    if (!next.industry) fields.industry = "Pick your business type.";
    if (next.goals.length === 0) fields.goals = "Pick at least one goal.";
    if (next.locationName.length < 2) fields.locationName = "Enter a location name.";
    if (Object.keys(fields).length) return NextResponse.json({ error: "invalid", fields }, { status: 422 });
    next.onboarded = true;
    next.step = 4;
  }

  await saveWorkspace(next);
  return NextResponse.json({ ok: true, onboarded: next.onboarded });
}
