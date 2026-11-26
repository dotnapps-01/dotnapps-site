import "server-only";
import { query, tx } from "@/lib/db";
import { upsertContact } from "@/lib/engage";
import { DEFAULT_HOURS, HOLDING, addDays, dayAllowed, istDay, istInstant, istMinutes, slotStarts, type BookingRequest, type BookingStatus, type DayHours, type EventInput, type ServiceInput } from "@/lib/ops-input";
import { newToken, shortCode } from "@/lib/token";

const uuidRe = /^[0-9a-f-]{36}$/i;
const isUuid = (v: string) => uuidRe.test(v);

/* ---------- services and events ---------- */

export type ItemRecord = {
  id: string; kind: "service" | "event"; name: string; description: string; durationMin: number | null; price: number | null; staff: string[]; needsApproval: boolean;
  capacity: number | null; startsAt: string | null; venue: string; active: boolean; inUse: number; booked: number; checkedIn: number;
};
type ItemRow = {
  id: string; kind: "service" | "event"; name: string; description: string; duration_min: number | null; price: string | null; staff: string[]; needs_approval: boolean; capacity: number | null;
  starts_at: Date | null; venue: string; active: boolean; in_use: number; booked: number; checked_in: number;
};
const ITEM_SELECT = `
  select i.id, i.kind, i.name, i.description, i.duration_min, i.price::text as price, i.staff, i.needs_approval, i.capacity, i.starts_at, i.venue, i.active,
         (select count(*)::int from qr_codes q where q.workspace_id = i.workspace_id and q.status <> 'archived' and q.config->>'itemId' = i.id::text) as in_use,
         coalesce((select sum(b.qty)::int from bookings b where b.item_id = i.id and b.status in ('pending','confirmed','completed') and (i.kind = 'event' or b.starts_at >= now())), 0) as booked,
         coalesce((select sum(b.qty)::int from bookings b where b.item_id = i.id and b.checked_in_at is not null), 0) as checked_in
    from booking_items i`;
const toItem = (r: ItemRow): ItemRecord => ({
  id: r.id, kind: r.kind, name: r.name, description: r.description, durationMin: r.duration_min, price: r.price === null ? null : Number(r.price), staff: r.staff, needsApproval: r.needs_approval,
  capacity: r.capacity, startsAt: r.starts_at?.toISOString() ?? null, venue: r.venue, active: r.active, inUse: r.in_use, booked: r.booked, checkedIn: r.checked_in,
});

export async function listItems(workspaceId: string, kind?: "service" | "event"): Promise<ItemRecord[]> {
  const rows = await query<ItemRow>(`${ITEM_SELECT} where i.workspace_id = $1 and i.active ${kind ? "and i.kind = $2" : ""} order by i.kind, coalesce(i.starts_at, i.created_at), i.created_at`, kind ? [workspaceId, kind] : [workspaceId]);
  return rows.map(toItem);
}
export async function getItem(workspaceId: string, id: string): Promise<ItemRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<ItemRow>(`${ITEM_SELECT} where i.id = $1 and i.workspace_id = $2 and i.active`, [id, workspaceId]);
  return r ? toItem(r) : null;
}
export async function createService(workspaceId: string, s: ServiceInput): Promise<string> {
  const [r] = await query<{ id: string }>(
    "insert into booking_items (workspace_id, kind, name, description, duration_min, price, staff, needs_approval, active) values ($1,'service',$2,$3,$4,$5,$6,$7,$8) returning id",
    [workspaceId, s.name, s.description, s.durationMin, s.price, s.staff, s.needsApproval, s.active],
  );
  return r.id;
}
export async function updateService(workspaceId: string, id: string, s: ServiceInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query(
    "update booking_items set name=$3, description=$4, duration_min=$5, price=$6, staff=$7, needs_approval=$8 where id=$1 and workspace_id=$2 and kind='service' and active returning id",
    [id, workspaceId, s.name, s.description, s.durationMin, s.price, s.staff, s.needsApproval],
  );
  return rows.length > 0;
}
export async function createEvent(workspaceId: string, e: EventInput): Promise<string> {
  const [r] = await query<{ id: string }>(
    "insert into booking_items (workspace_id, kind, name, description, price, capacity, starts_at, venue, active) values ($1,'event',$2,$3,$4,$5,$6,$7,$8) returning id",
    [workspaceId, e.name, e.description, e.price, e.capacity, e.startsAt, e.venue, e.active],
  );
  return r.id;
}
export async function updateEvent(workspaceId: string, id: string, e: EventInput): Promise<"ok" | "not_found" | "below_booked"> {
  if (!isUuid(id)) return "not_found";
  return tx(async (q) => {
    const [i] = await q.query<{ id: string }>("select id from booking_items where id = $1 and workspace_id = $2 and kind = 'event' and active for update", [id, workspaceId]);
    if (!i) return "not_found";
    const [b] = await q.query<{ n: number }>("select coalesce(sum(qty),0)::int as n from bookings where item_id = $1 and status in ('pending','confirmed','completed')", [id]);
    if (e.capacity < b.n) return "below_booked";
    await q.query("update booking_items set name=$2, description=$3, price=$4, capacity=$5, starts_at=$6, venue=$7 where id=$1", [id, e.name, e.description, e.price, e.capacity, e.startsAt, e.venue]);
    return "ok";
  });
}
/** Retire a service or event. Refused while a live QR code points at it. Past bookings stay. */
export async function retireItem(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  const it = await getItem(workspaceId, id);
  if (!it) return "not_found";
  if (it.inUse > 0) return "in_use";
  await query("update booking_items set active = false where id = $1", [id]);
  return "ok";
}

