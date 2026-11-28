import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { gateCheckIn, gateLookup } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * The gate scanner for events and arrivals. { code } looks a ticket or booking code up;
 * { code, confirm: true } checks it in (once only).
 */
export async function POST(req: Request) {
  const a = await authedJson(req, "work");
  if ("error" in a) return a.error;
  const code = String(a.body.code ?? "");
  if (a.body.confirm === true) {
    const r = await gateCheckIn(a.ws.id, code);
    if (r.ok) return NextResponse.json({ ok: true, lookup: r.lookup });
    return NextResponse.json({ error: r.reason, lookup: r.lookup }, { status: r.reason === "not_found" ? 404 : 409 });
  }
  const found = await gateLookup(a.ws.id, code);
  return found ? NextResponse.json({ ok: true, lookup: found }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
