import "server-only";
import { query, tx } from "@/lib/db";
import { addDays, haversine, istDay, istInstant, istMinutes, lateMinutes, workerCode, type PointInput, type VisitorInput, type WorkerInput, type WorkerKind } from "@/lib/ops-input";
import { newToken } from "@/lib/token";

const uuidRe = /^[0-9a-f-]{36}$/i;
const isUuid = (v: string) => uuidRe.test(v);

/* ---------- rules ---------- */

export async function getLateAfter(workspaceId: string): Promise<number> {
  const [r] = await query<{ late_after_min: number }>("select late_after_min from attend_settings where workspace_id = $1", [workspaceId]);
  return r?.late_after_min ?? 15;
}
export async function saveLateAfter(workspaceId: string, minutes: number): Promise<void> {
  await query("insert into attend_settings (workspace_id, late_after_min) values ($1,$2) on conflict (workspace_id) do update set late_after_min = excluded.late_after_min", [workspaceId, minutes]);
}

/* ---------- workers ---------- */

export type WorkerRecord = { id: string; code: string; kind: WorkerKind; name: string; phone: string; role: string; shiftStart: number; shiftEnd: number; active: boolean };
type WorkerRow = { id: string; code: string; kind: WorkerKind; name: string; phone: string; role: string; shift_start: number; shift_end: number; active: boolean };
const toWorker = (r: WorkerRow): WorkerRecord => ({ id: r.id, code: r.code, kind: r.kind, name: r.name, phone: r.phone, role: r.role, shiftStart: r.shift_start, shiftEnd: r.shift_end, active: r.active });
const WORKER_COLS = "id, code, kind, name, phone, role, shift_start, shift_end, active";

export async function listWorkers(workspaceId: string, opts: { kind?: WorkerKind; includeInactive?: boolean } = {}): Promise<WorkerRecord[]> {
  const rows = await query<WorkerRow>(`select ${WORKER_COLS} from workers where workspace_id = $1 ${opts.includeInactive ? "" : "and active"} ${opts.kind ? "and kind = $2" : ""} order by code`, opts.kind ? [workspaceId, opts.kind] : [workspaceId]);
  return rows.map(toWorker);
}

export async function createWorker(workspaceId: string, w: WorkerInput): Promise<{ id: string; code: string }> {
  return tx(async (q) => {
    const [s] = await q.query<{ worker_seq: number }>("update workspaces set worker_seq = worker_seq + 1 where id = $1 returning worker_seq", [workspaceId]);
    const code = workerCode(w.kind, s.worker_seq);
    const [r] = await q.query<{ id: string }>(
      "insert into workers (workspace_id, code, kind, name, phone, role, shift_start, shift_end, active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      [workspaceId, code, w.kind, w.name, w.phone, w.role, w.shiftStart, w.shiftEnd, w.active],
    );
    return { id: r.id, code };
  });
}

export async function updateWorker(workspaceId: string, id: string, w: WorkerInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query("update workers set name=$3, phone=$4, role=$5, shift_start=$6, shift_end=$7, active=$8 where id=$1 and workspace_id=$2 returning id", [id, workspaceId, w.name, w.phone, w.role, w.shiftStart, w.shiftEnd, w.active]);
  return rows.length > 0;
}

/* ---------- check-in points ---------- */

export type PointRecord = { id: string; name: string; lat: number | null; lng: number | null; radiusM: number; requireGeo: boolean; today: number; inUse: number };
type PointRow = { id: string; name: string; lat: number | null; lng: number | null; radius_m: number; require_geo: boolean; today: number; in_use: number };
const toPoint = (r: PointRow): PointRecord => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, radiusM: r.radius_m, requireGeo: r.require_geo, today: r.today, inUse: r.in_use });
const POINT_SELECT = `
  select p.id, p.name, p.lat, p.lng, p.radius_m, p.require_geo,
         (select count(*)::int from attendance a where a.point_id = p.id and a.day = $2::date) as today,
         (select count(*)::int from qr_codes q where q.workspace_id = p.workspace_id and q.status <> 'archived' and q.config->>'pointId' = p.id::text) as in_use
    from attend_points p`;

