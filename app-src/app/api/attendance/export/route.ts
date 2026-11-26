import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { monthSummary } from "@/lib/attendance";
import { csvRow } from "@/lib/csv";
import { istDay } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** One row per worker for a month: the figures a payroll sheet starts from. This is not a payroll calculation. */
export async function GET(req: Request) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  const m = new URL(req.url).searchParams.get("month") ?? istDay().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return NextResponse.json({ error: "invalid", fields: { month: "Use YYYY-MM." } }, { status: 422 });
  const rows = await monthSummary(a.ws.id, m);
  const out = [csvRow(["ID", "Name", "Type", "Role", "Days present", "Late days", "Hours worked", "Overtime hours"]), ...rows.map((r) => csvRow([r.code, r.name, r.kind, r.role, r.days, r.late_days, r.hours.toFixed(2), r.overtime.toFixed(2)]))].join("\n");
  return new NextResponse(out + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendance-${m}.csv"`, "cache-control": "no-store" } });
}
