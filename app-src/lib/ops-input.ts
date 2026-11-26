import { normPhone, type Result } from "@/lib/engage-input";
import { TICKET_CATEGORIES, waDigits } from "@/lib/qr-types";

/**
 * Validation and pure logic for the Operate modules: tickets & assets, attendance & visitors,
 * bookings & events and real-estate plots (design/Tickets, Attendance, Bookings, RealEstate .dc.html).
 * No database here, so the builders and the APIs share the same rules.
 */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = <T,>(fields: Record<string, string>): Result<T> => ({ ok: false, fields });
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
};
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/* ---------- India Standard Time (no daylight saving, always +05:30) ---------- */

const IST_MS = 5.5 * 3_600_000;
/** Calendar date in India, "YYYY-MM-DD". */
export const istDay = (d = new Date()) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
/** Minutes since midnight in India. */
export const istMinutes = (d = new Date()) => {
  const x = new Date(d.getTime() + IST_MS);
  return x.getUTCHours() * 60 + x.getUTCMinutes();
};
/** Day of week in India, 0 = Sunday. */
export const istDow = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
/** The instant of `minutes` past midnight on an Indian calendar day. */
export const istInstant = (day: string, minutes: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + minutes * 60_000 - IST_MS);
export const addDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
export const validDay = (v: unknown): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
};
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseHHMM = (v: unknown): number | null => {
  const m = typeof v === "string" ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
};
export const clock12 = (m: number) => {
  const h = Math.floor(m / 60) % 24, mi = m % 60;
  return `${h % 12 || 12}:${String(mi).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/* =====================================================================
 * Tickets & assets
 * ===================================================================== */

export const PRIORITIES = [
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["key"];
export const TICKET_STATUSES = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number]["key"];
export const DEFAULT_SLA: Record<Priority, number> = { high: 4, normal: 24, low: 72 };
export { TICKET_CATEGORIES };
/** Quick problem choices on the customer's ticket page. */
export const PROBLEM_CHIPS = ["Cleaning", "Not working", "Broken", "Safety", "Service", "Other"] as const;
export const ASSET_PROBLEMS = ["Not working", "Water leak", "Noise", "Bad smell", "Other"] as const;

export type TicketInput = { title: string; category: string; priority: Priority; place: string; details: string; customerName: string; customerPhone: string; assignee: string };

export function parseManualTicket(raw: unknown): Result<TicketInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const title = str(r.title, 120);
  if (title.length < 3) f.title = "Describe the problem in a few words (3+ characters).";
  const category = str(r.category, 30) || "Other";
  if (!TICKET_CATEGORIES.includes(category)) f.category = "Choose a category from the list.";
  const priority = (str(r.priority, 10) || "normal") as Priority;
  if (!PRIORITIES.some((p) => p.key === priority)) f.priority = "Choose High, Normal or Low.";
  const phoneRaw = str(r.customerPhone, 30);
  const customerPhone = phoneRaw ? normPhone(phoneRaw) : "";
  if (phoneRaw && !customerPhone) f.customerPhone = "Enter a valid number with country code, or leave it blank.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { title, category, priority, place: str(r.place, 80), details: str(r.details, 600), customerName: str(r.customerName, 80), customerPhone: customerPhone ?? "", assignee: str(r.assignee, 60) } };
}

/** A customer's ticket from the Feedback or Asset QR page. */
export type PublicTicketInput = { problem: string; details: string; name: string; phone: string };
export function parsePublicTicket(raw: unknown, problems: readonly string[]): Result<PublicTicketInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const problem = str(r.problem, 40);
  const details = str(r.details, 600);
  if (problem && !problems.includes(problem)) f.problem = "Choose one of the options.";
  if (!problem && details.length < 3) f.details = "Choose the problem or describe it in a few words.";
  const phoneRaw = str(r.phone, 30);
  const phone = phoneRaw ? normPhone(phoneRaw) : "";
  if (phoneRaw && !phone) f.phone = "Enter a valid mobile number, or leave it blank.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { problem, details, name: str(r.name, 80), phone: phone ?? "" } };
}

export type TicketPatch = { status?: TicketStatus; assignee?: string; priority?: Priority; note?: string; reply?: string };
export function parseTicketPatch(raw: unknown): Result<TicketPatch> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const v: TicketPatch = {};
  if (r.status !== undefined) {
    if (TICKET_STATUSES.some((s) => s.key === r.status)) v.status = r.status as TicketStatus;
    else f.status = "Unknown status.";
  }
  if (r.priority !== undefined) {
    if (PRIORITIES.some((p) => p.key === r.priority)) v.priority = r.priority as Priority;
    else f.priority = "Unknown priority.";
  }
  if (r.assignee !== undefined) v.assignee = str(r.assignee, 60);
  if (r.note !== undefined) {
    v.note = str(r.note, 600);
    if (!v.note) f.note = "Write the note first.";
  }
  if (r.reply !== undefined) {
    v.reply = str(r.reply, 600);
    if (!v.reply) f.reply = "Write the reply first.";
  }
  if (Object.keys(f).length) return fail(f);
  if (Object.keys(v).length === 0) return fail({ _: "Nothing to change." });
  return { ok: true, value: v };
}

export type SlaInput = Record<Priority, number>;
export function parseSla(raw: unknown): Result<SlaInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const out = {} as SlaInput;
  for (const p of PRIORITIES) {
    const n = int(r[p.key]);
    if (n === null || n < 1 || n > 720) f[p.key] = "Enter whole hours between 1 and 720.";
    else out[p.key] = n;
  }
  if (Object.keys(f).length) return fail(f);
  if (!(out.high <= out.normal && out.normal <= out.low)) return fail({ normal: "High should be quickest, then Normal, then Low." });
  return { ok: true, value: out };
}

export type AssetInput = { name: string; place: string; vendor: string; intervalDays: number | null; lastService: string | null; active: boolean };
export function parseAsset(raw: unknown): Result<AssetInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the asset a name (2+ characters).";
  let intervalDays: number | null = null;
  if (r.intervalDays !== undefined && r.intervalDays !== null && r.intervalDays !== "") {
    intervalDays = int(r.intervalDays);
    if (intervalDays === null || intervalDays < 1 || intervalDays > 3650) f.intervalDays = "Enter whole days between 1 and 3650, or leave it blank.";
  }
  let lastService: string | null = null;
  if (r.lastService) {
    lastService = validDay(r.lastService);
    if (!lastService) f.lastService = "Enter a valid date.";
    else if (lastService > addDays(istDay(), 1)) f.lastService = "That date is in the future.";
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, place: str(r.place, 80), vendor: str(r.vendor, 80), intervalDays, lastService, active: r.active !== false } };
}

export const nextDue = (last: string | null, intervalDays: number | null) => (last && intervalDays ? addDays(last, intervalDays) : null);
export type DueState = "none" | "overdue" | "soon" | "ok";
export const dueState = (due: string | null, today = istDay()): DueState => (!due ? "none" : due < today ? "overdue" : due <= addDays(today, 7) ? "soon" : "ok");
export const assetCode = (seq: number) => `AST-${String(seq).padStart(4, "0")}`;

export type ServiceLogInput = { servicedOn: string; byName: string; notes: string };
export function parseServiceLog(raw: unknown): Result<ServiceLogInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const servicedOn = r.servicedOn ? validDay(r.servicedOn) : istDay();
  if (!servicedOn) f.servicedOn = "Enter a valid date.";
  else if (servicedOn > addDays(istDay(), 1)) f.servicedOn = "That date is in the future.";
  const notes = str(r.notes, 600);
  const byName = str(r.byName, 80);
  if (!byName && !notes) f.notes = "Add who serviced it or a short note.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { servicedOn: servicedOn!, byName, notes } };
}

/** Time left until `dueAt`, e.g. "1h 48m" or "−0h 20m" when past. */
export function slaText(dueAt: Date, now = new Date()): { text: string; breached: boolean } {
  const ms = dueAt.getTime() - now.getTime();
  const m = Math.floor(Math.abs(ms) / 60_000);
  const h = Math.floor(m / 60);
  const txt = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return { text: ms < 0 ? `−${txt}` : txt, breached: ms < 0 };
}

/* =====================================================================
 * Attendance & visitors
 * ===================================================================== */

export const WORKER_KINDS = [
  { key: "staff", label: "Staff" },
  { key: "labour", label: "Labour" },
] as const;
export type WorkerKind = (typeof WORKER_KINDS)[number]["key"];

export type WorkerInput = { name: string; phone: string; kind: WorkerKind; role: string; shiftStart: number; shiftEnd: number; active: boolean };
export function parseWorker(raw: unknown): Result<WorkerInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter the person's name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number. Its last 4 digits are used to check in.";
  const kind = (str(r.kind, 10) || "staff") as WorkerKind;
  if (!WORKER_KINDS.some((k) => k.key === kind)) f.kind = "Choose Staff or Labour.";
  const shiftStart = parseHHMM(r.shiftStart ?? "09:00");
  const shiftEnd = parseHHMM(r.shiftEnd ?? "18:00");
  if (shiftStart === null) f.shiftStart = "Enter a time like 09:00.";
  if (shiftEnd === null) f.shiftEnd = "Enter a time like 18:00.";
  if (shiftStart !== null && shiftEnd !== null && shiftEnd <= shiftStart) f.shiftEnd = "The shift must end after it starts.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, phone: phone!, kind, role: str(r.role, 60), shiftStart: shiftStart!, shiftEnd: shiftEnd!, active: r.active !== false } };
}
export const workerCode = (kind: WorkerKind, seq: number) => `${kind === "staff" ? "ST" : "LB"}-${String(seq).padStart(4, "0")}`;

export type PointInput = { name: string; lat: number | null; lng: number | null; radiusM: number; requireGeo: boolean };
export function parsePoint(raw: unknown): Result<PointInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the check-in point a name (2+ characters).";
  const lat = r.lat === null || r.lat === "" || r.lat === undefined ? null : num(r.lat);
  const lng = r.lng === null || r.lng === "" || r.lng === undefined ? null : num(r.lng);
  if ((r.lat !== null && r.lat !== "" && r.lat !== undefined && (lat === null || lat < -90 || lat > 90))) f.lat = "Latitude must be between -90 and 90.";
  if ((r.lng !== null && r.lng !== "" && r.lng !== undefined && (lng === null || lng < -180 || lng > 180))) f.lng = "Longitude must be between -180 and 180.";
  if ((lat === null) !== (lng === null) && !f.lat && !f.lng) f.lat = "Enter both latitude and longitude, or neither.";
  const radiusM = r.radiusM === undefined || r.radiusM === "" ? 100 : int(r.radiusM);
  if (radiusM === null || radiusM < 20 || radiusM > 5000) f.radiusM = "Enter metres between 20 and 5000.";
  const requireGeo = r.requireGeo !== false;
  if (requireGeo && (lat === null || lng === null) && !f.lat && !f.lng) f.lat = "Set the location first, or turn off the location check.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, lat, lng, radiusM: radiusM!, requireGeo } };
}

/** Distance in metres between two coordinates. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** Minutes after the shift started (beyond the grace period), 0 when on time. */
export const lateMinutes = (inAt: Date, shiftStart: number, graceMin: number) => Math.max(0, istMinutes(inAt) - shiftStart - graceMin);

export type CheckInInput = { workerCode: string; last4: string; lat: number | null; lng: number | null };
export function parseCheckIn(raw: unknown): Result<CheckInInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const code = str(r.workerCode, 20).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{2}-\d{3,6}$/.test(code)) f.workerCode = "Enter your ID, like ST-0007.";
  const last4 = str(r.last4, 4);
  if (!/^\d{4}$/.test(last4)) f.last4 = "Enter the last 4 digits of your mobile number.";
  const lat = r.lat === null || r.lat === undefined ? null : num(r.lat);
  const lng = r.lng === null || r.lng === undefined ? null : num(r.lng);
  const hasGeo = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { workerCode: code, last4, lat: hasGeo ? lat : null, lng: hasGeo ? lng : null } };
}

export type VisitorInput = { name: string; phone: string; purpose: string; host: string };
export function parseVisitor(raw: unknown): Result<VisitorInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number.";
  const purpose = str(r.purpose, 120);
  if (purpose.length < 2) f.purpose = "Say why you are visiting.";
  const host = str(r.host, 80);
  if (host.length < 2) f.host = "Say who you are meeting.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, phone: phone!, purpose, host } };
}

/** "+919876543210" -> "+91 98xxx xx210" for lists the owner reads on screen. */
export const maskPhone = (p: string) => (p.length >= 8 ? `${p.slice(0, 3)} ${p.slice(3, 5)}xxx xx${p.slice(-3)}` : p);

/* =====================================================================
 * Bookings & events
 * ===================================================================== */

export const BOOKING_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No-show" },
  { key: "cancelled", label: "Cancelled" },
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number]["key"];
/** Statuses that hold a slot or seats. */
export const HOLDING: BookingStatus[] = ["pending", "confirmed", "completed"];

export type ServiceInput = { name: string; description: string; durationMin: number; price: number | null; staff: string[]; needsApproval: boolean; active: boolean };
const parseStaff = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((x) => str(x, 40))
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 12);
const parsePrice = (v: unknown, f: Record<string, string>): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = num(v);
  if (n === null || n < 0 || n > 10_000_000) f.price = "Enter a price in rupees, or leave it blank for free.";
  return n !== null && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export function parseService(raw: unknown): Result<ServiceInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the service a name (2+ characters).";
  const durationMin = int(r.durationMin);
  if (durationMin === null || durationMin < 5 || durationMin > 1440) f.durationMin = "Enter minutes between 5 and 1440.";
  const price = parsePrice(r.price, f);
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, description: str(r.description, 200), durationMin: durationMin!, price, staff: parseStaff(r.staff), needsApproval: r.needsApproval === true, active: r.active !== false } };
}

export type EventInput = { name: string; description: string; startsAt: string; capacity: number; price: number | null; venue: string; active: boolean };
export function parseEvent(raw: unknown): Result<EventInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the event a name (2+ characters).";
  const d = typeof r.startsAt === "string" ? new Date(r.startsAt) : null;
  if (!d || Number.isNaN(d.getTime())) f.startsAt = "Choose the date and time.";
  const capacity = int(r.capacity);
  if (capacity === null || capacity < 1 || capacity > 100_000) f.capacity = "Enter how many tickets are available (1 or more).";
  const price = parsePrice(r.price, f);
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, description: str(r.description, 200), startsAt: d!.toISOString(), capacity: capacity!, price, venue: str(r.venue, 120), active: r.active !== false } };
}

export type DayHours = { dow: number; closed: boolean; open: number; close: number };
export const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, (_, dow) => ({ dow, closed: dow === 0, open: 600, close: 1080 }));
export const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function parseHours(raw: unknown): Result<DayHours[]> {
  const rows = Array.isArray(raw) ? raw : [];
  const f: Record<string, string> = {};
  const out: DayHours[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const r = (rows.find((x) => x && typeof x === "object" && (x as { dow?: unknown }).dow === dow) ?? {}) as Record<string, unknown>;
    const closed = r.closed === true;
    const open = parseHHMM(r.open ?? "10:00");
    const close = parseHHMM(r.close ?? "18:00");
    if (!closed) {
      if (open === null) f[`${dow}.open`] = "Enter a time like 10:00.";
      else if (close === null) f[`${dow}.close`] = "Enter a time like 18:00.";
      else if (close <= open) f[`${dow}.close`] = "Closing time must be after opening.";
    }
    out.push({ dow, closed, open: open ?? 600, close: close ?? 1080 });
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: out };
}

export const MAX_DAYS_AHEAD = 14;
export const MIN_NOTICE_MIN = 30;
/** Start times (minutes after midnight, India) a service can be booked on one day, before taking existing bookings into account. */
export function slotStarts(day: string, hours: DayHours[], durationMin: number, now = new Date()): number[] {
  const h = hours.find((x) => x.dow === istDow(day));
  if (!h || h.closed) return [];
  const step = durationMin <= 30 ? durationMin : 30;
  const earliest = now.getTime() + MIN_NOTICE_MIN * 60_000;
  const out: number[] = [];
  for (let m = h.open; m + durationMin <= h.close; m += step) if (istInstant(day, m).getTime() >= earliest) out.push(m);
  return out;
}
export const dayAllowed = (day: string, now = new Date()) => {
  const today = istDay(now);
  return day >= today && day <= addDays(today, MAX_DAYS_AHEAD);
};

export type BookingRequest = { day: string; start: number; staff: string; name: string; phone: string; qty: number };
export function parseBookingRequest(raw: unknown, kind: "service" | "event"): Result<BookingRequest> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number.";
  let day = "", start = 0, qty = 1;
  if (kind === "service") {
    day = validDay(r.date) ?? "";
    if (!day) f.date = "Choose a date.";
    const s = int(r.start);
    if (s === null || s < 0 || s >= 1440) f.start = "Choose a time.";
    else start = s;
  } else {
    const q = r.qty === undefined || r.qty === "" ? 1 : int(r.qty);
    if (q === null || q < 1 || q > 5) f.qty = "You can book 1 to 5 tickets at a time.";
    else qty = q;
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { day, start, staff: str(r.staff, 40), name, phone: phone!, qty } };
}

/* =====================================================================
 * Real estate
 * ===================================================================== */

export const PLOT_STATUSES = [
  { key: "available", label: "Available" },
  { key: "hold", label: "On hold" },
  { key: "booked", label: "Booked" },
  { key: "sold", label: "Sold" },
] as const;
export type PlotStatus = (typeof PLOT_STATUSES)[number]["key"];
export const FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];
export const ENQUIRY_ASKS = [
  { key: "price", label: "Price & loan options" },
  { key: "visit", label: "Site visit" },
  { key: "brochure", label: "Brochure" },
  { key: "other", label: "Something else" },
] as const;
export type EnquiryAsk = (typeof ENQUIRY_ASKS)[number]["key"];
export const VISIT_SLOTS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
] as const;

const httpUrl = (v: string) => {
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
};

export type ProjectInput = { name: string; approval: string; columns: number; roadAfter: number[]; brochureUrl: string; whatsapp: string; plotCount: number | null };
export function parseProject(raw: unknown, creating: boolean): Result<ProjectInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the project a name (2+ characters).";
  const columns = r.columns === undefined || r.columns === "" ? 10 : int(r.columns);
  if (columns === null || columns < 2 || columns > 20) f.columns = "Enter 2 to 20 plots per row.";
  const roadRaw = Array.isArray(r.roadAfter) ? r.roadAfter : typeof r.roadAfter === "string" ? r.roadAfter.split(/[,\s]+/).filter(Boolean) : [];
  const roadAfter = roadRaw.map((x) => int(x));
  if (roadAfter.some((x) => x === null || x < 1 || x > 100)) f.roadAfter = "List row numbers separated by commas, like 2, 5.";
  let plotCount: number | null = null;
  if (creating) {
    plotCount = int(r.plotCount);
    if (plotCount === null || plotCount < 1 || plotCount > 500) f.plotCount = "Enter how many plots (1 to 500).";
  }
  const brochureRaw = str(r.brochureUrl, 300);
  const brochureUrl = brochureRaw ? httpUrl(brochureRaw) : "";
  if (brochureRaw && !brochureUrl) f.brochureUrl = "Enter a valid web address.";
  const waRaw = str(r.whatsapp, 30);
  const wa = waRaw ? waDigits(waRaw) : "";
  if (waRaw && !wa) f.whatsapp = "Enter a valid number with country code.";
  if (Object.keys(f).length) return fail(f);
  return {
    ok: true,
    value: { name, approval: str(r.approval, 60), columns: columns!, roadAfter: [...new Set(roadAfter as number[])].sort((a, b) => a - b), brochureUrl: brochureUrl ?? "", whatsapp: wa ? `+${wa}` : "", plotCount },
  };
}

export type PlotInput = { sizeSqft: number | null; dims: string; facing: string; priceLakh: number | null; approval: string; corner: boolean; status: PlotStatus };
export function parsePlot(raw: unknown): Result<PlotInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  let sizeSqft: number | null = null;
  if (r.sizeSqft !== undefined && r.sizeSqft !== null && r.sizeSqft !== "") {
    sizeSqft = int(r.sizeSqft);
    if (sizeSqft === null || sizeSqft < 1 || sizeSqft > 10_000_000) f.sizeSqft = "Enter the size in sq ft, or leave it blank.";
  }
  let priceLakh: number | null = null;
  if (r.priceLakh !== undefined && r.priceLakh !== null && r.priceLakh !== "") {
    priceLakh = num(r.priceLakh);
    if (priceLakh === null || priceLakh < 0 || priceLakh > 1_000_000) f.priceLakh = "Enter the price in lakh, or leave it blank.";
    else priceLakh = Math.round(priceLakh * 100) / 100;
  }
  const facing = str(r.facing, 20);
  if (facing && !FACINGS.includes(facing)) f.facing = "Choose a direction from the list.";
  const status = (str(r.status, 12) || "available") as PlotStatus;
  if (!PLOT_STATUSES.some((s) => s.key === status)) f.status = "Unknown status.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { sizeSqft, dims: str(r.dims, 30), facing, priceLakh, approval: str(r.approval, 60), corner: r.corner === true, status } };
}

export type PlotRow = { number: number } & PlotInput;
const yes = (v: string) => /^(y|yes|true|1|corner)$/i.test(v.trim());
/** CSV rows (header: number, size, dims, facing, price, approval, corner, status) -> plots, with a reason for every row left out. */
export function parsePlotRows(rows: Record<string, string>[]): { ok: PlotRow[]; skipped: { line: number; reason: string }[] } {
  const ok: PlotRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<number>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const g = (...keys: string[]) => {
      for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
      return "";
    };
    const number = int(g("number", "plot", "plot_no", "no"));
    if (number === null || number < 1 || number > 9999) return void skipped.push({ line, reason: "plot number must be 1 to 9999" });
    if (seen.has(number)) return void skipped.push({ line, reason: `plot ${number} appears twice` });
    const p = parsePlot({
      sizeSqft: g("size", "sqft", "size_sqft"),
      dims: g("dims", "dimensions"),
      facing: g("facing"),
      priceLakh: g("price", "price_lakh"),
      approval: g("approval"),
      corner: yes(g("corner")),
      status: g("status").toLowerCase().replace(/\s+/g, "") === "onhold" ? "hold" : g("status").toLowerCase() || "available",
    });
    if (!p.ok) return void skipped.push({ line, reason: Object.values(p.fields)[0] });
    seen.add(number);
    ok.push({ number, ...p.value });
  });
  return { ok, skipped };
}

export type EnquiryInput = { name: string; phone: string; ask: EnquiryAsk; visitOn: string | null; visitSlot: string };
export function parseEnquiry(raw: unknown): Result<EnquiryInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number.";
  const ask = (str(r.ask, 12) || "visit") as EnquiryAsk;
  if (!ENQUIRY_ASKS.some((a) => a.key === ask)) f.ask = "Choose what you would like.";
  let visitOn: string | null = null;
  let visitSlot = "";
  if (ask === "visit" && r.visitOn) {
    visitOn = validDay(r.visitOn);
    if (!visitOn) f.visitOn = "Choose a valid date.";
    else if (!dayAllowed(visitOn)) f.visitOn = "Choose a date from today, up to two weeks ahead.";
    visitSlot = str(r.visitSlot, 12);
    if (visitSlot && !VISIT_SLOTS.some((s) => s.key === visitSlot)) f.visitSlot = "Choose morning, afternoon or evening.";
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, phone: phone!, ask, visitOn, visitSlot } };
}

/** Indian-style price, e.g. 42.5 lakh -> "₹42.5 L"; 120 lakh -> "₹1.2 Cr". null -> placeholder shown until a price is set. */
export function priceText(lakh: number | null): string {
  if (lakh === null) return "₹[00.0] L";
  if (lakh >= 100) return `₹${(Math.round(lakh) / 100).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  return `₹${Number.isInteger(lakh) ? lakh : lakh.toFixed(2).replace(/\.?0+$/, "")} L`;
}
