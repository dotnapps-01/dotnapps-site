import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { importContacts } from "@/lib/engage";
import { parseImportRows } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

/** Import contacts from CSV rows already parsed in the browser. Body: { rows: [{ name, phone, email, tags }] } */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const { rows, skipped } = parseImportRows(a.body.rows);
  if (rows.length === 0) return NextResponse.json({ error: "invalid", skipped, message: "No valid rows. Each row needs a valid phone number." }, { status: 422 });
  const r = await importContacts(a.ws.id, rows);
  return NextResponse.json({ ok: true, ...r, skipped });
}