/* ---------- opening hours ---------- */

export async function getHours(workspaceId: string): Promise<DayHours[]> {
  const rows = await query<{ dow: number; open_min: number; close_min: number; closed: boolean }>("select dow, open_min, close_min, closed from booking_hours where workspace_id = $1", [workspaceId]);
  return DEFAULT_HOURS.map((d) => {
    const r = rows.find((x) => x.dow === d.dow);
    return r ? { dow: r.dow, open: r.open_min, close: r.close_min, closed: r.closed } : d;
  });
}
export async function saveHours(workspaceId: string, hours: DayHours[]): Promise<void> {
  await tx(async (q) => {
    for (const h of hours) {
      await q.query(
        "insert into booking_hours (workspace_id, dow, open_min, close_min, closed) values ($1,$2,$3,$4,$5) on conflict (workspace_id, dow) do update set open_min = excluded.open_min, close_min = excluded.close_min, closed = excluded.closed",
        [workspaceId, h.dow, h.open, h.close, h.closed],
      );
    }
  });
}

/* ---------- slots ---------- */

export type Slot = { start: number; free: string[] };
type Held = { starts_at: Date; ends_at: Date; staff: string };

const overlaps = (held: Held[], start: Date, end: Date) => held.filter((b) => b.starts_at < end && b.ends_at > start);
/** Which of the service's staff (or "" when it has none) can take this time, given the bookings that already hold time. */
function freeStaff(item: { staff: string[] }, held: Held[], start: Date, end: Date): string[] {
  const o = overlaps(held, start, end);
  if (item.staff.length === 0) return o.length === 0 ? [""] : [];
  const busy = new Set(o.map((b) => b.staff));
  const unassigned = o.filter((b) => b.staff === "").length; // bookings made before staff were listed hold one seat each
  const free = item.staff.filter((s) => !busy.has(s));
  return free.length > unassigned ? free.slice(0, free.length - unassigned) : [];
}

async function heldFor(q: { query: typeof query }, itemId: string, from: Date, to: Date): Promise<Held[]> {
  return q.query<Held>("select starts_at, ends_at, staff from bookings where item_id = $1 and status = any($2::text[]) and starts_at < $4 and ends_at > $3", [itemId, HOLDING, from, to]);
}

export async function availableSlots(item: { id: string; staff: string[]; durationMin: number }, hours: DayHours[], day: string, now = new Date()): Promise<Slot[]> {
  if (!dayAllowed(day, now)) return [];
  const starts = slotStarts(day, hours, item.durationMin, now);
  if (starts.length === 0) return [];
  const held = await heldFor({ query }, item.id, istInstant(day, 0), istInstant(addDays(day, 1), 0));
  return starts
    .map((start) => ({ start, free: freeStaff(item, held, istInstant(day, start), new Date(istInstant(day, start).getTime() + item.durationMin * 60_000)) }))
    .filter((s) => s.free.length > 0);
}

