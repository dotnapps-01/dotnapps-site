import { NextResponse } from "next/server";
import { authedJson, notFound } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { EXPORTS, exportCsv, type ExportKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Your data as a CSV: contacts, leads, tickets, bookings, ratings or scans. */
export async function GET(req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const a = await authedJson(req, "export", { body: false });
  if ("error" in a) return a.error;
  const key = (await params).dataset as ExportKey;
  if (!EXPORTS.some((e) => e.key === key)) return notFound();
  const csv = await exportCsv(a.ws.id, key);
  await auditAs(a.ws.id, "data.exported", key);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="skanor-${key}.csv"`, "cache-control": "no-store" } });
}
