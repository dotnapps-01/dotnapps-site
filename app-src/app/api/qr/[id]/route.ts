import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { getQrCode, updateQrCode } from "@/lib/qr-repo";
import { parseQrInput } from "@/lib/qr-types";

export const dynamic = "force-dynamic";

/** Edit a QR code. Type, dynamic/static and short code are fixed once created. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const existing = await getQrCode(ws.id, id);
  if (!existing || existing.status === "archived") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const publish = typeof body.publish === "boolean" ? body.publish : undefined;
  const parsed = parseQrInput(
    { ...body, type: existing.type, dynamic: existing.dynamic, shortCode: existing.shortCode },
    publish === true || existing.status !== "draft",
  );
  if (!parsed.ok) return NextResponse.json({ error: "invalid", fields: parsed.fields }, { status: 422 });

  const r = await updateQrCode(ws, id, parsed.value, publish);
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.fields ? { fields: r.fields } : {}) }, { status: r.error === "not_found" ? 404 : 422 });
  return NextResponse.json({ ok: true, id: r.id, shortCode: r.shortCode, status: r.status });
}
