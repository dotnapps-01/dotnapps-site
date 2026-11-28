import { NextResponse } from "next/server";
import { authedJson } from "@/lib/api-auth";
import { lookupCode, redeemCode } from "@/lib/engage";

export const dynamic = "force-dynamic";

/**
 * Staff redeem a coupon or loyalty-reward code.
 * { code } looks it up; { code, confirm: true } marks it used (atomically, so it can only work once).
 */
export async function POST(req: Request) {
  const a = await authedJson(req, "redeem");
  if ("error" in a) return a.error;
  const code = String(a.body.code ?? "");
  if (a.body.confirm === true) {
    const r = await redeemCode(a.ws.id, code, a.ws.businessName || "staff");
    if (r.ok) return NextResponse.json({ ok: true, lookup: r.lookup });
    return NextResponse.json({ error: r.reason }, { status: r.reason === "not_found" ? 404 : 409 });
  }
  const found = await lookupCode(a.ws.id, code);
  return found ? NextResponse.json({ ok: true, lookup: found }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
