import { NextResponse } from "next/server";
import { getVisitorByToken } from "@/lib/attendance";
import { getBookingByToken } from "@/lib/bookings";
import { getTicketByToken } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** The current state of a customer's own link: a ticket (t…), a visitor pass (v…) or a booking (b…). The token is the only key. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const kind = token[0];
  const data = kind === "t" ? await getTicketByToken(token) : kind === "v" ? await getVisitorByToken(token) : kind === "b" ? await getBookingByToken(token) : null;
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, kind, data }, { headers: { "cache-control": "no-store" } });
}
