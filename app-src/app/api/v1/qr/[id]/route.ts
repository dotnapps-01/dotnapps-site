import { NextResponse } from "next/server";
import { qrJson } from "@/lib/api-v1";
import { apiError, withApiKey } from "@/lib/api-keys";
import { getQrCode } from "@/lib/qr-repo";
import { getShortLinkBase } from "@/lib/short-link";

export const dynamic = "force-dynamic";

/** GET /v1/qr/{id}: one QR code. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiKey(req, "read", async ({ ws }) => {
    const q = /^[0-9a-f-]{36}$/i.test((await params).id) ? await getQrCode(ws.id, (await params).id) : null;
    if (!q || q.status === "archived") return apiError(404, "not_found", "No QR code with that id.");
    const { base } = await getShortLinkBase();
    return NextResponse.json({ data: qrJson(q, base) });
  });
}
