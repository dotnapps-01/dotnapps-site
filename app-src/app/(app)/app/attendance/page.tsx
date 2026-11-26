import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { PointManager } from "@/components/attendance/PointManager";
import { RulesForm } from "@/components/attendance/RulesForm";
import { VisitorLog } from "@/components/attendance/VisitorLog";
import { WorkerManager } from "@/components/attendance/WorkerManager";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { awaitingVisitors, getLateAfter, listPoints, listVisitors, listWorkers, todayBoard, type BoardRow } from "@/lib/attendance";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { istDay } from "@/lib/ops-input";
import { initialsOf } from "@/lib/pages";

export const metadata: Metadata = { title: "Attendance & visitors" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "today", label: "Today" },
  { key: "staff", label: "Staff" },
  { key: "labour", label: "Labour" },
  { key: "visitors", label: "Visitors" },
  { key: "points", label: "Check-in points & rules" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "—");
const dayText = (d: string) => new Date(`${d}T06:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const STATUS: Record<BoardRow["status"], { tone: PillTone; text: (r: BoardRow) => string }> = {
  present: { tone: "success", text: () => "PRESENT" },
  late: { tone: "warning", text: (r) => `LATE · ${r.lateMin} MIN` },
  absent: { tone: "danger", text: () => "ABSENT" },
  expected: { tone: "neutral", text: () => "EXPECTED" },
  checked_out: { tone: "neutral", text: () => "CHECKED OUT" },
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string; q?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "today";
  const month = istDay().slice(0, 7);

  const [board, awaiting, workers, points, visitors, lateAfter] = await Promise.all([
    todayBoard(ws.id),
    awaitingVisitors(ws.id),
    tab === "staff" || tab === "labour" ? listWorkers(ws.id, { kind: tab, includeInactive: true }) : Promise.resolve([]),
    tab === "points" ? listPoints(ws.id) : Promise.resolve([]),
    tab === "visitors" || tab === "today" ? listVisitors(ws.id) : Promise.resolve([]),
    getLateAfter(ws.id),
  ]);
  const today = istDay();
  const visitorsToday = visitors.filter((v) => istDay(new Date(v.createdAt)) === today).length;
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = q ? board.rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) : board.rows;

  return (
    <>
      <PageHeader
        eyebrow="Operate"
        title="Attendance & visitors"
        actions={
          <>
            <Link href="/app/attendance?tab=staff&new=1" className={buttonClasses()}>
              Add worker
            </Link>
            <a href={`/api/attendance/export?month=${month}`} className={buttonClasses({ variant: "primary" })}>
              Export payroll CSV
            </a>
          </>
        }
      />
      <nav aria-label="Attendance sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "today" ? "/app/attendance" : `/app/attendance?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
            {t.key === "visitors" && awaiting > 0 ? <span className="tabular text-[11px] text-warning-fg">{`${awaiting} awaiting`}</span> : null}
          </Link>
        ))}
      </nav>
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="On site now" value={board.onSite} delta={`of ${board.scheduled} scheduled`} tone="flat" />
          <KpiTile variant="cell" label="Late today" value={board.late} delta={`after ${lateAfter} min grace`} tone={board.late ? "warn" : "flat"} />
          <KpiTile variant="cell" label="Absent" value={board.absent} delta="past shift start" tone={board.absent ? "down" : "flat"} />
          <KpiTile variant="cell" label="Overtime (week)" value={`${board.overtimeHoursWeek}h`} delta={`${board.overtimeWorkers} worker${board.overtimeWorkers === 1 ? "" : "s"}`} tone="flat" />
          <KpiTile variant="cell" label="Visitors today" value={visitorsToday} delta={`${awaiting} awaiting approval`} tone={awaiting ? "warn" : "flat"} />
        </KpiStrip>

        {tab === "today" && (
          <div className="flex flex-wrap items-start gap-5">
            <Card className="flex-[2_1_560px]">
              <CardHeader>
                <CardTitle>{`Today · ${dayText(board.day)}`}</CardTitle>
                <form role="search" aria-label="Search workers" className="flex gap-1.5">
                  <label className="sr-only" htmlFor="ws">
                    Search workers
                  </label>
                  <input id="ws" name="q" defaultValue={sp.q ?? ""} type="search" placeholder="Search name or ID" className="min-h-9 w-[200px] max-w-full rounded-input border border-line bg-white px-3 text-sm" />
                </form>
              </CardHeader>
              <Table caption="Today's attendance">
                <TableHead>
                  <TableRow>
                    <Th>Worker</Th>
                    <Th>Role</Th>
                    <Th>Check-in</Th>
                    <Th>Check-out</Th>
                    <Th>Verified</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <Td colSpan={6} className="text-muted">
                        {board.scheduled === 0 ? "No workers yet. Add staff or labour, then put a check-in QR where they arrive." : "No one matches."}
                      </Td>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.workerId}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-info-bg text-[11px] font-semibold">
                              {initialsOf(r.name)}
                            </div>
                            <div>
                              <div className="font-semibold">{r.name}</div>
                              <div className="tabular text-[11px] text-muted">{r.code}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>{r.role || "—"}</Td>
                        <Td className="tabular">{hm(r.inAt)}</Td>
                        <Td className="tabular">{hm(r.outAt)}</Td>
                        <Td className={cn("text-xs", r.verified ? "text-success-fg" : "text-muted")}>{r.inAt ? (r.verified ? `✓ Location${r.distM !== null ? ` · ${r.distM} m` : ""}` : "— No location check") : "—"}</Td>
                        <Td>
                          <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].text(r)}</Pill>
                        </Td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
                Workers check in with their ID and the last 4 digits of their number, and the phone&rsquo;s location is checked against the point. Selfie check-in needs photo storage, so it isn&rsquo;t built yet.
              </p>
            </Card>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Visitors waiting</CardTitle>
                  <Link href="/app/attendance?tab=visitors" className="text-[13px] font-semibold">
                    Open log →
                  </Link>
                </CardHeader>
                <p className="m-0 p-[18px] text-sm text-graphite">{awaiting ? `${awaiting} visitor${awaiting === 1 ? " is" : "s are"} waiting for approval.` : "No one is waiting for approval."}</p>
              </Card>
            </div>
          </div>
        )}

        {(tab === "staff" || tab === "labour") && <WorkerManager workers={workers} kind={tab} startOpen={sp.new === "1"} />}

        {tab === "visitors" && (
          <Card>
            <CardHeader>
              <CardTitle>Visitor log</CardTitle>
              {awaiting ? <Pill tone="warning">{`${awaiting} AWAITING APPROVAL`}</Pill> : null}
            </CardHeader>
            <VisitorLog visitors={visitors} />
            <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
              You approve passes here. Telling the host on WhatsApp needs Integrations. A pass is good until the end of the day.
            </p>
          </Card>
        )}

        {tab === "points" && (
          <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-[2_1_480px]">
              <PointManager points={points} />
            </div>
            <div className="min-w-0 flex-[1_1_320px]">
              <RulesForm lateAfterMin={lateAfter} />
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
