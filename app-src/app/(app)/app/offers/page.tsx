import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { CouponManager } from "@/components/offers/CouponManager";
import { LoyaltyForm } from "@/components/offers/LoyaltyForm";
import { RedeemDialog } from "@/components/offers/RedeemDialog";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill } from "@/components/ui/Pill";
import { can } from "@/lib/permissions";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { getOfferStats, getProgram, listCoupons, recentRedemptions } from "@/lib/engage";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Offers & loyalty" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "coupons", label: "Coupons & offers" },
  { key: "loyalty", label: "Loyalty" },
  { key: "bills", label: "Digital bills" },
  { key: "winback", label: "Win-back" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const fmt = (n: number) => n.toLocaleString("en-IN");

function Redemptions({ items }: { items: Awaited<ReturnType<typeof recentRedemptions>> }) {
  return (
    <Card className="flex-[1_1_320px]">
      <CardHeader>
        <CardTitle>Recent redemptions</CardTitle>
      </CardHeader>
      {items.length === 0 ? (
        <p className="m-0 p-[18px] text-sm text-graphite">Nothing redeemed yet. Use “Redeem a code” when a customer shows one.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((r, i) => (
            <li key={i} className="flex justify-between gap-2.5 border-b border-line-soft px-[18px] py-3 last:border-b-0">
              <div>
                <div className="text-[13.5px] font-semibold">{r.who}</div>
                <div className="tabular mt-0.5 text-[10.5px] text-muted">{r.what}</div>
              </div>
              <span className="tabular text-[11px] text-graphite">{timeAgo(new Date(r.at))}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string; edit?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "coupons";

  const [stats, coupons, program, redemptions] = await Promise.all([getOfferStats(ws.id), listCoupons(ws.id), getProgram(ws.id), recentRedemptions(ws.id, 8)]);

  // Staff can redeem a code and stamp a loyalty card; setting offers up is for owners and managers
  if (!can(ws.role, "build")) {
    return (
      <>
        <PageHeader eyebrow="Engage" title="Redeem offers & stamp cards" actions={<RedeemDialog />} />
        <PageBody>
          <KpiStrip>
            <KpiTile variant="cell" label="Active offers" value={fmt(stats.activeOffers)} delta={`${coupons.length} in total`} tone="flat" />
            <KpiTile variant="cell" label="Redemptions" value={fmt(stats.redemptions30)} delta="last 30 days" tone="flat" />
            <KpiTile variant="cell" label="Stamps given" value={fmt(stats.stamps30)} delta="last 30 days" tone="flat" />
          </KpiStrip>
          <div className="flex flex-wrap">
            <Redemptions items={redemptions} />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Engage"
        title="Offers, loyalty & digital bills"
        actions={
          <>
            <RedeemDialog />
            <Link href="/app/offers?new=1" className={buttonClasses({ variant: "primary" })}>
              New offer
            </Link>
          </>
        }
      />
      <nav aria-label="Offer sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "coupons" ? "/app/offers" : `/app/offers?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-b-2 border-ink font-semibold text-ink" : "border-b-2 border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <PageBody>
        <KpiStrip>
          <KpiTile variant="cell" label="Active offers" value={fmt(stats.activeOffers)} delta={`${coupons.length} in total`} tone="flat" />
          <KpiTile variant="cell" label="Redemptions" value={fmt(stats.redemptions30)} delta="last 30 days" tone="flat" />
          <KpiTile variant="cell" label="Loyalty members" value={fmt(stats.members)} delta={`${fmt(stats.rewardsEarned)} rewards earned`} tone="flat" />
          <KpiTile variant="cell" label="Stamps given" value={fmt(stats.stamps30)} delta="last 30 days" tone="flat" />
          <KpiTile variant="cell" label="Bills on WhatsApp" value="—" delta="Needs Integrations" tone="flat" />
        </KpiStrip>

        {tab === "coupons" && (
          <>
            <CouponManager coupons={coupons} startOpen={sp.new === "1"} editId={coupons.some((c) => c.id === sp.edit) ? (sp.edit ?? null) : null} />
            <div className="flex flex-wrap">
              <Redemptions items={redemptions} />
            </div>
          </>
        )}

        {tab === "loyalty" && (
          <div id="loyalty" className="flex flex-wrap items-start gap-5">
            <Card className="flex-[2_1_520px]">
              <CardHeader>
                <CardTitle>Loyalty programme{program ? ` · ${program.name}` : ""}</CardTitle>
                {program ? <Pill tone={program.active ? "success" : "neutral"}>{program.active ? "LIVE" : "OFF"}</Pill> : <Pill>NOT SET UP</Pill>}
              </CardHeader>
              <LoyaltyForm program={program} business={ws.businessName || "Your business"} />
              {program ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-sm text-graphite">
                  <span>Next: make a Loyalty card QR for your counter.</span>
                  <Link href="/app/studio?type=loyalty" className={buttonClasses({ size: "sm" })}>
                    Create QR
                  </Link>
                </div>
              ) : null}
            </Card>
            <Redemptions items={redemptions} />
          </div>
        )}

        {tab === "bills" && (
          <Card className="max-w-[640px]">
            <CardHeader>
              <CardTitle>Digital bills</CardTitle>
              <Pill>SOON</Pill>
            </CardHeader>
            <div className="flex flex-col gap-3 p-5 text-sm leading-[1.55] text-graphite">
              <p className="m-0">Customer scans the counter QR, enters a mobile number and the bill arrives on WhatsApp with a loyalty stamp and an opt-in for offers.</p>
              <p className="m-0">This needs WhatsApp delivery and a connection to your billing software, so it arrives with Integrations.</p>
            </div>
          </Card>
        )}

        {tab === "winback" && (
          <Card className="max-w-[640px]">
            <CardHeader>
              <CardTitle>Win-back</CardTitle>
              <Pill>SOON</Pill>
            </CardHeader>
            <p className="m-0 p-5 text-sm leading-[1.55] text-graphite">
              Message loyalty members who haven&rsquo;t visited in a while. It needs WhatsApp sending (Integrations). The &ldquo;Inactive 60+ days&rdquo; segment in Leads already shows who it would reach.
            </p>
          </Card>
        )}
      </PageBody>
    </>
  );
}
