import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { deleteForm, updateForm } from "@/lib/engage";
import { parseLeadForm } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const p = parseLeadForm(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateForm(a.ws.id, (await params).id, p.value)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  const r = await deleteForm(a.ws.id, (await params).id);
  return r === "not_found" ? NextResponse.json({ error: "not_found" }, { status: 404 }) : r === "in_use" ? NextResponse.json({ error: "in_use" }, { status: 409 }) : NextResponse.json({ ok: true });
}
