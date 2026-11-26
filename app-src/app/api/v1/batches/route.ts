import { NextResponse } from "next/server";
import { apiError, withApiKey } from "@/lib/api-keys";
import { auditAsApi } from "@/lib/audit-api";
import { parseBatch } from "@/lib/product-input";
import { batchCodes, createBatch } from "@/lib/products";
import { getShortLinkBase } from "@/lib/short-link";

export const dynamic = "force-dynamic";

/**
 * POST /v1/batches: generate serialized product codes. Body: { product_id, quantity, prefix, warranty_months?, format? }.
 * The response lists every serial with the URL to print as its QR code.
 */
export async function POST(req: Request) {
  return withApiKey(req, "write", async ({ ws, keyId }) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "invalid_json", "The body must be JSON.");
    }
    const parsed = parseBatch({ productId: body.product_id, quantity: body.quantity, prefix: body.prefix, warrantyMonths: body.warranty_months, format: body.format });
    if (!parsed.ok) return apiError(422, "invalid", "Some fields are not valid.", { fields: parsed.fields });
    const r = await createBatch(ws.id, parsed.value);
    if (!r.ok) return apiError(404, "not_found", "No product with that id.");
    await auditAsApi(ws.id, keyId, "api.batch_created", `${r.batch.label}: ${r.batch.qty} codes`);
    const { base } = await getShortLinkBase();
    const origin = process.env.SHORT_LINK_BASE?.replace(/\/+$/, "") ?? base.replace(/\/q$/, "");
    const codes = await batchCodes(ws.id, r.batch.id);
    return NextResponse.json(
      { data: { id: r.batch.id, label: r.batch.label, quantity: r.batch.qty, first_serial: r.batch.firstSerial, last_serial: r.batch.lastSerial, codes: codes.map((c) => ({ serial: c.serial, url: `${origin}/p/${c.token}` })) } },
      { status: 201 },
    );
  });
}
