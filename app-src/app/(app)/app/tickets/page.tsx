import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/app/NoAccess";
import { can } from "@/lib/permissions";
import { resolveTabs } from "@/lib/tab-access";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { AssetManager } from "@/components/tickets/AssetManager";
import { NewTicketForm } from "@/components/tickets/NewTicketForm";
import { SlaForm } from "@/components/tickets/SlaForm";
import { TicketDetail } from "@/components/tickets/TicketDetail";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { slaText } from "@/lib/ops-input";
import { TICKET_CATEGORIES } from "@/lib/qr-types";
import { timeAgo } from "@/lib/time";
import { assetCounts, getSla, getTicket, listAssets, listTickets, recentServices, ticketStats, type TicketRecord } from "@/lib/tickets";

export const metadata: Metadata = { title: "Tickets & assets" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "tickets", label: "Tickets" },
  { key: "assets", label: "Assets" },
  { key: "visits", label: "Service visits" },
  { key: "sla", label: "SLA rules" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const TAB_NEED = { tickets: "work", assets: "build", visits: "work", sla: "build" } as const;
const SOURCE: Record<string, string> = { feedback_qr: "FEEDBACK QR", asset_qr: "ASSET QR", product_qr: "PRODUCT QR", manual: "MANUAL", review: "REVIEW" };
const dur = (min: number | null) => (min === null ? "—" : min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`);
const dmy = (d: string) => new Date(`${d}T06:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function statusPill(t: TicketRecord): { tone: PillTone; text: string } {
  if (t.status === "resolved") return { tone: "success", text: "RESOLVED" };
  if (t.breached) return { tone: "danger", text: "BREACHED" };
  return t.status === "in_progress" ? { tone: "info", text: "IN PROGRESS" } : { tone: "warning", text: "OPEN" };
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ticket?: string; scope?: string; category?: string; new?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const access = resolveTabs(TABS, TAB_NEED, ws.role, sp.tab, "tickets");
  if (access.denied) return <NoAccess role={ws.role} need={access.denied} />;
  const tab = access.tab as Tab;
  const scope = sp.scope === "resolved" || sp.scope === "all" ? sp.scope : "active";
  const category = TICKET_CATEGORIES.includes(sp.category ?? "") ? sp.category : undefined;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const [stats, counts, tickets, assets, services, sla, activeCount] = await Promise.all([
    ticketStats(ws.id),
    assetCounts(ws.id),
    tab === "tickets" ? listTickets(ws.id, { scope, category }) : Promise.resolve([] as TicketRecord[]),
    tab === "assets" ? listAssets(ws.id) : Promise.resolve([]),
    tab === "visits" ? recentServices(ws.id) : Promise.resolve([]),
    getSla(ws.id),
    listTickets(ws.id, { scope: "active", limit: 1 }).then((r) => r.length),
  ]);
  void activeCount;
  const selected = tab === "tickets" ? await getTicket(ws.id, sp.ticket && tickets.some((t) => t.id === sp.ticket) ? sp.ticket : (tickets[0]?.id ?? "")) : null;

  const tabCount: Record<Tab, number> = { tickets: stats.open, assets: counts.assets, visits: counts.services, sla: 3 };
  const showNew = sp.new === "1";

  return (
    <>
      <PageHeader
        eyebrow="Operate"
        title="Tickets & asset service"
        actions={
          <>
            {can(ws.role, "build") ? (
              <>
                <Link href="/app/tickets?tab=assets" className={buttonClasses()}>
                  Add asset
                </Link>
                <Link href="/app/tickets?tab=sla" className={buttonClasses()}>
                  SLA rules
                </Link>
              </>
            ) : null}
            <Link href="/app/tickets?new=1" className={buttonClasses({ variant: "primary" })}>
              New ticket
            </Link>
          </>
        }
      />
      <nav aria-label="Ticket sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {access.visible.map((t) => (
          <Link
            key={t.key}
            href={t.key === "tickets" ? "/app/tickets" : `/app/tickets?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
            <span className="tabular text-[11px] text-muted">{tabCount[t.key]}</span>
          </Link>
        ))}
      </nav>
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="Open" value={stats.open} delta={`${stats.newToday} new today`} tone="flat" />
          <KpiTile variant="cell" label="Breaching SLA" value={stats.breaching} delta={stats.breaching ? "needs attention" : "none right now"} tone={stats.breaching ? "down" : "flat"} />
          <KpiTile variant="cell" label="Avg resolution" value={dur(stats.avgResolutionMin)} delta="last 30 days" tone="flat" />
          <KpiTile variant="cell" label="Resolved (30d)" value={stats.resolved30} delta={stats.withinSla30 === null ? "—" : `${stats.withinSla30}% within SLA`} tone={stats.withinSla30 !== null && stats.withinSla30 >= 90 ? "up" : "flat"} />
          <KpiTile variant="cell" label="Customer CSAT" value="—" delta="Needs WhatsApp" tone="flat" />
        </KpiStrip>

        {showNew && tab === "tickets" ? (
          <Card>
            <CardHeader>
              <CardTitle>New ticket</CardTitle>
            </CardHeader>
            <NewTicketForm />
          </Card>
        ) : null}

        {tab === "tickets" && (
          <div className="flex flex-wrap items-start gap-5">
            <Card className="flex-[2_1_560px]">
              <CardHeader>
                <CardTitle>{scope === "resolved" ? "Resolved tickets" : scope === "all" ? "All tickets" : "Open tickets"}</CardTitle>
                <form className="flex flex-wrap items-end gap-1.5" aria-label="Filter tickets">
                  <Select label="Status" hideLabel name="scope" defaultValue={scope} wrapperClassName="w-auto" className="min-h-9 text-sm">
                    <option value="active">Open &amp; in progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="all">All</option>
                  </Select>
                  <Select label="Category" hideLabel name="category" defaultValue={category ?? ""} wrapperClassName="w-auto" className="min-h-9 text-sm">
                    <option value="">All categories</option>
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm">
                    Filter
                  </Button>
                </form>
              </CardHeader>
              <Table caption="Tickets">
                <TableHead>
                  <TableRow>
                    <Th>Ticket</Th>
                    <Th>Source</Th>
                    <Th>Location</Th>
                    <Th>Assignee</Th>
                    <Th>SLA</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <Td colSpan={6} className="text-muted">
                        No tickets here. They appear when customers scan a Feedback or Asset QR code, or when you add one.
                      </Td>
                    </TableRow>
                  ) : (
                    tickets.map((t) => {
                      const s = statusPill(t);
                      const left = slaText(new Date(t.dueAt));
                      return (
                        <TableRow key={t.id} className={cn(t.breached && t.status !== "resolved" && "bg-danger-bg/30", selected?.ticket.id === t.id && "bg-paper")}>
                          <Td>
                            <Link href={`/app/tickets?ticket=${t.id}${scope !== "active" ? `&scope=${scope}` : ""}`} aria-current={selected?.ticket.id === t.id ? "true" : undefined} className="font-semibold text-ink no-underline hover:underline">
                              {`#${t.seq} · ${t.title}`}
                            </Link>
                            <div className="tabular mt-0.5 text-[11px] text-muted">{timeAgo(new Date(t.createdAt))}</div>
                          </Td>
                          <Td>
                            <Pill>{SOURCE[t.source] ?? t.source.toUpperCase()}</Pill>
                          </Td>
                          <Td>{t.assetName || t.place || "—"}</Td>
                          <Td>{t.assignee || "—"}</Td>
                          <Td className={cn("tabular font-semibold", t.status !== "resolved" && left.breached ? "text-danger-fg" : "text-ink")}>{t.status === "resolved" ? "—" : left.text}</Td>
                          <Td>
                            <Pill tone={s.tone}>{s.text}</Pill>
                          </Td>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
            {selected ? <TicketDetail key={selected.ticket.id} ticket={selected.ticket} events={selected.events} origin={origin} slaText={slaText(new Date(selected.ticket.dueAt)).text} /> : null}
          </div>
        )}

        {tab === "assets" && <AssetManager assets={assets} />}

        {tab === "visits" && (
          <Card>
            <CardHeader>
              <CardTitle>Service visits</CardTitle>
              <span className="tabular text-[11px] text-muted">{`${counts.assets} ASSETS · ${counts.dueThisWeek} DUE THIS WEEK${counts.overdue ? ` · ${counts.overdue} OVERDUE` : ""}`}</span>
            </CardHeader>
            <Table caption="Service visits">
              <TableHead>
                <TableRow>
                  <Th>Date</Th>
                  <Th>Asset</Th>
                  <Th>Serviced by</Th>
                  <Th>What was done</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <Td colSpan={4} className="text-muted">
                      No visits logged yet. Use “Log service” on an asset.
                    </Td>
                  </TableRow>
                ) : (
                  services.map((s) => (
                    <TableRow key={s.id}>
                      <Td className="tabular">{dmy(s.servicedOn)}</Td>
                      <Td>
                        <div className="font-semibold">{s.assetName}</div>
                        <div className="tabular text-[11px] text-muted">{s.code}</div>
                      </Td>
                      <Td>{s.byName || "—"}</Td>
                      <Td className="max-w-[420px] whitespace-normal">{s.notes || "—"}</Td>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
              A technician page with a checklist, before/after photos and a customer OTP to close needs photo storage and WhatsApp, so it isn&rsquo;t built yet.
            </p>
          </Card>
        )}

        {tab === "sla" && (
          <Card className="max-w-[720px]">
            <CardHeader>
              <CardTitle>SLA rules</CardTitle>
            </CardHeader>
            <SlaForm sla={sla} />
          </Card>
        )}
      </PageBody>
    </>
  );
}
