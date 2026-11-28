import { authedJson, conflict, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { setBookingStatus } from "@/lib/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/ops-input";

export const dynamic = "force-dynamic";

/** Confirm, complete, mark no-show, or cancel a booking. Only sensible moves are allowed. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "work");
  if ("error" in a) return a.error;
  const status = a.body.status as BookingStatus;
  if (!BOOKING_STATUSES.some((s) => s.key === status)) return invalid({ status: "Unknown status." });
  const r = await setBookingStatus(a.ws.id, (await params).id, status);
  return r === "ok" ? ok() : r === "bad_state" ? conflict("bad_state") : notFound();
}
