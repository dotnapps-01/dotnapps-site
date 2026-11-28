import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/app/NoAccess";
import { can } from "@/lib/permissions";
import { resolveTabs } from "@/lib/tab-access";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { BookingRow, BOOKING_PILL } from "@/components/bookings/BookingRow";
import { EventManager } from "@/components/bookings/EventManager";
import { GateScanner } from "@/components/bookings/GateScanner";
import { ServiceManager } from "@/components/bookings/ServiceManager";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { currentWorkspace } from "@/lib/auth/current";
import { bookingStats, getHours, listBookings, listItems } from "@/lib/bookings";
import { cn } from "@/lib/cn";
import { addDays, istDay, istDow, istInstant, istMinutes, validDay, clock12 } from "@/lib/ops-input";

export const metadata: Metadata = { title: "Bookings & events" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "calendar", label: "Calendar" },
  { key: "bookings", label: "Bookings" },
  { key: "events", label: "Events & tickets" },
  { key: "services", label: "Services & hours" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const TAB_NEED = { calendar: "work", bookings: "work", events: "build", services: "build" } as const;
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHIP = ["bg-mist text-ink", "bg-[#FBE3EF] text-ink", "bg-ink text-white"];
const mondayOf = (day: string) => addDays(day, -((istDow(day) + 6) % 7));
const rangeText = (a: string, b: string) => {
  const f = (d: string, y = false) => new Date(`${d}T06:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}), timeZone: "Asia/Kolkata" });
  return `${f(a)} – ${f(b, true)}`;
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string; new?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const access = resolveTabs(TABS, TAB_NEED, ws.role, sp.tab, "calendar");
  if (access.denied) return <NoAccess role={ws.role} need={access.denied} />;
  const tab = access.tab as Tab;
  const today = istDay();
  const monday = mondayOf(validDay(sp.week) ?? today);
  const sunday = addDays(monday, 6);

  const [stats, hours, items, week, all] = await Promise.all([
    bookingStats(ws.id),
    getHours(ws.id),
    listItems(ws.id),
    tab === "calendar" ? listBookings(ws.id, { from: istInstant(monday, 0), to: istInstant(addDays(monday, 7), 0), limit: 500 }) : Promise.resolve([]),
    tab === "bookings" ? listBookings(ws.id, { limit: 200 }) : Promise.resolve([]),
  ]);
  const services = items.filter((i) => i.kind === "service");
  const events = items.filter((i) => i.kind === "event");
  const colorOf = (id: string, kind: string) => (kind === "event" ? CHIP[2] : CHIP[services.findIndex((s) => s.id === id) % 2 === 0 ? 0 : 1]);

  // calendar rows: the hours the business is open, widened to fit any booking that falls outside them
  const live = week.filter((b) => b.status !== "cancelled");
  const open = hours.filter((h) => !h.closed);
  let first = open.length ? Math.min(...open.map((h) => Math.floor(h.open / 60))) : 10;
  let last = open.length ? Math.max(...open.map((h) => Math.ceil(h.close / 60))) : 18;
  for (const b of live) {
    const h = Math.floor(istMinutes(new Date(b.startsAt)) / 60);
    first = Math.min(first, h);
    last = Math.max(last, h + 1);
  }
  const hoursList = Array.from({ length: Math.max(1, last - first) }, (_, i) => first + i);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const upToday = (tab === "calendar" ? live : []).filter((b) => istDay(new Date(b.startsAt)) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextEvent = events.find((e) => e.startsAt && new Date(e.startsAt).getTime() > new Date().getTime() - 6 * 3_600_000);
  const hm = (iso: string) => clock12(istMinutes(new Date(iso)));

  return (
    <>
      <PageHeader
        eyebrow="Operate"
        title="Bookings & events"
        actions={
          <>
            {can(ws.role, "build") ? (
              <>
                <Link href="/app/bookings?tab=services" className={buttonClasses()}>
                  Services &amp; hours
                </Link>
                <Link href="/app/bookings?tab=events&new=1" className={buttonClasses()}>
                  New event
                </Link>
                <Link href="/app/bookings?tab=services&new=1" className={buttonClasses({ variant: "primary" })}>
                  New service
                </Link>
              </>
            ) : null}
          </>
        }
      />
      <nav aria-label="Booking sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {access.visible.map((t) => (
          <Link
            key={t.key}
            href={t.key === "calendar" ? "/app/bookings" : `/app/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
            {t.key === "bookings" && stats.pending > 0 ? <span className="tabular text-[11px] text-warning-fg">{`${stats.pending} pending`}</span> : null}
          </Link>
        ))}
      </nav>
      <PageBody>
        {tab === "calendar" && (
          <div className="flex flex-wrap items-start gap-5">
            <Card className="flex-[2_1_600px]">
              <CardHeader>
                <CardTitle>{`This week · ${rangeText(monday, sunday)}`}</CardTitle>
                <div className="flex gap-1.5">
                  <Link href={`/app/bookings?week=${addDays(monday, -7)}`} aria-label="Previous week" className={buttonClasses({ size: "sm" })}>
                    ←
                  </Link>
                  <Link href="/app/bookings" className={buttonClasses({ size: "sm" })}>
                    Today
                  </Link>
                  <Link href={`/app/bookings?week=${addDays(monday, 7)}`} aria-label="Next week" className={buttonClasses({ size: "sm" })}>
                    →
                  </Link>
                </div>
              </CardHeader>
              <Table caption="Week calendar" className="min-w-[640px] table-fixed">
                <TableHead>
                  <TableRow>
                    <Th className="w-14">
                      <span className="sr-only">Time</span>
                    </Th>
                    {days.map((d) => (
                      <Th key={d} className={cn("normal-case", d === today && "bg-mist")}>
                        <div className="k">{SHORT[istDow(d)]}</div>
                        <div className="font-display text-xl font-semibold tracking-display text-ink">{Number(d.slice(8))}</div>
                      </Th>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hoursList.map((h) => (
                    <TableRow key={h}>
                      <Th scope="row" className="h-14 align-top normal-case tracking-normal">
                        {clock12(h * 60)}
                      </Th>
                      {days.map((d) => {
                        const cell = live.filter((b) => istDay(new Date(b.startsAt)) === d && Math.floor(istMinutes(new Date(b.startsAt)) / 60) === h);
                        return (
                          <Td key={d} className="h-14 whitespace-normal border-l border-line-soft p-1 align-top">
                            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                              {cell.map((b) => (
                                <li key={b.id} className={cn("overflow-hidden rounded-lg px-2 py-1 text-xs", colorOf(b.itemId, b.kind), b.status === "pending" && "outline-dashed outline-1 outline-graphite")}>
                                  <div className="truncate font-semibold">{`${b.itemName} · ${b.name}`}</div>
                                  <div className="truncate opacity-80">{[b.staff, b.status === "no_show" ? "no-show" : b.status === "pending" ? "pending" : ""].filter(Boolean).join(" · ") || hm(b.startsAt)}</div>
                                </li>
                              ))}
                            </ul>
                          </Td>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Next up</CardTitle>
                  <span className="tabular text-xs text-muted">{`${stats.today} TODAY`}</span>
                </CardHeader>
                {upToday.length === 0 ? (
                  <p className="m-0 p-[18px] text-sm text-graphite">{week.length === 0 && monday !== mondayOf(today) ? "Viewing another week. Go to Today to see what's next." : "Nothing booked for today."}</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {upToday.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 border-b border-line-soft px-[18px] py-3 last:border-b-0">
                        <span className="tabular w-[62px] text-[13px] font-semibold">{hm(b.startsAt)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold">{`${b.itemName} · ${b.name}`}</div>
                          <div className="truncate text-xs text-muted">{b.staff || (b.kind === "event" ? `${b.qty} ticket${b.qty === 1 ? "" : "s"}` : "")}</div>
                        </div>
                        <Pill tone={BOOKING_PILL[b.status].tone}>{BOOKING_PILL[b.status].text}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{nextEvent ? `Event · ${nextEvent.name}` : "Events"}</CardTitle>
                  {nextEvent ? <Pill tone="success">LIVE CHECK-IN</Pill> : null}
                </CardHeader>
                <div className="flex flex-col gap-3.5 p-[18px]">
                  {nextEvent ? (
                    <>
                      <div className="font-display text-[36px] font-medium tracking-display">
                        {`${nextEvent.checkedIn}`}
                        <span className="text-base text-muted">{` / ${nextEvent.booked} booked`}</span>
                      </div>
                      <div className="k">Checked in</div>
                    </>
                  ) : (
                    <p className="m-0 text-sm text-graphite">No upcoming events. Create one in the Events tab.</p>
                  )}
                  <div>
                    <GateScanner />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "bookings" && (
          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
              <span className="tabular text-xs text-muted">{`${stats.week} THIS WEEK · ${stats.next30} UPCOMING`}</span>
            </CardHeader>
            <Table caption="Bookings">
              <TableHead>
                <TableRow>
                  <Th>When</Th>
                  <Th>Customer</Th>
                  <Th>Service / event</Th>
                  <Th>Staff</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {all.length === 0 ? (
                  <TableRow>
                    <Td colSpan={6} className="text-muted">
                      No bookings yet. They appear when customers scan a Booking QR code.
                    </Td>
                  </TableRow>
                ) : (
                  all.map((b) => <BookingRow key={b.id} b={b} />)
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {tab === "events" && <EventManager events={events} startOpen={sp.new === "1"} />}

        {tab === "services" && <ServiceManager services={services} hours={hours} startOpen={sp.new === "1"} />}
      </PageBody>
    </>
  );
}