/* ---------- bookings ---------- */

export type BookingRecord = {
  id: string; itemId: string; itemName: string; kind: "service" | "event"; name: string; phone: string; staff: string; startsAt: string; endsAt: string; qty: number;
  status: BookingStatus; code: string; checkedInAt: string | null; price: number | null; token: string;
};
type BookingRow = {
  id: string; item_id: string; item_name: string; kind: "service" | "event"; name: string; phone: string; staff: string; starts_at: Date; ends_at: Date; qty: number; status: BookingStatus;
  code: string; checked_in_at: Date | null; price: string | null; token: string;
};
const BOOKING_SELECT = `
  select b.id, b.item_id, i.name as item_name, i.kind, b.name, b.phone, b.staff, b.starts_at, b.ends_at, b.qty, b.status, b.code, b.checked_in_at, i.price::text as price, b.token
    from bookings b join booking_items i on i.id = b.item_id`;
const toBooking = (r: BookingRow): BookingRecord => ({
  id: r.id, itemId: r.item_id, itemName: r.item_name, kind: r.kind, name: r.name, phone: r.phone, staff: r.staff, startsAt: r.starts_at.toISOString(), endsAt: r.ends_at.toISOString(), qty: r.qty,
  status: r.status, code: r.code, checkedInAt: r.checked_in_at?.toISOString() ?? null, price: r.price === null ? null : Number(r.price), token: r.token,
});

export type MadeBooking = { code: string; token: string; status: BookingStatus; startsAt: string; staff: string };
export type BookResult = { ok: true; booking: MadeBooking } | { ok: false; reason: "unavailable" | "taken" | "past" | "sold_out" | "not_service" | "not_event"; left?: number };

/** Books a service slot. The item row is locked, so two customers choosing the same slot can't both get it. */
export async function bookService(p: { workspaceId: string; qrId: string; itemId: string; req: BookingRequest; visitor: string; now?: Date }): Promise<BookResult> {
  const now = p.now ?? new Date();
  return tx(async (q) => {
    const [it] = await q.query<{ kind: string; duration_min: number | null; staff: string[]; needs_approval: boolean; active: boolean }>(
      "select kind, duration_min, staff, needs_approval, active from booking_items where id = $1 and workspace_id = $2 for update",
      [p.itemId, p.workspaceId],
    );
    if (!it || !it.active) return { ok: false, reason: "unavailable" };
    if (it.kind !== "service" || !it.duration_min) return { ok: false, reason: "not_service" };
    const hours = await (async () => {
      const rows = await q.query<{ dow: number; open_min: number; close_min: number; closed: boolean }>("select dow, open_min, close_min, closed from booking_hours where workspace_id = $1", [p.workspaceId]);
      return DEFAULT_HOURS.map((d) => {
        const r = rows.find((x) => x.dow === d.dow);
        return r ? { dow: r.dow, open: r.open_min, close: r.close_min, closed: r.closed } : d;
      });
    })();
    if (!dayAllowed(p.req.day, now) || !slotStarts(p.req.day, hours, it.duration_min, now).includes(p.req.start)) return { ok: false, reason: "past" };
    const start = istInstant(p.req.day, p.req.start);
    const end = new Date(start.getTime() + it.duration_min * 60_000);
    const held = await heldFor(q, p.itemId, start, end);
    const free = freeStaff(it, held, start, end);
    const staff = p.req.staff ? (free.includes(p.req.staff) ? p.req.staff : null) : (free[0] ?? null);
    if (staff === null || free.length === 0) return { ok: false, reason: "taken" };
    const status: BookingStatus = it.needs_approval ? "pending" : "confirmed";
    const code = shortCode("BK");
    const token = newToken("b");
    await q.query(
      "insert into bookings (workspace_id, item_id, qr_id, name, phone, staff, starts_at, ends_at, qty, status, code, token, visitor) values ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12)",
      [p.workspaceId, p.itemId, p.qrId, p.req.name, p.req.phone, staff, start, end, status, code, token, p.visitor],
    );
    await upsertContact(q, p.workspaceId, { name: p.req.name, phone: p.req.phone, source: "Booking" });
    return { ok: true, booking: { code, token, status, startsAt: start.toISOString(), staff } };
  });
}