export async function listPoints(workspaceId: string): Promise<PointRecord[]> {
  return (await query<PointRow>(`${POINT_SELECT} where p.workspace_id = $1 order by p.created_at`, [workspaceId, istDay()])).map(toPoint);
}
export async function getPoint(workspaceId: string, id: string): Promise<PointRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<PointRow>(`${POINT_SELECT} where p.id = $1 and p.workspace_id = $3`, [id, istDay(), workspaceId]);
  return r ? toPoint(r) : null;
}
export async function createPoint(workspaceId: string, p: PointInput): Promise<string> {
  const [r] = await query<{ id: string }>("insert into attend_points (workspace_id, name, lat, lng, radius_m, require_geo) values ($1,$2,$3,$4,$5,$6) returning id", [workspaceId, p.name, p.lat, p.lng, p.radiusM, p.requireGeo]);
  return r.id;
}
export async function updatePoint(workspaceId: string, id: string, p: PointInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query("update attend_points set name=$3, lat=$4, lng=$5, radius_m=$6, require_geo=$7 where id=$1 and workspace_id=$2 returning id", [id, workspaceId, p.name, p.lat, p.lng, p.radiusM, p.requireGeo]);
  return rows.length > 0;
}
export async function deletePoint(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  if (!isUuid(id)) return "not_found";
  const p = await getPoint(workspaceId, id);
  if (!p) return "not_found";
  if (p.inUse > 0) return "in_use";
  await query("delete from attend_points where id = $1", [id]);
  return "ok";
}

/* ---------- check-in / check-out ---------- */

export type CheckInResult =
  | { ok: true; action: "in" | "out"; at: string; name: string; code: string; distM: number | null; verified: boolean; lateMin: number; shiftStart: number; shiftEnd: number; inAt: string }
  | { ok: false; reason: "no_worker" | "bad_phone" | "need_location" | "outside" | "too_soon" | "done"; distM?: number; radiusM?: number; at?: string; name?: string };

/** One scan = check in; the next scan later the same day = check out. The worker proves who they are with their ID and the last 4 digits of their number. */
export async function checkIn(p: { workspaceId: string; qrId: string; point: PointRecord; code: string; last4: string; lat: number | null; lng: number | null }): Promise<CheckInResult> {
  return tx(async (q) => {
    const [w] = await q.query<WorkerRow>(`select ${WORKER_COLS} from workers where workspace_id = $1 and code = $2 and active for update`, [p.workspaceId, p.code]);
    if (!w) return { ok: false, reason: "no_worker" };
    if (!w.phone.endsWith(p.last4)) return { ok: false, reason: "bad_phone" };

    let distM: number | null = null;
    let verified = false;
    if (p.point.requireGeo && p.point.lat !== null && p.point.lng !== null) {
      if (p.lat === null || p.lng === null) return { ok: false, reason: "need_location" };
      distM = haversine(p.lat, p.lng, p.point.lat, p.point.lng);
      if (distM > p.point.radiusM) return { ok: false, reason: "outside", distM, radiusM: p.point.radiusM };
      verified = true;
    }

    const now = new Date();
    const day = istDay(now);
    const [a] = await q.query<{ id: string; in_at: Date; out_at: Date | null }>("select id, in_at, out_at from attendance where worker_id = $1 and day = $2::date for update", [w.id, day]);
    if (!a) {
      const grace = (await q.query<{ late_after_min: number }>("select late_after_min from attend_settings where workspace_id = $1", [p.workspaceId]))[0]?.late_after_min ?? 15;
      const late = lateMinutes(now, w.shift_start, grace);
      await q.query(
        "insert into attendance (workspace_id, worker_id, day, point_id, qr_id, in_at, in_dist, in_verified, late_min) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [p.workspaceId, w.id, day, p.point.id, p.qrId, now, distM, verified, late],
      );
      return { ok: true, action: "in", at: now.toISOString(), name: w.name, code: w.code, distM, verified, lateMin: late, shiftStart: w.shift_start, shiftEnd: w.shift_end, inAt: now.toISOString() };
    }
    if (a.out_at) return { ok: false, reason: "done", at: a.out_at.toISOString(), name: w.name };
    if (now.getTime() - a.in_at.getTime() < 2 * 60_000) return { ok: false, reason: "too_soon", at: a.in_at.toISOString(), name: w.name };
    await q.query("update attendance set out_at = $2, out_dist = $3 where id = $1", [a.id, now, distM]);
    return { ok: true, action: "out", at: now.toISOString(), name: w.name, code: w.code, distM, verified, lateMin: 0, shiftStart: w.shift_start, shiftEnd: w.shift_end, inAt: a.in_at.toISOString() };
  });
}

