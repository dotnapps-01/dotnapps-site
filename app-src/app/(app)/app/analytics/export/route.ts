import { NextResponse } from "next/server";
import { exportScans, resolveRange } from "@/lib/analytics";
import { currentWorkspace } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** GET /app/analytics/export?range=30d&qr=<id>&location=<id> : scans as CSV (IST timestamps, no IP or user agent). */
export async function GET(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const range = resolveRange(sp.get("range") ?? undefined);
  const rows = await exportScans(ws.id, range, sp.get("qr"), sp.get("location"));
  const csv = ["scanned_at_ist,qr_code,city,device,language", ...rows.map((r) => [r.at, r.qr, r.city, r.device, r.lang].map(cell).join(","))].join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="skanor-scans-${range.key}.csv"`,
      "cache-control": "no-store",
    },
  });
}
