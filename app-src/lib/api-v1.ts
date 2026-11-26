import "server-only";
import type { QrRecord } from "@/lib/qr-repo";

/** The shape of a QR code in the public API. Internal field names stay internal. */
export function qrJson(q: QrRecord, shortBase: string) {
  return {
    id: q.id,
    name: q.name,
    type: q.type,
    dynamic: q.dynamic,
    status: q.status,
    effective_status: q.effective,
    short_code: q.shortCode,
    short_url: q.shortCode ? `${shortBase}/${q.shortCode}` : null,
    config: q.config,
    scans_30d: q.scans30,
    created_at: q.createdAt,
  };
}