/** Registers for an event. Seats are counted under the same lock, so the event can't be oversold. */
export async function registerEvent(p: { workspaceId: string; qrId: string; itemId: string; req: BookingRequest; visitor: string; now?: Date }): Promise<BookResult> {
  const now = p.now ?? new Date();
  return tx(async (q) => {
    const [it] = await q.query<{ kind: string; capacity: number | null; starts_at: Date | null; active: boolean }>("select kind, capacity, starts_at, active from booking_items where id = $1 and workspace_id = $2 for update", [p.itemId, p.workspaceId]);
    if (!it || !it.active) return { ok: false, reason: "unavailable" };
    if (it.kind !== "event" || !it.capacity || !it.starts_at) return { ok: false, reason: "not_event" };
    if (it.starts_at.getTime() < now.getTime() - 6 * 3_600_000) return { ok: false, reason: "past" };
    const [t] = await q.query<{ n: number }>("select coalesce(sum(qty),0)::int as n from bookings where item_id = $1 and status = any($2::text[])", [p.itemId, HOLDING]);
    const left = it.capacity - t.n;
    if (left < p.req.qty) return { ok: false, reason: "sold_out", left: Math.max(0, left) };
    const code = shortCode("EV");
    const token = newToken("b");
    await q.query(
      "insert into bookings (workspace_id, item_id, qr_id, name, phone, staff, starts_at, ends_at, qty, status, code, token, visitor) values ($1,$2,$3,$4,$5,'',$6,$6,$7,'confirmed',$8,$9,$10)",
      [p.workspaceId, p.itemId, p.qrId, p.req.name, p.req.phone, it.starts_at, p.req.qty, code, token, p.visitor],
    );
    await upsertContact(q, p.workspaceId, { name: p.req.name, phone: p.req.phone, source: "Event" });
    return { ok: true, booking: { code, token, status: "confirmed", startsAt: it.starts_at.toISOString(), staff: "" } };
  });
}

export async function seatsLeft(itemId: string): Promise<number | null> {
  const [r] = await query<{ left: number | null }>(
    "select (i.capacity - coalesce((select sum(qty) from bookings b where b.item_id = i.id and b.status in ('pending','confirmed','completed')), 0))::int as left from booking_items i where i.id = $1",
    [itemId],
  );
  return r?.left ?? null;
}

export async function listBookings(workspaceId: string, opts: { from?: Date; to?: Date; limit?: number } = {}): Promise<BookingRecord[]> {
  const where = ["b.workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  if (opts.from) { params.push(opts.from); where.push(`b.starts_at >= $${params.length}`); }
  if (opts.to) { params.push(opts.to); where.push(`b.starts_at < $${params.length}`); }
  params.push(opts.limit ?? 300);
  return (await query<BookingRow>(`${BOOKING_SELECT} where ${where.join(" and ")} order by b.starts_at ${opts.from ? "asc" : "desc"} limit $${params.length}`, params)).map(toBooking);
}

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [],
  no_show: ["confirmed"],
  cancelled: [],
};
export async function setBookingStatus(workspaceId: string, id: string, status: BookingStatus): Promise<"ok" | "not_found" | "bad_state"> {
  if (!isUuid(id)) return "not_found";
  return tx(async (q) => {
    const [b] = await q.query<{ status: BookingStatus }>("select status from bookings where id = $1 and workspace_id = $2 for update", [id, workspaceId]);
    if (!b) return "not_found";
    if (!TRANSITIONS[b.status].includes(status)) return "bad_state";
    await q.query("update bookings set status = $2 where id = $1", [id, status]);
    return "ok";
  });
}

/** The customer cancels their own booking from their link, until it has started. */
export async function cancelByToken(token: string): Promise<"ok" | "not_found" | "bad_state"> {
  if (!/^b[A-Za-z0-9_-]{22}$/.test(token)) return "not_found";
  return tx(async (q) => {
    const [b] = await q.query<{ id: string; status: BookingStatus; starts_at: Date }>("select id, status, starts_at from bookings where token = $1 for update", [token]);
    if (!b) return "not_found";
    if (!["pending", "confirmed"].includes(b.status) || b.starts_at.getTime() < Date.now()) return "bad_state";
    await q.query("update bookings set status = 'cancelled' where id = $1", [b.id]);
    return "ok";
  });
}

