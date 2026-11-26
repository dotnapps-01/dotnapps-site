import { NextResponse } from "next/server";
import { cancelByToken } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** The customer cancels their own booking from their link. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await cancelByToken((await params).token);
  return r === "ok" ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r }, { status: r === "not_found" ? 404 : 409 });
}
