import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { BarRows, Heatmap, ScanBars, Spark, StackBar } from "@/components/analytics/charts";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile, type KpiTone } from "@/components/ui/KpiTile";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { getAnalytics, pctDelta, resolveRange, type Interval } from "@/lib/analytics";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { listLocations, listQrCodes } from "@/lib/qr-repo";
import { reviewActionsByQr } from "@/lib/reviews";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

type SP = { range?: string; interval?: string; qr?: string; location?: string };
const fmt = (n: number) => n.toLocaleString("en-IN");
const tone = (d: "up" | "down" | "flat"): KpiTone => (d === "up" ? "up" : d === "down" ? "down" : "flat");

const DEVICE = { android: "Android", iphone: "iPhone", other: "Other" };
const LANG = { en: "English", ta: "Tamil", hi: "Hindi", other: "Other" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const range = resolveRange(sp.range);
  const interval: Interval = sp.interval === "week" || sp.interval === "month" ? sp.interval : "day";

  const [codes, locations] = await Promise.all([listQrCodes(ws.id), listLocations(ws.id)]);
  const qrCodes = codes.filter((c) => c.dynamic && c.status !== "archived").map((c) => ({ id: c.id, name: c.name }));
  const qr = qrCodes.some((c) => c.id === sp.qr) ? sp.qr! : "";
  const location = locations.some((l) => l.id === sp.location) ? sp.location! : "";

  const [a, actions] = await Promise.all([getAnalytics(ws.id, { range, qrId: qr, locationId: location, interval }), reviewActionsByQr(ws.id, range.from, range.to)]);
  const totalActions = a.byQr.reduce((n, r) => n + (actions.get(r.id)?.ratings ?? 0), 0);
  const dScans = pctDelta(a.scans, a.prevScans);
  const dUnique = pctDelta(a.unique, a.prevUnique);
  const repeatDelta =
    a.repeatRate !== null && a.prevRepeatRate !== null
      ? (() => {
          const diff = Math.round((a.repeatRate - a.prevRepeatRate) * 10) / 10;
          return { text: diff === 0 ? "No change" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} pts`, dir: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("flat" as const) };
        })()
      : null;

  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries({ range: range.key, qr, location })) if (v) keep.set(k, v);
  const intervalHref = (i: Interval) => `/app/analytics?${new URLSearchParams({ ...Object.fromEntries(keep), interval: i })}`;
  const exportHref = `/app/analytics/export?${keep}`;

  const repeat = Math.max(0, a.scans - a.unique);
  const funnel = [
    { name: "Scans", value: a.scans, display: fmt(a.scans), color: "#0E0E10" },
    { name: "Unique visitors", value: a.unique, display: fmt(a.unique), color: "#3D3D45" },
    { name: "Repeat scans", value: repeat, display: fmt(repeat), color: "#5B45B8" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Analytics"
        actions={
          <>
            <AnalyticsFilters qrCodes={qrCodes} locations={locations} qr={qr} location={location} range={range.key} />
            <Button disabled title="Scheduled reports arrive with email delivery">
              Schedule report
            </Button>
            <a href={exportHref} className={buttonClasses({ variant: "primary" })}>
              Export CSV
            </a>
          </>
        }
      />
      <PageBody>
        <p className="tabular m-0 -mb-2 text-xs text-muted">
          {range.label} · changes compare with the previous period of the same length · times in IST
        </p>

        {a.scans === 0 ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold">No scans in this period yet</div>
              <div className="text-sm text-graphite">Scans appear here as soon as someone scans a dynamic QR code. Static codes can&rsquo;t be counted.</div>
            </div>
            <Link href={codes.length ? "/app/library" : "/app/studio"} className={buttonClasses({ size: "sm" })}>
              {codes.length ? "Open library" : "Create a QR code"}
            </Link>
          </div>
        ) : null}

        <KpiStrip>
          <KpiTile variant="cell" label="Scans" value={fmt(a.scans)} delta={dScans?.text} tone={dScans ? tone(dScans.dir) : "flat"} />
          <KpiTile variant="cell" label="Unique" value={fmt(a.unique)} delta={dUnique?.text} tone={dUnique ? tone(dUnique.dir) : "flat"} />
          <KpiTile variant="cell" label="Repeat rate" value={a.repeatRate === null ? "—" : `${a.repeatRate}%`} delta={repeatDelta?.text} tone={repeatDelta ? tone(repeatDelta.dir) : "flat"} />
          <KpiTile variant="cell" label="Actions taken" value={totalActions ? fmt(totalActions) : "—"} delta={totalActions ? "Ratings given on review pages" : "Starts with review pages"} tone="flat" />
          <KpiTile variant="cell" label="Avg time on page" value="—" delta="Needs Engage modules" tone="flat" />
        </KpiStrip>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[2_1_560px]">
            <CardHeader>
              <CardTitle>Scans over time</CardTitle>
              <nav aria-label="Interval" className="flex border border-line">
                {(["day", "week", "month"] as const).map((i) => (
                  <Link
                    key={i}
                    href={intervalHref(i)}
                    aria-current={interval === i ? "true" : undefined}
                    className={cn("tabular flex min-h-8 items-center px-2.5 text-[11px] no-underline", interval === i ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mist")}
                  >
                    {i.toUpperCase()}
                  </Link>
                ))}
              </nav>
            </CardHeader>
            <ScanBars series={a.series} />
          </Card>
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Scan funnel</CardTitle>
              <span className="tabular text-[11px] text-muted">{qr ? "THIS CODE" : "ALL CODES"}</span>
            </CardHeader>
            <div className="flex flex-col gap-3.5 p-[18px]">
              {funnel.map((f) => (
                <div key={f.name}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span>{f.name}</span>
                    <span className="tabular">{f.display}</span>
                  </div>
                  <div className="h-[26px] bg-mist">
                    <div className="h-[26px]" style={{ width: `${a.scans ? (f.value / a.scans) * 100 : 0}%`, background: f.color }} />
                  </div>
                </div>
              ))}
              <p className="m-0 text-xs leading-[1.5] text-muted">Actions from review pages count in the KPI and table. Leads, offers and other modules join as they launch.</p>
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Top cities</CardTitle>
            </CardHeader>
            <div className="px-[18px] py-4">
              {a.cities.length ? (
                <BarRows rows={a.cities.map((c) => ({ name: c.name, value: c.scans }))} />
              ) : (
                <p className="m-0 text-sm text-muted">No scans yet.</p>
              )}
              {a.cities.length === 1 && a.cities[0].name === "Unknown" ? (
                <p className="m-0 mt-3 text-xs text-muted">City comes from the visitor&rsquo;s network location, which your hosting provider has to supply.</p>
              ) : null}
            </div>
          </Card>
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Devices &amp; language</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-[18px] p-[18px]">
              <StackBar title="Device" parts={a.devices} names={DEVICE} />
              <StackBar title="Browser language" parts={a.languages} names={LANG} />
            </div>
          </Card>
          <Card className="flex-[1_1_360px]">
            <CardHeader>
              <CardTitle>Busiest times</CardTitle>
              <span className="tabular text-[11px] text-muted">SCANS / HOUR</span>
            </CardHeader>
            <Heatmap heat={a.heat} max={a.heatMax} />
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance by QR code</CardTitle>
            <Link href="/app/library" className="tabular text-[11px] text-ink">
              OPEN LIBRARY →
            </Link>
          </CardHeader>
          <Table caption="Performance by QR code">
            <TableHead>
              <TableRow>
                <Th>QR code</Th>
                <Th>Scans</Th>
                <Th>Unique</Th>
                <Th>Actions</Th>
                <Th>Conversion</Th>
                <Th>Trend (10 days)</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {a.byQr.length === 0 ? (
                <TableRow>
                  <Td colSpan={6} className="text-muted">
                    No scans in this period.
                  </Td>
                </TableRow>
              ) : (
                a.byQr.map((r) => (
                  <TableRow key={r.id}>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td className="tabular">{fmt(r.scans)}</Td>
                    <Td className="tabular">{fmt(r.unique)}</Td>
                    <Td className={actions.get(r.id) ? "text-graphite" : "text-muted"}>
                      {actions.get(r.id) ? `${fmt(actions.get(r.id)!.ratings)} ratings · ${fmt(actions.get(r.id)!.google)} to Google` : "—"}
                    </Td>
                    <Td className={cn("tabular", !actions.get(r.id) && "text-muted")}>{actions.get(r.id) && r.scans ? `${Math.round((actions.get(r.id)!.ratings / r.scans) * 1000) / 10}%` : "—"}</Td>
                    <Td>
                      <Spark values={r.spark} />
                    </Td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}
