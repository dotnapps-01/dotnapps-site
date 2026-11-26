import { NextResponse } from "next/server";
import { apiError, withApiKey } from "@/lib/api-keys";
import { lookupSerial } from "@/lib/products";

export const dynamic = "force-dynamic";

/** GET /v1/codes/{serial}: scans, activation, warranty and whether a serialized product code has been flagged. */
export async function GET(req: Request, { params }: { params: Promise<{ serial: string }> }) {
  return withApiKey(req, "read", async ({ ws }) => {
    const serial = (await params).serial;
    if (!/^[A-Za-z0-9-]{4,40}$/.test(serial)) return apiError(404, "not_found", "No product code with that serial.");
    const r = await lookupSerial(ws.id, serial);
    return r ? NextResponse.json({ data: r }) : apiError(404, "not_found", "No product code with that serial.");
  });
}
