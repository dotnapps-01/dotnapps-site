import { NextResponse } from "next/server";
import { qrJson } from "@/lib/api-v1";
import { apiError, withApiKey } from "@/lib/api-keys";
import { auditAsApi } from "@/lib/audit-api";
import { createQrCode, listQrCodes } from "@/lib/qr-repo";
import { dynamicLimit, parseQrInput } from "@/lib/qr-types";
import { getShortLinkBase } from "@/lib/short-link";

export const dynamic = "force-dynamic";

/** GET /v1/qr: your QR codes, newest first (up to 500). */
export async function GET(req: Request) {
  return withApiKey(req, "read", async ({ ws }) => {
    const { base } = await getShortLinkBase();
    const codes = (await listQrCodes(ws.id)).filter((c) => c.status !== "archived").slice(0, 500);
    return NextResponse.json({ data: codes.map((c) => qrJson(c, base)) });
  });
}

/** POST /v1/qr: create a QR code. Same fields as the app: { name, type, config, dynamic?, publish? }. */
export async function POST(req: Request) {
  return withApiKey(req, "write", async ({ ws, keyId }) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "invalid_json", "The body must be JSON.");
    }
    const publish = body.publish === true;
    const parsed = parseQrInput(body, publish);
    if (!parsed.ok) return apiError(422, "invalid", "Some fields are not valid.", { fields: parsed.fields });
    const r = await createQrCode(ws, parsed.value, publish);
    if (!r.ok) {
      if (r.error === "plan_limit") return apiError(403, "plan_limit", `Your plan allows ${dynamicLimit[ws.plan]} dynamic codes.`);
      if (r.error === "slug_taken") return apiError(409, "slug_taken", "That short code is taken.");
      return apiError(422, r.error, "A referenced item doesn't exist.", { fields: r.fields ?? {} });
    }
    await auditAsApi(ws.id, keyId, "api.qr_created", parsed.value.name);
    const { base } = await getShortLinkBase();
    return NextResponse.json({ data: { id: r.id, status: r.status, short_code: r.shortCode, short_url: r.shortCode ? `${base}/${r.shortCode}` : null } }, { status: 201 });
  });
}
