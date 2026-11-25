import "server-only";
import { query } from "@/lib/db";

import { TZ, fmtDay, type Interval, type Range } from "./analytics-range";
export * from "./analytics-range";

const IST_MS = 5.5 * 3_600_000;
const DAY = 86_400_000;
const ymd = (t: Date) =>
  `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;

export type AnalyticsOptions = { range: Range; qrId?: string | null; locationId?: string | null; interval?: Interval };

export type Analytics = {
  scans: number;
  unique: number;
  prevScans: number;
  prevUnique: number;
  repeatRate: number | null;
  prevRepeatRate: number | null;
  series: { date: string; label: string; scans: number }[];
  cities: { name: string; scans: number }[];
  devices: { name: string; scans: number }[];
  languages: { name: string; scans: number }[];
  /** [isoWeekday 1-7][hour 7..22] */
  heat: number[][];
  heatMax: number;
  byQr: { id: string; name: string; scans: number; unique: number; spark: number[] }[];
};

const uuidRe = /^[0-9a-f-]{36}$/i;

function filters(workspaceId: string, from: Date, to: Date, qrId: string | null, locationId: string | null) {
  const params: unknown[] = [workspaceId, from, to];
  let where = "s.workspace_id = $1 and s.scanned_at >= $2 and s.scanned_at < $3";
  if (qrId) {
    params.push(qrId);
    where += ` and s.qr_id = $${params.length}`;
  }
  if (locationId) {
    params.push(locationId);
    where += ` and q.location_id = $${params.length}`;
  }
  return { params, from: `from scans s join qr_codes q on q.id = s.qr_id where ${where}` };
}

export async function getAnalytics(workspaceId: string, opts: AnalyticsOptions): Promise<Analytics> {
  const { range } = opts;
  const unit: Interval = opts.interval ?? "day";
  const qrId = opts.qrId && uuidRe.test(opts.qrId) ? opts.qrId : null;
  const locationId = opts.locationId && uuidRe.test(opts.locationId) ? opts.locationId : null;

  const cur = filters(workspaceId, range.from, range.to, qrId, locationId);
  const span = range.to.getTime() - range.from.getTime();
  const prev = filters(workspaceId, new Date(range.from.getTime() - span), range.from, qrId, locationId);
  const sparkFrom = new Date(range.to.getTime() - 10 * DAY);
  const spark = filters(workspaceId, sparkFrom, range.to, qrId, locationId);
  const local = `s.scanned_at at time zone '${TZ}'`;

  const totals = (f: typeof cur) =>
    query<{ scans: number; uniq: number }>(`select count(*)::int as scans, count(distinct s.visitor)::int as uniq ${f.from}`, f.params);

  const [[c], [p], seriesRows, cityRows, deviceRows, langRows, heatRows, qrRows, sparkRows] = await Promise.all([
    totals(cur),
    totals(prev),
    query<{ d: string; n: number }>(
      `select to_char(date_trunc('${unit}', ${local}), 'YYYY-MM-DD') as d, count(*)::int as n ${cur.from} group by 1`,
      cur.params,
    ),
    query<{ name: string; n: number }>(`select coalesce(s.city, 'Unknown') as name, count(*)::int as n ${cur.from} group by 1 order by n desc, name`, cur.params),
    query<{ name: string; n: number }>(`select s.device as name, count(*)::int as n ${cur.from} group by 1 order by n desc`, cur.params),
    query<{ name: string; n: number }>(`select s.lang as name, count(*)::int as n ${cur.from} group by 1 order by n desc`, cur.params),
    query<{ dow: number; h: number; n: number }>(
      `select extract(isodow from ${local})::int as dow, extract(hour from ${local})::int as h, count(*)::int as n ${cur.from} group by 1, 2`,
      cur.params,
    ),
    query<{ id: string; name: string; scans: number; uniq: number }>(
      `select q.id, q.name, count(*)::int as scans, count(distinct s.visitor)::int as uniq ${cur.from} group by q.id, q.name order by scans desc, q.name limit 20`,
      cur.params,
    ),
    query<{ qr_id: string; d: string; n: number }>(
      `select s.qr_id, to_char(${local}, 'YYYY-MM-DD') as d, count(*)::int as n ${spark.from} group by 1, 2`,
      spark.params,
    ),
  ]);

  // fill every bucket in the range so quiet days show as zero
  const counts = new Map(seriesRows.map((r) => [r.d, r.n]));
  const series: Analytics["series"] = [];
  const startLocal = new Date(range.from.getTime() + IST_MS);
  let day = startLocal.getUTCDate();
  if (unit === "week") day -= (startLocal.getUTCDay() + 6) % 7; // back to Monday
  if (unit === "month") day = 1;
  const endLocal = range.to.getTime() + IST_MS;
  for (let cursor = Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), day); cursor < endLocal; ) {
    const dt = new Date(cursor);
    const key = ymd(dt);
    series.push({ date: key, label: fmtDay(key), scans: counts.get(key) ?? 0 });
    if (unit === "day") cursor += DAY;
    else if (unit === "week") cursor += 7 * DAY;
    else cursor = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
  }

  const top = (rows: { name: string; n: number }[], keep: number) => {
    const head = rows.slice(0, keep).map((r) => ({ name: r.name, scans: r.n }));
    const rest = rows.slice(keep).reduce((a, r) => a + r.n, 0);
    return rest > 0 ? [...head, { name: "Other", scans: rest }] : head;
  };

  const heat = Array.from({ length: 7 }, () => Array<number>(16).fill(0));
  for (const r of heatRows) if (r.h >= 7 && r.h <= 22) heat[r.dow - 1][r.h - 7] = r.n;

  const sparkDays = Array.from({ length: 10 }, (_, i) => ymd(new Date(sparkFrom.getTime() + i * DAY + IST_MS)));
  const sparkByQr = new Map<string, Map<string, number>>();
  for (const r of sparkRows) {
    if (!sparkByQr.has(r.qr_id)) sparkByQr.set(r.qr_id, new Map());
    sparkByQr.get(r.qr_id)!.set(r.d, r.n);
  }

  const rate = (s: number, u: number) => (s > 0 ? Math.round(((s - u) / s) * 1000) / 10 : null);
  return {
    scans: c.scans,
    unique: c.uniq,
    prevScans: p.scans,
    prevUnique: p.uniq,
    repeatRate: rate(c.scans, c.uniq),
    prevRepeatRate: rate(p.scans, p.uniq),
    series,
    cities: top(cityRows, 4),
    devices: top(deviceRows, 3),
    languages: top(langRows, 3),
    heat,
    heatMax: Math.max(0, ...heat.flat()),
    byQr: qrRows.map((r) => ({
      id: r.id,
      name: r.name,
      scans: r.scans,
      unique: r.uniq,
      spark: sparkDays.map((d) => sparkByQr.get(r.id)?.get(d) ?? 0),
    })),
  };
}

/** Raw scans for CSV export (capped). */
export async function exportScans(workspaceId: string, range: Range, qrId?: string | null, locationId?: string | null) {
  const f = filters(
    workspaceId,
    range.from,
    range.to,
    qrId && uuidRe.test(qrId) ? qrId : null,
    locationId && uuidRe.test(locationId) ? locationId : null,
  );
  return query<{ at: string; qr: string; city: string; device: string; lang: string }>(
    `select to_char(s.scanned_at at time zone '${TZ}', 'YYYY-MM-DD HH24:MI:SS') as at, q.name as qr,
            coalesce(s.city, 'Unknown') as city, s.device, s.lang
       ${f.from} order by s.scanned_at desc limit 50000`,
    f.params,
  );
}

/** Latest scans across the workspace, newest first. */
export async function recentScans(workspaceId: string, limit = 6) {
  return query<{ at: Date; qr: string; city: string | null; device: string }>(
    `select s.scanned_at as at, q.name as qr, s.city, s.device
       from scans s join qr_codes q on q.id = s.qr_id
      where s.workspace_id = $1 order by s.scanned_at desc limit $2`,
    [workspaceId, limit],
  );
}

/** Scans per location over the last 30 days (locations with no scans included). */
export async function locationScans(workspaceId: string) {
  return query<{ id: string; name: string; scans: number; codes: number }>(
    `select l.id, l.name,
            count(s.id)::int as scans,
            count(distinct q.id)::int as codes
       from locations l
       left join qr_codes q on q.location_id = l.id and q.status <> 'archived'
       left join scans s on s.qr_id = q.id and s.scanned_at > now() - interval '30 days'
      where l.workspace_id = $1
      group by l.id, l.name order by l.is_primary desc, l.name`,
    [workspaceId],
  );
}
