import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { createQrCode } from "@/lib/qr-repo";
import { dynamicLimit, parseQrInput } from "@/lib/qr-types";

export const dynamic = "force-dynamic";

/** Create a QR code. Body: the QR definition plus `publish: boolean` (false saves a draft). */
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const publish = body.publish === true;
  const parsed = parseQrInput(body, publish);
  if (!parsed.ok) return NextResponse.json({ error: "invalid", fields: parsed.fields }, { status: 422 });

  const r = await createQrCode(ws, parsed.value, publish);
  if (!r.ok) {
    if (r.error === "plan_limit") return NextResponse.json({ error: "plan_limit", limit: dynamicLimit[ws.plan] }, { status: 403 });
    if (r.error === "slug_taken") return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    return NextResponse.json({ error: r.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, id: r.id, shortCode: r.shortCode, status: r.status }, { status: 201 });
}
