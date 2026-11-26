import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { STAGES, updateLead, type Stage } from "@/lib/engage";

export const dynamic = "force-dynamic";

/** Move a lead along the pipeline, assign an owner, or add notes. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const patch: { stage?: Stage; owner?: string; notes?: string } = {};
  if (a.body.stage !== undefined) {
    if (!STAGES.some((s) => s.key === a.body.stage)) return NextResponse.json({ error: "invalid" }, { status: 422 });
    patch.stage = a.body.stage as Stage;
  }
  if (typeof a.body.owner === "string") patch.owner = a.body.owner.trim().slice(0, 40);
  if (typeof a.body.notes === "string") patch.notes = a.body.notes.trim().slice(0, 1000);
  return (await updateLead(a.ws.id, (await params).id, patch)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
