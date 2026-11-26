import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { KeyManager } from "@/components/integrations/KeyManager";
import { WebhookManager } from "@/components/integrations/WebhookManager";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { listKeys } from "@/lib/api-keys";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { PLAN_LABEL, canUse } from "@/lib/plans";
import { listEndpoints, recentDeliveries } from "@/lib/webhooks";

export const metadata: Metadata = { title: "Integrations & API" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "apps", label: "Apps" },
  { key: "api", label: "API keys" },
  { key: "webhooks", label: "Webhooks" },
  { key: "whitelabel", label: "White-label" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const APPS = [
  { i: "G", n: "Google Business Profile", d: "Review links, review inbox and replies.", bg: "bg-mist", fg: "text-ink" },
  { i: "W", n: "WhatsApp Business", d: "Alerts, bills, OTP and broadcasts from your number.", bg: "bg-success-bg", fg: "text-success-fg" },
  { i: "S", n: "Shopify", d: "Product QR, order lookup and loyalty for online buyers.", bg: "bg-mist", fg: "text-ink" },
  { i: "W", n: "WooCommerce", d: "Sync products and orders.", bg: "bg-info-bg", fg: "text-ink" },
  { i: "Z", n: "Zoho CRM", d: "Send leads and contacts to Zoho.", bg: "bg-[#FBE3EF]", fg: "text-ink" },
  { i: "T", n: "Tally", d: "Pull bills for digital receipts and loyalty.", bg: "bg-mist", fg: "text-ink" },
  { i: "R", n: "Razorpay", d: "Payment links and paid bookings.", bg: "bg-mist", fg: "text-ink" },
  { i: "O", n: "Orkha by Dotnapps", d: "Send tickets, leads and attendance to your Orkha workspace.", bg: "bg-ink", fg: "text-white" },
];

function Upsell({ plan, what }: { plan: string; what: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{what}</CardTitle>
        <Pill>ENTERPRISE</Pill>
      </CardHeader>
      <div className="flex flex-col gap-2 p-[18px] text-sm leading-[1.6] text-graphite">
        <p className="m-0">{`${what} are part of the Enterprise plan. You are on ${plan}.`}</p>
        <p className="m-0">
          To switch plans, contact us at [sales@skanor.in] or see{" "}
          <Link href="/pricing" className="font-semibold underline underline-offset-2">
            the plans
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "apps";
  const allowed = canUse(ws.plan, "api");
  const [keys, endpoints] = await Promise.all([tab === "api" && allowed ? listKeys(ws.id) : Promise.resolve([]), tab === "webhooks" && allowed ? listEndpoints(ws.id) : Promise.resolve([])]);
  const deliveries = Object.fromEntries(await Promise.all(endpoints.map(async (e) => [e.id, await recentDeliveries(ws.id, e.id, 8)] as const)));

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Integrations, API & white-label"
        actions={
          <>
            <Link href="/docs" className={buttonClasses()}>
              API docs
            </Link>
            <Link href="/app/integrations?tab=api" className={buttonClasses({ variant: "primary" })}>
              Create API key
            </Link>
          </>
        }
      />
      <nav aria-label="Platform sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "apps" ? "/app/integrations" : `/app/integrations?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center px-4 py-3 text-[13.5px] no-underline", tab === t.key ? "border-b-2 border-ink font-semibold text-ink" : "border-b-2 border-transparent text-graphite hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <PageBody>
        {tab === "apps" && (
          <>
            <p role="note" className="m-0 max-w-[720px] rounded-card border border-dashed border-track bg-paper px-4 py-3 text-sm leading-[1.55] text-graphite">
              Ready-made connections to these apps aren&rsquo;t built yet. You can already connect anything that takes a webhook (Zapier, Make, your own server) and read your data through the API.
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
              {APPS.map((a) => (
                <Card key={a.n}>
                  <article aria-label={a.n} className="flex h-full flex-col gap-3 p-[18px]">
                    <div className="flex items-center justify-between">
                      <div aria-hidden="true" className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-[15px] font-bold", a.bg, a.fg)}>
                        {a.i}
                      </div>
                      <Pill>SOON</Pill>
                    </div>
                    <div>
                      <h2 className="m-0 font-sans text-[15px] font-semibold">{a.n}</h2>
                      <p className="mb-0 mt-1 text-[13px] leading-[1.5] text-graphite">{a.d}</p>
                    </div>
                  </article>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "api" && (
          <div className="flex flex-col gap-5">
            {allowed ? <KeyManager keys={keys} /> : <Upsell plan={PLAN_LABEL[ws.plan]} what="API keys" />}
            <Card>
              <CardHeader>
                <CardTitle>Try it</CardTitle>
                <Link href="/docs" className="text-[13px] font-semibold">
                  Full API docs →
                </Link>
              </CardHeader>
              <pre tabIndex={0} aria-label="Example request" className="m-[18px] overflow-x-auto whitespace-pre rounded-input bg-ink p-4 font-mono text-[12.5px] leading-[1.7] text-line">{`curl https://YOUR-DOMAIN/v1/qr \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Table 4", "type": "url",
        "config": { "url": "https://example.com/menu" },
        "publish": true }'`}</pre>
            </Card>
          </div>
        )}

        {tab === "webhooks" && (allowed ? <WebhookManager endpoints={endpoints} deliveries={deliveries} /> : <Upsell plan={PLAN_LABEL[ws.plan]} what="Webhooks" />)}

        {tab === "whitelabel" && (
          <Card>
            <CardHeader>
              <CardTitle>White-label</CardTitle>
              <Pill>FOR AGENCIES</Pill>
            </CardHeader>
            <div className="flex flex-col gap-3 p-[18px] text-sm leading-[1.6] text-graphite">
              <p className="m-0">Running Skanor under your own brand (your name, your domain, one workspace per client) is for agencies. It needs custom-domain and certificate set-up and client workspaces under one login, so it isn&rsquo;t built yet.</p>
              <p className="m-0">If you are an agency and want to be first in line, contact us at [sales@skanor.in].</p>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}
