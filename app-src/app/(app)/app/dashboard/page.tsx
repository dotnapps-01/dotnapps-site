import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PathIcon } from "@/components/marketing/parts";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { ScanBars } from "@/components/analytics/charts";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { getAnalytics, locationScans, pctDelta, recentScans, resolveRange } from "@/lib/analytics";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { listQrCodes } from "@/lib/qr-repo";
import { typeLabel } from "@/lib/qr-types";
import { greeting, timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-IN");
const STATUS = { active: ["success", "ACTIVE"], paused: ["warning", "PAUSED"], expired: ["neutral", "EXPIRED"], draft: ["neutral", "DRAFT"], scheduled: ["info", "SCHEDULED"], archived: ["neutral", "ARCHIVED"] } as const;

export default async function DashboardPage() {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");

  const range = resolveRange("30d");
  const [a, codes, locs, recent] = await Promise.all([
    getAnalytics(ws.id, { range }),
    listQrCodes(ws.id),
    locationScans(ws.id),
    recentScans(ws.id, 6),
  ]);
  const live = codes.filter((c) => c.status !== "archived");
  const active = live.filter((c) => c.effective === "active");
  const top = [...live].sort((x, y) => y.scans30 - x.scans30).slice(0, 5);
  const dScans = pctDelta(a.scans, a.prevScans);
  const dUnique = pctDelta(a.unique, a.prevUnique);

  const setup = [
    { t: "Add your first location", done: Boolean(ws.locationName), href: "/app/settings" },
    { t: "Create your first QR", done: live.length > 0, href: "/app/studio" },
    { t: "Publish a QR code", done: active.length > 0, href: "/app/library" },
    { t: "Get your first scan", done: a.scans > 0 || live.some((c) => c.scans30 > 0), href: "/app/library" },
    { t: "Connect Google Business Profile", done: false, href: "/app/integrations", soon: true },
    { t: "Invite your team", done: false, href: "/app/settings", soon: true },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`${greeting()}, ${ws.businessName || "there"}`}
        actions={
          <Link href="/app/studio" className={buttonClasses({ variant: "primary" })}>
            <PathIcon d="M12 5v14M5 12h14" size={14} strokeWidth={2.2} />
            Create QR
          </Link>
        }
      />
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="Total scans · 30 days" value={fmt(a.scans)} delta={dScans?.text} tone={dScans?.dir === "down" ? "down" : dScans?.dir === "up" ? "up" : "flat"} />
          <KpiTile variant="cell" label="Unique visitors" value={fmt(a.unique)} delta={dUnique?.text} tone={dUnique?.dir === "down" ? "down" : dUnique?.dir === "up" ? "up" : "flat"} />
          <KpiTile variant="cell" label="Repeat rate" value={a.repeatRate === null ? "—" : `${a.repeatRate}%`} />
          <KpiTile variant="cell" label="Active QR codes" value={fmt(active.length)} delta={`${live.length} in total`} tone="flat" />
        </KpiStrip>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[2_1_560px]">
            <CardHeader>
              <CardTitle>Scans · last 30 days</CardTitle>
              <Link href="/app/analytics" className="tabular text-[11px] text-ink">
                OPEN ANALYTICS →
              </Link>
            </CardHeader>
            <ScanBars series={a.series} />
          </Card>
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Finish setting up</CardTitle>
              <span className="tabular text-[11px] text-ink">
                {doneCount} / {setup.length}
              </span>
            </CardHeader>
            <ul className="m-0 list-none p-0 py-1.5">
              {setup.map((s) => (
                <li key={s.t}>
                  <Link href={s.href} className="flex items-center gap-3 px-[18px] py-2.5 text-ink no-underline hover:bg-paper">
                    <span aria-hidden="true" className={cn("box-border flex h-[18px] w-[18px] flex-none items-center justify-center border-[1.5px]", s.done ? "border-ink bg-ink" : "border-faint bg-white")}>
                      {s.done ? <PathIcon d="M5 12l5 5 9-10" size={10} strokeWidth={3.4} className="text-white" /> : null}
                    </span>
                    <span className={cn("flex-1 text-[13.5px]", s.done ? "text-muted line-through" : "text-ink")}>
                      {s.t}
                      <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                    </span>
                    {s.soon ? <span className="tabular text-[10px] text-muted">SOON</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[2_1_560px]">
            <CardHeader>
              <CardTitle>Top QR codes</CardTitle>
              <Link href="/app/library" className="tabular text-[11px] text-ink">
                VIEW ALL →
              </Link>
            </CardHeader>
            {top.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-[18px]">
                <p className="m-0 text-sm text-graphite">You haven&rsquo;t created a QR code yet.</p>
                <Link href="/app/studio" className={buttonClasses({ size: "sm", variant: "primary" })}>
                  Create your first QR
                </Link>
              </div>
            ) : (
              <Table caption="Top QR codes by scans in the last 30 days">
                <TableHead>
                  <TableRow>
                    <Th>QR code</Th>
                    <Th>Type</Th>
                    <Th>Location</Th>
                    <Th>Scans</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {top.map((c) => (
                    <TableRow key={c.id}>
                      <Td className="font-semibold">{c.name}</Td>
                      <Td>
                        <Pill tone="info">{typeLabel(c.type).toUpperCase()}</Pill>
                      </Td>
                      <Td className="text-graphite">{c.locationName ?? "All locations"}</Td>
                      <Td className="tabular">{c.dynamic ? fmt(c.scans30) : "—"}</Td>
                      <Td>
                        <Pill tone={STATUS[c.effective][0]}>{STATUS[c.effective][1]}</Pill>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Recent scans</CardTitle>
            </CardHeader>
            {recent.length === 0 ? (
              <p className="m-0 p-[18px] text-sm text-graphite">Scans appear here as people scan your dynamic codes.</p>
            ) : (
              <ul className="m-0 list-none p-0 py-1">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 border-b border-line-soft px-[18px] py-2.5 last:border-b-0">
                    <div className="flex h-[30px] w-[30px] flex-none items-center justify-center bg-mist text-ink">
                      <PathIcon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z" size={15} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{r.qr}</div>
                      <div className="tabular text-[10.5px] text-muted">
                        {r.city ?? "Unknown city"} · {r.device === "iphone" ? "iPhone" : r.device === "android" ? "Android" : "Other device"} · {timeAgo(r.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
          </CardHeader>
          <Table caption="Scans per location in the last 30 days">
            <TableHead>
              <TableRow>
                <Th>Location</Th>
                <Th>QR codes</Th>
                <Th>Scans · 30 days</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {locs.length === 0 ? (
                <TableRow>
                  <Td colSpan={3} className="text-muted">
                    No locations yet.
                  </Td>
                </TableRow>
              ) : (
                locs.map((l) => (
                  <TableRow key={l.id}>
                    <Td className="font-semibold">{l.name}</Td>
                    <Td className="tabular">{fmt(l.codes)}</Td>
                    <Td className="tabular">{fmt(l.scans)}</Td>
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
