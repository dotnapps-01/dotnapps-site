/** Date-range and formatting helpers with no database access, so client components can import them. */

/** Everything is bucketed in Indian Standard Time, the zone these businesses run in. */
export const TZ = "Asia/Kolkata";
const IST_MS = 5.5 * 3_600_000;
const DAY = 86_400_000;

export type RangeKey = "7d" | "30d" | "month";
export type Interval = "day" | "week" | "month";
export type Range = { key: RangeKey; from: Date; to: Date; label: string };

export const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

/** Midnight IST (as a UTC instant) of the IST calendar day containing `d`. */
function istDayStart(d: Date): Date {
  const local = new Date(d.getTime() + IST_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - IST_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
const istParts = (d: Date) => {
  const l = new Date(d.getTime() + IST_MS);
  return { d: l.getUTCDate(), m: MONTHS[l.getUTCMonth()], y: l.getUTCFullYear() };
};

export function resolveRange(key: string | undefined, now = new Date()): Range {
  const k: RangeKey = key === "7d" || key === "month" ? key : "30d";
  const to = new Date(istDayStart(now).getTime() + DAY); // end of today, exclusive
  let from: Date;
  if (k === "month") {
    const l = new Date(now.getTime() + IST_MS);
    from = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - IST_MS);
  } else {
    from = new Date(to.getTime() - (k === "7d" ? 7 : 30) * DAY);
  }
  const a = istParts(from);
  const b = istParts(new Date(to.getTime() - 1));
  return { key: k, from, to, label: `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}` };
}


/** "▲ 18%" / "▼ 4%" style delta against the previous period, or null when there's nothing to compare. */
export function pctDelta(cur: number, prev: number): { text: string; dir: "up" | "down" | "flat" } | null {
  if (prev <= 0) return cur > 0 ? { text: "New", dir: "up" } : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "No change", dir: "flat" };
  return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, dir: pct > 0 ? "up" : "down" };
}

