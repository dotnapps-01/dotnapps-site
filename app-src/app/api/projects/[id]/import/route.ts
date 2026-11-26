import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { parsePlotRows } from "@/lib/ops-input";
import { importPlots } from "@/lib/realestate";

export const dynamic = "force-dynamic";
const MAX_ROWS = 600;

/** Plots from a CSV (parsed in the browser): number, size, dims, facing, price, approval, corner, status. Existing plot numbers are updated. */
export async function POST(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const rows = Array.isArray(a.body.rows) ? (a.body.rows as Record<string, string>[]).slice(0, MAX_ROWS) : [];
  if (rows.length === 0) return invalid({ rows: "The file has no rows." });
  const parsed = parsePlotRows(rows.map((r) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [String(k).trim().toLowerCase(), String(v ?? "").trim()]))));
  if (parsed.ok.length === 0) return invalid({ rows: `No valid rows. ${parsed.skipped[0]?.reason ?? ""}`.trim() });
  const r = await importPlots(a.ws.id, (await params).id, parsed.ok);
  return r ? ok({ ...r, skipped: parsed.skipped.slice(0, 20), skippedCount: parsed.skipped.length }) : notFound();
}