export async function getBookingByToken(token: string) {
  if (!/^b[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const [r] = await query<BookingRow & { business: string; venue: string }>(`select b.id, b.item_id, i.name as item_name, i.kind, b.name, b.phone, b.staff, b.starts_at, b.ends_at, b.qty, b.status, b.code, b.checked_in_at, i.price::text as price, b.token, w.name as business, i.venue
    from bookings b join booking_items i on i.id = b.item_id join workspaces w on w.id = b.workspace_id where b.token = $1`, [token]);
  if (!r) return null;
  const b = toBooking(r);
  // only what the customer needs on their own page: no phone number, no internal ids
  return {
    itemName: b.itemName, kind: b.kind, name: b.name, staff: b.staff, startsAt: b.startsAt, qty: b.qty, status: b.status, code: b.code, price: b.price,
    business: r.business, venue: r.venue, canCancel: ["pending", "confirmed"].includes(b.status) && r.starts_at.getTime() > Date.now(),
  };
}

/* ---------- gate check-in (events and arrivals) ---------- */

export type GateLookup = { code: string; name: string; qty: number; item: string; kind: "service" | "event"; status: BookingStatus; startsAt: string; checkedInAt: string | null; state: "valid" | "already" | "cancelled" };
export async function gateLookup(workspaceId: string, raw: string): Promise<GateLookup | null> {
  const code = raw.trim().toUpperCase();
  if (!/^(BK|EV)-[A-Z0-9]{4,10}$/.test(code)) return null;
  const [r] = await query<BookingRow>(`${BOOKING_SELECT} where b.workspace_id = $1 and b.code = $2`, [workspaceId, code]);
  if (!r) return null;
  const b = toBooking(r);
  return {
    code: b.code, name: b.name, qty: b.qty, item: b.itemName, kind: b.kind, status: b.status, startsAt: b.startsAt, checkedInAt: b.checkedInAt,
    state: b.status === "cancelled" || b.status === "no_show" ? "cancelled" : b.checkedInAt ? "already" : "valid",
  };
}
export async function gateCheckIn(workspaceId: string, raw: string): Promise<{ ok: true; lookup: GateLookup } | { ok: false; reason: "not_found" | "cancelled" | "already"; lookup?: GateLookup }> {
  const lookup = await gateLookup(workspaceId, raw);
  if (!lookup) return { ok: false, reason: "not_found" };
  if (lookup.state === "cancelled") return { ok: false, reason: "cancelled", lookup };
  const rows = await query("update bookings set checked_in_at = now(), status = case when status = 'pending' then 'confirmed' else status end where workspace_id = $1 and code = $2 and checked_in_at is null and status in ('pending','confirmed','completed') returning id", [workspaceId, lookup.code]);
  if (rows.length === 0) return { ok: false, reason: "already", lookup: (await gateLookup(workspaceId, lookup.code)) ?? lookup };
  return { ok: true, lookup: (await gateLookup(workspaceId, lookup.code)) ?? lookup };
}

/* ---------- numbers for the screen ---------- */

export async function bookingStats(workspaceId: string) {
  const today = istDay();
  const [r] = await query<{ today: number; pending: number; week: number; next30: number }>(
    `select count(*) filter (where starts_at >= $2 and starts_at < $3 and status in ('pending','confirmed','completed'))::int as today,
            count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where starts_at >= $2 and starts_at < $4 and status in ('pending','confirmed','completed'))::int as week,
            count(*) filter (where starts_at >= $2 and status in ('pending','confirmed'))::int as next30
       from bookings where workspace_id = $1`,
    [workspaceId, istInstant(today, 0), istInstant(addDays(today, 1), 0), istInstant(addDays(today, 7), 0)],
  );
  return r;
}
export const pendingBookings = async (workspaceId: string) => (await bookingStats(workspaceId)).pending;
export { istMinutes };