/* ---------- today board ---------- */

export type BoardRow = { workerId: string; code: string; name: string; role: string; kind: WorkerKind; inAt: string | null; outAt: string | null; verified: boolean; distM: number | null; lateMin: number; status: "present" | "late" | "absent" | "expected" | "checked_out" };
export type Board = { day: string; rows: BoardRow[]; onSite: number; scheduled: number; late: number; absent: number; overtimeHoursWeek: number; overtimeWorkers: number };

export async function todayBoard(workspaceId: string, day = istDay()): Promise<Board> {
  const grace = await getLateAfter(workspaceId);
  const rows = await query<{ id: string; code: string; name: string; role: string; kind: WorkerKind; shift_start: number; in_at: Date | null; out_at: Date | null; in_verified: boolean | null; in_dist: number | null; late_min: number | null }>(
    `select w.id, w.code, w.name, w.role, w.kind, w.shift_start, a.in_at, a.out_at, a.in_verified, a.in_dist, a.late_min
       from workers w left join attendance a on a.worker_id = w.id and a.day = $2::date
      where w.workspace_id = $1 and w.active order by w.code`,
    [workspaceId, day],
  );
  const nowMin = istMinutes();
  const isToday = day === istDay();
  const out: BoardRow[] = rows.map((r) => {
    let status: BoardRow["status"];
    if (r.in_at) status = r.out_at ? "checked_out" : (r.late_min ?? 0) > 0 ? "late" : "present";
    else status = !isToday || nowMin > r.shift_start + grace ? "absent" : "expected";
    return { workerId: r.id, code: r.code, name: r.name, role: r.role, kind: r.kind, inAt: r.in_at?.toISOString() ?? null, outAt: r.out_at?.toISOString() ?? null, verified: r.in_verified ?? false, distM: r.in_dist, lateMin: r.late_min ?? 0, status };
  });
  const [ot] = await query<{ hours: number; people: number }>(
    `select coalesce(sum(greatest(0, extract(epoch from (a.out_at - a.in_at)) / 3600 - (w.shift_end - w.shift_start) / 60.0)), 0)::float as hours,
            count(distinct a.worker_id) filter (where extract(epoch from (a.out_at - a.in_at)) / 3600 > (w.shift_end - w.shift_start) / 60.0)::int as people
       from attendance a join workers w on w.id = a.worker_id
      where a.workspace_id = $1 and a.out_at is not null and a.day > $2::date - 7 and a.day <= $2::date`,
    [workspaceId, day],
  );
  return {
    day,
    rows: out,
    onSite: out.filter((r) => r.inAt && !r.outAt).length,
    scheduled: out.length,
    late: out.filter((r) => r.lateMin > 0).length,
    absent: out.filter((r) => r.status === "absent").length,
    overtimeHoursWeek: Math.round(ot.hours),
    overtimeWorkers: ot.people,
  };
}

/** One row per worker for a month ("YYYY-MM"): the figures a payroll sheet starts from. */
export async function monthSummary(workspaceId: string, month: string) {
  const start = `${month}-01`;
  const end = addDays(new Date(new Date(`${start}T00:00:00Z`).setUTCMonth(new Date(`${start}T00:00:00Z`).getUTCMonth() + 1)).toISOString().slice(0, 10), -1);
  return query<{ code: string; name: string; kind: string; role: string; days: number; late_days: number; hours: number; overtime: number }>(
    `select w.code, w.name, w.kind, w.role,
            count(a.id)::int as days,
            count(a.id) filter (where a.late_min > 0)::int as late_days,
            coalesce(sum(extract(epoch from (a.out_at - a.in_at)) / 3600) filter (where a.out_at is not null), 0)::float as hours,
            coalesce(sum(greatest(0, extract(epoch from (a.out_at - a.in_at)) / 3600 - (w.shift_end - w.shift_start) / 60.0)) filter (where a.out_at is not null), 0)::float as overtime
       from workers w left join attendance a on a.worker_id = w.id and a.day between $2::date and $3::date
      where w.workspace_id = $1 group by w.id order by w.code`,
    [workspaceId, start, end],
  );
}

/* ---------- visitor passes ---------- */

