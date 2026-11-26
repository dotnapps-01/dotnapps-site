import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { monthSummary } from "@/lib/attendance";
import { istDay } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a name must never run as a spreadsheet formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per worker for a month: the figures a payroll sheet starts from. This is not a payroll calculation. */
export async function GET(req: Request) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  const m = new URL(req.url).searchParams.get("month") ?? istDay().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return NextResponse.json({ error: "invalid", fields: { month: "Use YYYY-MM." } }, { status: 422 });
  const rows = await monthSummary(a.ws.id, m);
  const out = ["ID,Name,Type,Role,Days present,Late days,Hours worked,Overtime hours", ...rows.map((r) => [r.code, r.name, r.kind, r.role, r.days, r.late_days, r.hours.toFixed(2), r.overtime.toFixed(2)].map(cell).join(","))].join("\n");
  return new NextResponse(out + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendance-${m}.csv"`, "cache-control": "no-store" } });
}
