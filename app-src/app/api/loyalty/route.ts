import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { getProgram, saveProgram } from "@/lib/engage";
import { parseLoyalty } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

/** Save the loyalty programme. The 4-digit staff PIN is required the first time and is never returned. */
export async function PUT(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const existing = await getProgram(a.ws.id);
  const p = parseLoyalty(a.body, !existing?.hasPin);
  if (!p.ok) return invalid(p.fields);
  await saveProgram(a.ws.id, p.value);
  return NextResponse.json({ ok: true });
}