export type VisitorStatus = "awaiting" | "approved" | "declined" | "on_site" | "checked_out";
export type VisitorRecord = { id: string; name: string; phone: string; purpose: string; host: string; status: VisitorStatus; validUntil: string | null; inAt: string | null; outAt: string | null; createdAt: string; expired: boolean; place: string };
type VisitorRow = { id: string; name: string; phone: string; purpose: string; host: string; status: VisitorStatus; valid_until: Date | null; in_at: Date | null; out_at: Date | null; created_at: Date; place: string | null };
const toVisitor = (r: VisitorRow): VisitorRecord => ({
  id: r.id, name: r.name, phone: r.phone, purpose: r.purpose, host: r.host, status: r.status, validUntil: r.valid_until?.toISOString() ?? null, inAt: r.in_at?.toISOString() ?? null,
  outAt: r.out_at?.toISOString() ?? null, createdAt: r.created_at.toISOString(), expired: r.status === "approved" && !!r.valid_until && r.valid_until.getTime() < Date.now(), place: r.place ?? "",
});

export async function createVisitor(workspaceId: string, qrId: string, v: VisitorInput, visitor: string): Promise<string> {
  const token = newToken("v");
  await query("insert into visitors (workspace_id, qr_id, name, phone, purpose, host, token, visitor) values ($1,$2,$3,$4,$5,$6,$7,$8)", [workspaceId, qrId, v.name, v.phone, v.purpose, v.host, token, visitor]);
  return token;
}

export async function listVisitors(workspaceId: string, limit = 100): Promise<VisitorRecord[]> {
  const rows = await query<VisitorRow>(
    `select v.id, v.name, v.phone, v.purpose, v.host, v.status, v.valid_until, v.in_at, v.out_at, v.created_at, nullif(q.config->>'place','') as place
       from visitors v left join qr_codes q on q.id = v.qr_id where v.workspace_id = $1
      order by (v.status = 'awaiting') desc, v.created_at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map(toVisitor);
}

export async function awaitingVisitors(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from visitors where workspace_id = $1 and status = 'awaiting'", [workspaceId]);
  return r.n;
}

export type VisitorAction = "approve" | "decline" | "in" | "out";
export async function actOnVisitor(workspaceId: string, id: string, action: VisitorAction): Promise<"ok" | "not_found" | "bad_state"> {
  if (!isUuid(id)) return "not_found";
  return tx(async (q) => {
    const [v] = await q.query<{ status: VisitorStatus; valid_until: Date | null }>("select status, valid_until from visitors where id = $1 and workspace_id = $2 for update", [id, workspaceId]);
    if (!v) return "not_found";
    const now = new Date();
    if (action === "approve" || action === "decline") {
      if (v.status !== "awaiting") return "bad_state";
      const until = action === "approve" ? istInstant(addDays(istDay(now), 1), 0) : null; // a pass is good until the end of the day
      await q.query("update visitors set status = $2, valid_until = $3, decided_at = $4 where id = $1", [id, action === "approve" ? "approved" : "declined", until, now]);
      return "ok";
    }
    if (action === "in") {
      if (v.status !== "approved" || (v.valid_until && v.valid_until < now)) return "bad_state";
      await q.query("update visitors set status = 'on_site', in_at = $2 where id = $1", [id, now]);
      return "ok";
    }
    if (v.status !== "on_site") return "bad_state";
    await q.query("update visitors set status = 'checked_out', out_at = $2 where id = $1", [id, now]);
    return "ok";
  });
}

/** A visitor's own pass link. Shows only what they entered and the decision. */
export async function getVisitorByToken(token: string) {
  if (!/^v[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const [r] = await query<VisitorRow & { business: string }>(
    `select v.id, v.name, v.phone, v.purpose, v.host, v.status, v.valid_until, v.in_at, v.out_at, v.created_at, nullif(q.config->>'place','') as place, w.name as business
       from visitors v join workspaces w on w.id = v.workspace_id left join qr_codes q on q.id = v.qr_id where v.token = $1`,
    [token],
  );
  if (!r) return null;
  const v = toVisitor(r);
  return { name: v.name, purpose: v.purpose, host: v.host, status: v.status, validUntil: v.validUntil, expired: v.expired, inAt: v.inAt, outAt: v.outAt, business: r.business, place: v.place };
}
