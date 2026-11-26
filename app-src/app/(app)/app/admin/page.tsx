import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { FlagToggle } from "@/components/admin/FlagToggle";
import { TenantRow } from "@/components/admin/TenantRow";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { TENANT_FILTERS, adminStats, listTenants, systemHealth, type TenantFilter } from "@/lib/admin";
import { currentActor } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { listFlags } from "@/lib/flags";
import { PLAN_LABEL } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin console" };
export const dynamic = "force-dynamic";

const MIX = { free: "bg-line", starter: "bg-lilac", growth: "bg-sky", business: "bg-blush", enterprise: "bg-ink" } as const;
const fmt = (n: number) => n.toLocaleString("en-IN");

/** Skanor staff only (ADMIN_PHONES). Anyone else gets the same 404 as a page that doesn't exist. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const actor = await currentActor();
  if (!actor?.admin) notFound();
  const sp = await searchParams;
  const filter: TenantFilter = TENANT_FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as TenantFilter) : "all";
  const q = (sp.q ?? "").trim();
  const [stats, tenants, flags, health] = await Promise.all([adminStats(), listTenants({ q, filter }), listFlags(), systemHealth()]);
  const total = Math.max(1, stats.tenants);
  const href = (f: string) => `/app/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { filter: f } : {}) }).toString()}`;

  return (
    <>
      <PageHeader
        eyebrow="Skanor internal · super admin"
        title="Admin console"
        actions={
          <form role="search" aria-label="Search tenants" className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="tq">
              Search tenants
            </label>
            <input id="tq" name="q" defaultValue={q} type="search" placeholder="Search business, phone, GSTIN" className="min-h-10 w-[260px] min-w-0 max-w-full flex-1 rounded-input border border-line bg-white px-3 text-sm" />
            {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            <Button type="submit" variant="primary">
              Search
            </Button>
          </form>
        }
      />
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="MRR" value="₹[0.00] L" delta="Needs billing" tone="flat" />
          <KpiTile variant="cell" label="Paying tenants" value="[000]" delta="Needs billing" tone="flat" />
          <KpiTile variant="cell" label="Tenants" value={fmt(stats.tenants)} delta={`${stats.suspended} suspended`} tone="flat" />
          <KpiTile variant="cell" label="New (30 days)" value={fmt(stats.new30)} delta={`${stats.active30} scanned in 30 days`} tone="flat" />
          <KpiTile variant="cell" label="Scans today" value={fmt(stats.scansToday)} delta="all tenants" tone="flat" />
        </KpiStrip>

        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <nav aria-label="Tenant filter" className="flex flex-wrap gap-1.5">
              {TENANT_FILTERS.map((f) => (
                <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? "true" : undefined} className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] no-underline", filter === f.key ? "bg-ink text-white" : "bg-mist text-graphite hover:bg-line")}>
                  {f.label}
                </Link>
              ))}
            </nav>
          </CardHeader>
          <Table caption="Tenants">
            <TableHead>
              <TableRow>
                <Th>Business</Th>
                <Th>Plan</Th>
                <Th>Locations</Th>
                <Th>Scans / 30d</Th>
                <Th>Health</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <Td colSpan={7} className="text-muted">
                    No tenants match.
                  </Td>
                </TableRow>
              ) : (
                tenants.map((t) => <TenantRow key={t.id} t={t} />)
              )}
            </TableBody>
          </Table>
          <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
            Plan changes, suspensions and &ldquo;Log in as&rdquo; are written to the tenant&rsquo;s own audit log. Health is from the last 30 days of scans.
          </p>
          </Card>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Plan mix</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-3.5 p-[18px]">
                <div role="img" aria-label="Plan mix bar" className="flex h-3.5 overflow-hidden rounded-lg">
                  {stats.mix.map((m) => (
                    <span key={m.plan} className={MIX[m.plan]} style={{ width: `${(m.n / total) * 100}%` }} />
                  ))}
                </div>
                {stats.mix.map((m) => (
                  <div key={m.plan} className="flex justify-between text-[13.5px]">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[3px] border border-line", MIX[m.plan])} />
                      {PLAN_LABEL[m.plan]}
                    </span>
                    <span className="tabular">{`${m.n} · ${Math.round((m.n / total) * 100)}%`}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>System health</CardTitle>
              </CardHeader>
              <ul className="m-0 list-none p-0">
                {health.map((h) => (
                  <li key={h.label} className="flex items-center justify-between gap-3 border-b border-line-soft px-[18px] py-3 last:border-b-0">
                    <span className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", h.tone === "ok" ? "bg-success-fg" : h.tone === "warn" ? "bg-warning-fg" : "bg-danger-fg")} />
                      {h.label}
                    </span>
                    <span className="tabular text-right text-xs text-graphite">{h.value}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[1_1_440px]">
            <CardHeader>
              <CardTitle>Platform switches</CardTitle>
            </CardHeader>
            <ul className="m-0 list-none p-0">
              {flags.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 border-b border-line-soft px-[18px] py-3.5 last:border-b-0">
                  <div>
                    <div className="tabular text-[13px] font-semibold">{f.key}</div>
                    <div className="text-[12.5px] text-muted">{f.note}</div>
                  </div>
                  <FlagToggle flagKey={f.key} label={f.label} enabled={f.enabled} />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex-[1_1_440px]">
            <CardHeader>
              <CardTitle>Not built yet</CardTitle>
            </CardHeader>
            <p className="m-0 p-[18px] text-sm leading-[1.6] text-graphite">MRR, paying tenants and trials need billing. The print-orders queue needs print ordering, and the support inbox needs a support channel (WhatsApp / email). Creating a tenant by hand isn&rsquo;t needed yet: people sign up themselves. Admins are set with the ADMIN_PHONES environment variable.</p>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
