import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { createForm } from "@/lib/engage";
import { parseLeadForm } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseLeadForm(a.body);
  if (!p.ok) return invalid(p.fields);
  return NextResponse.json({ ok: true, id: await createForm(a.ws.id, p.value) }, { status: 201 });
}
