import { cn } from "@/lib/cn";
import type { Analytics } from "@/lib/analytics";

const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

/** Bars of scans per bucket, with a screen-reader table underneath. */
export function ScanBars({ series, className }: { series: Analytics["series"]; className?: string }) {
  const max = Math.max(1, ...series.map((s) => s.scans));
  const total = series.reduce((a, s) => a + s.scans, 0);
  const peak = series.reduce((a, s) => (s.scans > a.scans ? s : a), series[0] ?? { label: "", scans: 0 });
  const mid = series[Math.floor(series.length / 2)];
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`Bar chart of scans over time: ${fmt(total)} in total${total > 0 ? `, busiest ${peak.label} with ${fmt(peak.scans)}` : ""}.`}
        className="box-content flex h-[200px] items-end gap-[3px] px-[18px] pb-3 pt-5"
        style={{ backgroundImage: "linear-gradient(#F1F1F3 1px, transparent 1px)", backgroundSize: "100% 50px", backgroundOrigin: "content-box", backgroundClip: "content-box" }}
      >
        {series.map((s) => (
          <div key={s.date} title={`${s.label}: ${fmt(s.scans)} scans`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="bg-ink" style={{ height: s.scans === 0 ? 1 : `${Math.max(2, (s.scans / max) * 100)}%`, opacity: s.scans === 0 ? 0.25 : 1 }} />
          </div>
        ))}
      </div>
      <div className="tabular flex justify-between px-[18px] pb-4 text-[10px] text-muted" aria-hidden="true">
        <span>{series[0]?.label}</span>
        <span>{mid?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
      <table className="sr-only">
        <caption>Scans over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Scans</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}>
              <th scope="row">{s.label}</th>
              <td>{s.scans}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One horizontal bar per label (funnel and top cities). */
export function BarRows({ rows, labelWidth = "110px" }: { rows: { name: string; value: number; display?: string; color?: string }[]; labelWidth?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((r) => (
        <li key={r.name} className="grid items-center gap-2.5 text-[13px]" style={{ gridTemplateColumns: `${labelWidth} 1fr 56px` }}>
          <span className="truncate">{r.name}</span>
          <div className="h-2.5 bg-mist">
            <div className="h-2.5" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "#0E0E10" }} />
          </div>
          <span className="tabular text-right">{r.display ?? fmt(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

const palette = ["#0E0E10", "#3D3D45", "#CDBDFF", "#D6D6DC"];

/** One stacked bar with a legend (device and language splits). */
export function StackBar({ title, parts, names }: { title: string; parts: { name: string; scans: number }[]; names: Record<string, string> }) {
  const total = parts.reduce((a, p) => a + p.scans, 0);
  const shown = parts.map((p, i) => ({ label: names[p.name] ?? p.name, share: pct(p.scans, total), color: p.name === "other" || p.name === "Other" ? "#D6D6DC" : palette[i % 3] }));
  return (
    <div>
      <div className="k mb-2">{title}</div>
      <div className="flex h-7 bg-mist" role="img" aria-label={total ? shown.map((s) => `${s.label} ${Math.round(s.share)}%`).join(", ") : `No ${title.toLowerCase()} data yet`}>
        {shown.map((s) => (
          <div key={s.label} title={`${s.label} ${Math.round(s.share)}%`} style={{ width: `${s.share}%`, background: s.color }} />
        ))}
      </div>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0">
        {total === 0 ? (
          <li className="text-xs text-muted">No scans yet</li>
        ) : (
          shown.map((s) => (
            <li key={s.label} className="tabular flex items-center gap-1.5 text-[11px]">
              <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: s.color }} />
              {s.label} {Math.round(s.share)}%
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday x hour (7am to 10pm) heatmap. */
export function Heatmap({ heat, max }: { heat: number[][]; max: number }) {
  let best = { d: 0, h: 0, n: 0 };
  heat.forEach((row, d) => row.forEach((n, h) => n > best.n && (best = { d, h, n })));
  const hour = (h: number) => `${((h + 7 + 11) % 12) + 1}${h + 7 < 12 ? "am" : "pm"}`;
  return (
    <div className="flex flex-col gap-[3px] px-[18px] py-4">
      <div
        role="img"
        aria-label={max > 0 ? `Heatmap of scans by weekday and hour. Busiest: ${DAYS[best.d]} around ${hour(best.h)} with ${best.n} scans.` : "Heatmap of scans by weekday and hour. No scans yet."}
        className="flex flex-col gap-[3px]"
      >
        {heat.map((row, d) => (
          <div key={DAYS[d]} className="grid items-center gap-[3px]" style={{ gridTemplateColumns: "34px repeat(16, minmax(0, 1fr))" }}>
            <span className="tabular text-[10px] text-muted">{DAYS[d]}</span>
            {row.map((n, h) => (
              <div key={h} title={`${DAYS[d]} ${hour(h)}: ${n} scans`} className="aspect-square bg-ink" style={{ opacity: max > 0 ? Math.max(0.08, n / max) : 0.08 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="tabular mt-1 flex justify-between pl-[37px] text-[10px] text-muted" aria-hidden="true">
        <span>7am</span>
        <span>3pm</span>
        <span>10pm</span>
      </div>
    </div>
  );
}

export function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-[22px] items-end gap-0.5" role="img" aria-label={`Last ${values.length} days: ${values.join(", ")} scans`}>
      {values.map((v, i) => (
        <div key={i} className={cn("w-[5px] bg-ink")} style={{ height: v === 0 ? 2 : Math.max(3, (v / max) * 22), opacity: v === 0 ? 0.25 : 1 }} />
      ))}
    </div>
  );
}
