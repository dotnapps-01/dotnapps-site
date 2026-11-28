import { NoAccess } from "@/components/app/NoAccess";
import { can } from "@/lib/permissions";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { BatchGenerator } from "@/components/products/BatchGenerator";
import { ProductManager } from "@/components/products/ProductManager";
import { AlertActions, MarkInMarket, WarrantyActions } from "@/components/products/RowActions";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { maskPhone } from "@/lib/ops-input";
import { PLAN_LABEL, canUse } from "@/lib/plans";
import { listAlerts, listBatches, listProducts, listWarranty, productStats, type AlertRecord, type BatchRecord, type WarrantyRecord } from "@/lib/products";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Product QR & warranty" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products" },
  { key: "batches", label: "Batches" },
  { key: "warranty", label: "Warranty" },
  { key: "authenticity", label: "Authenticity" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const fmt = (n: number) => n.toLocaleString("en-IN");
const dmy = (d: string) => new Date(`${d}T06:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const KIND: Record<string, string> = { many_devices: "MANY DEVICES", two_cities: "TWO CITIES", double_registration: "REGISTERED TWICE", report: "BUYER REPORT" };
const ASTATUS: Record<string, { tone: PillTone; text: string }> = { new: { tone: "danger", text: "NEW" }, investigating: { tone: "warning", text: "INVESTIGATING" }, dismissed: { tone: "neutral", text: "DISMISSED" }, confirmed: { tone: "info", text: "CONFIRMED FAKE" } };
const WSTATUS: Record<string, { tone: PillTone; text: string }> = { verified: { tone: "success", text: "VERIFIED" }, review: { tone: "warning", text: "REVIEW" }, rejected: { tone: "danger", text: "REJECTED" } };

function Batches({ items, full }: { items: BatchRecord[]; full: boolean }) {
  return (
    <Card className="flex-[2_1_560px]">
      <CardHeader>
        <CardTitle>Batches</CardTitle>
        {!full ? (
          <Link href="/app/products?tab=batches" className="text-[13px] font-semibold">
            All batches →
          </Link>
        ) : null}
      </CardHeader>
      <Table caption="Batches">
        <TableHead>
          <TableRow>
            <Th>Batch</Th>
            <Th>Product</Th>
            <Th>Serial range</Th>
            <Th>Codes</Th>
            <Th>Activated</Th>
            <Th>Status</Th>
            {full ? <Th>Files</Th> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <Td colSpan={full ? 7 : 6} className="text-muted">
                No batches yet. Add a product, then generate its codes.
              </Td>
            </TableRow>
          ) : (
            items.map((b) => {
              const pct = b.qty ? Math.round((b.activated / b.qty) * 100) : 0;
              return (
                <TableRow key={b.id}>
                  <Td className="tabular font-semibold">{b.label}</Td>
                  <Td>{b.product}</Td>
                  <Td className="tabular text-xs">{`${b.firstSerial} → ${b.lastSerial.slice(-6)}`}</Td>
                  <Td className="tabular">{fmt(b.qty)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div role="progressbar" aria-label={`${b.label} activated`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-20 overflow-hidden rounded-full bg-mist">
                        <div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="tabular text-xs">{`${pct}%`}</span>
                    </div>
                  </Td>
                  <Td>
                    <Pill tone={b.status === "in_market" ? "success" : "warning"}>{b.status === "in_market" ? "IN MARKET" : "PRINTING"}</Pill>
                  </Td>
                  {full ? (
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a href={`/api/products/batches/${b.id}/export`} download className={buttonClasses({ size: "sm" })} aria-label={`Download ${b.label} as CSV`}>
                          CSV
                        </a>
                        <Link href={`/print/batch/${b.id}`} className={buttonClasses({ size: "sm" })} aria-label={`Print sheet for ${b.label}`}>
                          Print sheet
                        </Link>
                        {b.status === "printing" ? <MarkInMarket id={b.id} label={b.label} /> : null}
                      </div>
                    </Td>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function Alerts({ items, full }: { items: AlertRecord[]; full: boolean }) {
  const fresh = items.filter((a) => a.status === "new").length;
  return (
    <Card className="flex-[1_1_320px]">
      <CardHeader>
        <CardTitle>Counterfeit alerts</CardTitle>
        {fresh ? <Pill tone="danger">{`${fresh} NEW`}</Pill> : null}
      </CardHeader>
      {items.length === 0 ? (
        <p className="m-0 p-[18px] text-sm text-graphite">No alerts. A code is flagged when it is scanned from 3 different devices, from two cities within a day, registered twice with different numbers, or reported by a buyer.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((a) => (
            <li key={a.id} data-alert={a.id} className="flex flex-col gap-1.5 border-b border-line-soft px-[18px] py-3.5 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular text-[12.5px] font-semibold">{a.serial}</span>
                <span className="tabular text-[11px] text-muted">{timeAgo(new Date(a.createdAt))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill>{KIND[a.kind] ?? a.kind.toUpperCase()}</Pill>
                <Pill tone={ASTATUS[a.status].tone}>{ASTATUS[a.status].text}</Pill>
              </div>
              <span className="text-[13px] text-graphite">{a.reason}</span>
              {full || a.status === "new" ? <AlertActions id={a.id} serial={a.serial} status={a.status} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Warranty({ items, full }: { items: WarrantyRecord[]; full: boolean }) {
  return (
    <Card className="flex-[2_1_560px]">
      <CardHeader>
        <CardTitle>Warranty registrations</CardTitle>
        {!full ? (
          <Link href="/app/products?tab=warranty" className="text-[13px] font-semibold">
            All registrations →
          </Link>
        ) : null}
      </CardHeader>
      <Table caption="Warranty registrations">
        <TableHead>
          <TableRow>
            <Th>Customer</Th>
            <Th>Product · serial</Th>
            <Th>Bought from</Th>
            <Th>Invoice no.</Th>
            <Th>Warranty till</Th>
            <Th>Status</Th>
            {full ? (
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <Td colSpan={full ? 7 : 6} className="text-muted">
                No registrations yet. Buyers register from the product page after scanning.
              </Td>
            </TableRow>
          ) : (
            items.map((r) => (
              <TableRow key={r.id} data-warranty={r.id} data-customer={r.customer}>
                <Td>
                  <div className="font-semibold">{r.customer}</div>
                  <div className="tabular text-[11px] text-muted">{maskPhone(r.phone)}</div>
                </Td>
                <Td>
                  <div>{r.product}</div>
                  <div className="tabular text-[11px] text-muted">{r.serial}</div>
                </Td>
                <Td>{r.boughtFrom || "—"}</Td>
                <Td className="tabular">{r.invoiceNo || "—"}</Td>
                <Td className="tabular">{dmy(r.validUntil)}</Td>
                <Td>
                  <Pill tone={WSTATUS[r.status].tone}>{WSTATUS[r.status].text}</Pill>
                  {r.note ? <div className="mt-1 max-w-[220px] whitespace-normal text-[11px] text-muted">{r.note}</div> : null}
                </Td>
                {full ? <Td>{r.status === "review" ? <WarrantyActions id={r.id} who={r.customer} /> : null}</Td> : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws.role, "build")) return <NoAccess role={ws.role} need="build" />;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";

  if (!canUse(ws.plan, "products")) {
    return (
      <>
        <PageHeader eyebrow="Products · Enterprise" title="Product QR, warranty & authenticity" />
        <PageBody>
          <Card className="max-w-[640px]">
            <CardHeader>
              <CardTitle>Serialized product codes</CardTitle>
              <Pill>ENTERPRISE</Pill>
            </CardHeader>
            <div className="flex flex-col gap-2.5 p-[18px] text-sm leading-[1.6] text-graphite">
              <p className="m-0">Put a unique QR code on every unit you make. Buyers scan to see it is genuine, register their warranty and book service; you see activations and get an alert when a code looks copied.</p>
              <p className="m-0">{`This is part of the Enterprise plan. You are on ${PLAN_LABEL[ws.plan]}. To switch plans, contact us at [sales@skanor.in] or see the `}
                <Link href="/pricing" className="font-semibold underline underline-offset-2">
                  plans
                </Link>
                .
              </p>
            </div>
          </Card>
        </PageBody>
      </>
    );
  }

  const [stats, products, batches, warranty, alerts] = await Promise.all([
    productStats(ws.id),
    listProducts(ws.id),
    tab === "overview" || tab === "batches" ? listBatches(ws.id, tab === "overview" ? 5 : 100) : Promise.resolve([]),
    tab === "overview" || tab === "warranty" ? listWarranty(ws.id, { limit: tab === "overview" ? 5 : 100 }) : Promise.resolve([]),
    tab === "overview" || tab === "authenticity" ? listAlerts(ws.id, { limit: tab === "overview" ? 5 : 100, open: tab === "overview" }) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Products · Enterprise"
        title="Product QR, warranty & authenticity"
        actions={
          <>
            <Link href="/app/products?tab=products&new=1" className={buttonClasses()}>
              Add product
            </Link>
            <Link href="/app/products#generate" className={buttonClasses({ variant: "primary" })}>
              Generate batch
            </Link>
          </>
        }
      />
      <nav aria-label="Product sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? "/app/products" : `/app/products?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
            {t.key === "authenticity" && stats.newAlerts > 0 ? <span className="tabular text-[11px] text-danger-fg">{`${stats.newAlerts} new`}</span> : null}
            {t.key === "warranty" && stats.reviewing > 0 ? <span className="tabular text-[11px] text-warning-fg">{`${stats.reviewing} to review`}</span> : null}
          </Link>
        ))}
      </nav>
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="Codes issued" value={fmt(stats.issued)} delta={`${stats.batches} batch${stats.batches === 1 ? "" : "es"}`} tone="flat" />
          <KpiTile variant="cell" label="Activated by buyers" value={`${stats.activatedPct}%`} delta={`${fmt(stats.activated)} units`} tone="up" />
          <KpiTile variant="cell" label="Warranty registrations" value={fmt(stats.registrations)} delta={`${stats.registrationsThisMonth} this month`} tone="flat" />
          <KpiTile variant="cell" label="Service requests" value={fmt(stats.openServices)} delta="open · in Tickets" tone="flat" />
          <KpiTile variant="cell" label="Suspected fakes" value={fmt(stats.suspected)} delta={`${stats.newAlerts} new alert${stats.newAlerts === 1 ? "" : "s"}`} tone={stats.newAlerts ? "down" : "flat"} />
        </KpiStrip>

        {tab === "overview" && (
          <>
            <div className="flex flex-wrap items-start gap-5">
              <Batches items={batches} full={false} />
              <Alerts items={alerts} full={false} />
            </div>
            <div className="flex flex-wrap items-start gap-5">
              <Warranty items={warranty} full={false} />
              <BatchGenerator products={products.map((p) => ({ id: p.id, name: p.name, warrantyMonths: p.warrantyMonths }))} />
            </div>
          </>
        )}
        {tab === "products" && <ProductManager products={products} startOpen={sp.new === "1"} />}
        {tab === "batches" && (
          <div className="flex flex-wrap items-start gap-5">
            <Batches items={batches} full />
            <BatchGenerator products={products.map((p) => ({ id: p.id, name: p.name, warrantyMonths: p.warrantyMonths }))} />
          </div>
        )}
        {tab === "warranty" && (
          <div className="flex flex-wrap items-start gap-5">
            <Warranty items={warranty} full />
          </div>
        )}
        {tab === "authenticity" && (
          <div className="flex flex-wrap items-start gap-5">
            <Alerts items={alerts} full />
          </div>
        )}
        <p role="note" className="m-0 max-w-[760px] text-xs leading-[1.6] text-muted">
          An invoice photo isn&rsquo;t collected, so buyers give an invoice number instead. Place on the &ldquo;first scan&rdquo; line comes from the buyer&rsquo;s connection and is blank when the hosting doesn&rsquo;t provide it. Alerts are signals to check, not proof of a fake.
        </p>
      </PageBody>
    </>
  );
}
