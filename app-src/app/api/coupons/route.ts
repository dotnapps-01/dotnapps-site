import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { createCoupon } from "@/lib/engage";
import { parseCoupon } from "@/lib/engage-input";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const p = parseCoupon(a.body);
  if (!p.ok) return invalid(p.fields);
  return NextResponse.json({ ok: true, id: await createCoupon(a.ws.id, p.value) }, { status: 201 });
}
