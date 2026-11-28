import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/app/NoAccess";
import { can } from "@/lib/permissions";
import { resolveTabs } from "@/lib/tab-access";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { ContactImport } from "@/components/leads/ContactImport";
import { FormBuilder } from "@/components/leads/FormBuilder";
import { LeadsBoard } from "@/components/leads/LeadsBoard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { SEGMENTS, listContacts, listForms, listLeads, segmentCounts, type Segment } from "@/lib/engage";

export const metadata: Metadata = { title: "Leads & contacts" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "pipeline", label: "Pipeline" },
  { key: "contacts", label: "Contacts" },
  { key: "forms", label: "Forms" },
  { key: "broadcasts", label: "Broadcasts" },
  { key: "segments", label: "Segments" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const TAB_NEED = { pipeline: "work", contacts: "work", forms: "build", broadcasts: "build", segments: "build" } as const;
const fmt = (n: number) => n.toLocaleString("en-IN");

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; segment?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const access = resolveTabs(TABS, TAB_NEED, ws.role, sp.tab, "pipeline");
  if (access.denied) return <NoAccess role={ws.role} need={access.denied} />;
  const tab = access.tab as Tab;
  const segment = SEGMENTS.some((s) => s.key === sp.segment) ? (sp.segment as Segment) : "all";

  const [leads, forms, counts, contacts] = await Promise.all([
    listLeads(ws.id),
    listForms(ws.id),
    segmentCounts(ws.id),
    listContacts(ws.id, { segment, q: sp.q, limit: tab === "contacts" ? 200 : 1 }),
  ]);
  const tabCount: Record<Tab, number> = { pipeline: leads.length, contacts: counts.all, forms: forms.length, broadcasts: 0, segments: SEGMENTS.length };

  return (
    <>
      <PageHeader
        eyebrow="Engage"
        title="Leads & contacts"
        actions={
          <>
            <Link href="/app/leads?tab=contacts#import" className={buttonClasses()}>
              Import contacts
            </Link>
            {can(ws.role, "build") ? (
              <>
                <Link href="/app/leads?tab=broadcasts" className={buttonClasses()}>
                  New broadcast
                </Link>
                <Link href="/app/leads?tab=forms" className={buttonClasses({ variant: "primary" })}>
                  New form
                </Link>
              </>
            ) : null}
          </>
        }
      />
      <nav aria-label="Leads sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {access.visible.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pipeline" ? "/app/leads" : `/app/leads?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
            {t.key !== "broadcasts" ? <span className="tabular text-[11px] text-muted">{fmt(tabCount[t.key])}</span> : null}
          </Link>
        ))}
      </nav>

      <PageBody>
        {tab === "pipeline" && (
          <>
            {leads.length === 0 ? (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-5 py-4">
                <div>
                  <div className="text-[15px] font-semibold">No leads yet</div>
                  <div className="text-sm text-graphite">Build a form, link it to a QR code and put it where customers can scan it. Every submission lands here.</div>
                </div>
                {can(ws.role, "build") ? (
                  <Link href="/app/leads?tab=forms" className={buttonClasses({ size: "sm", variant: "primary" })}>
                    Build a form
                  </Link>
                ) : null}
              </div>
            ) : null}
            <LeadsBoard leads={leads} />
          </>
        )}

        {tab === "contacts" && (
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <form className="flex flex-wrap items-end gap-1.5" role="search" aria-label="Filter contacts">
                <input type="hidden" name="tab" value="contacts" />
                <label className="sr-only" htmlFor="cs">
                  Search contacts
                </label>
                <input id="cs" name="q" defaultValue={sp.q ?? ""} type="search" placeholder="Search name or number" className="min-h-9 w-[220px] max-w-full rounded-input border border-line bg-white px-3 text-sm" />
                <Select label="Segment" hideLabel name="segment" defaultValue={segment} wrapperClassName="w-auto" className="min-h-9 text-sm">
                  {SEGMENTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm">
                  Filter
                </Button>
              </form>
            </CardHeader>
            <ContactImport />
            <Table caption="Contacts">
              <TableHead>
                <TableRow>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Source</Th>
                  <Th>Visits</Th>
                  <Th>Tags</Th>
                  <Th>Offers opt-in</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <Td colSpan={6} className="text-muted">
                      {sp.q || segment !== "all" ? "No contacts match." : "No contacts yet. They appear when customers submit forms, claim coupons or join your loyalty card. You can also import a CSV."}
                    </Td>
                  </TableRow>
                ) : (
                  contacts.map((c) => (
                    <TableRow key={c.id}>
                      <Td className="font-semibold">{c.name || "—"}</Td>
                      <Td className="tabular">{c.phone}</Td>
                      <Td>{c.source}</Td>
                      <Td className="tabular">{c.visits}</Td>
                      <Td>
                        <div className="flex gap-1">
                          {c.tags.map((t) => (
                            <Pill key={t}>{t}</Pill>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <Pill tone={c.optIn ? "success" : "neutral"}>{c.optIn ? "YES" : "NO"}</Pill>
                      </Td>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {tab === "forms" && <FormBuilder forms={forms} />}

        {tab === "broadcasts" && (
          <Card className="max-w-[640px]">
            <CardHeader>
              <CardTitle>WhatsApp broadcast</CardTitle>
              <Pill tone="neutral">NOT CONNECTED</Pill>
            </CardHeader>
            <div className="flex flex-col gap-3 p-[18px]">
              <p role="note" className="m-0 border border-dashed border-track bg-paper px-3 py-2.5 text-sm leading-[1.5] text-graphite">
                Sending broadcasts needs a WhatsApp Business connection, which arrives with Integrations. You can already build your audience: only contacts who opted in to offers should receive them.
              </p>
              <Select label="Send to" disabled>
                {SEGMENTS.filter((s) => s.key !== "all").map((s) => (
                  <option key={s.key}>
                    {s.label} · {fmt(counts[s.key])} contacts
                  </option>
                ))}
              </Select>
              <Textarea label="Message template" rows={4} disabled defaultValue="Hi [First name]! Weekend special: 2 filter coffees for ₹99 at Saravana Cafe. Show this message at the counter. Reply STOP to opt out." />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular text-[11px] text-muted">EST. COST [₹ PRICE]</span>
                <div className="flex gap-1.5">
                  <Button disabled>Schedule</Button>
                  <Button variant="primary" disabled>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === "segments" && (
          <Card>
            <CardHeader>
              <CardTitle>Segments</CardTitle>
              <span className="tabular text-[11px] text-muted">LIVE COUNTS</span>
            </CardHeader>
            <ul className="m-0 list-none p-0">
              {SEGMENTS.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3 border-b border-line-soft px-[18px] py-3.5 last:border-b-0">
                  <div>
                    <div className="text-[13.5px] font-semibold">{s.label}</div>
                    <div className="tabular mt-0.5 text-[10.5px] text-muted">{fmt(counts[s.key])} contacts</div>
                  </div>
                  <Link href={`/app/leads?tab=contacts&segment=${s.key}`} className={buttonClasses({ size: "sm" })}>
                    View contacts
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageBody>
    </>
  );
}
