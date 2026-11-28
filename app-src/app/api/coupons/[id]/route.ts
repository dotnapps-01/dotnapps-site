import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { deleteCoupon, updateCoupon } from "@/lib/engage";
import { parseCoupon } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseCoupon(a.body);
  if (!p.ok) return invalid(p.fields);
  return (await updateCoupon(a.ws.id, (await params).id, p.value)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req, "build", { body: false });
  if ("error" in a) return a.error;
  const r = await deleteCoupon(a.ws.id, (await params).id);
  return r === "not_found" ? NextResponse.json({ error: "not_found" }, { status: 404 }) : r === "in_use" ? NextResponse.json({ error: "in_use" }, { status: 409 }) : NextResponse.json({ ok: true });
}
