import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/PageHeader";
import { DataPanel } from "@/components/settings/DataPanel";
import { LocationsCard } from "@/components/settings/LocationsCard";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { listAudit } from "@/lib/audit";
import { currentActor } from "@/lib/auth/admin";
import { currentWorkspace } from "@/lib/auth/current";
import { PLAN_LABEL } from "@/lib/plans";
import { listLocationsFull, usage } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const NAV = [
  { id: "business", label: "Business profile" },
  { id: "team", label: "Team & roles" },
  { id: "billing", label: "Plan & billing" },
  { id: "brand", label: "Brand kit & domain" },
  { id: "security", label: "Security & audit log" },
  { id: "notifications", label: "Notifications" },
  { id: "data", label: "Data & privacy" },
];
const WHAT: Record<string, string> = {
  "profile.updated": "Business profile updated",
  "location.added": "Location added",
  "location.removed": "Location removed",
  "location.primary": "Primary location changed",
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "webhook.created": "Webhook endpoint added",
  "webhook.deleted": "Webhook endpoint removed",
  "product.created": "Product added",
  "batch.created": "Product codes generated",
  "batch.exported": "Product codes downloaded",
  "data.exported": "Data exported",
  "retention.changed": "Data retention changed",
  "plan.changed": "Plan changed",
  "account.suspended": "Account paused by Skanor",
  "account.resumed": "Account resumed by Skanor",
  "admin.viewed_as_owner": "Skanor support viewed this workspace",
  "api.qr_created": "QR code created through the API",
  "api.batch_created": "Product codes generated through the API",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const fmt = (n: number) => n.toLocaleString("en-IN");

function Bar({ label, value, of, text }: { label: string; value: number; of: number | null; text: string }) {
  const pct = of ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="tabular">{text}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of ?? 100} aria-valuenow={of ? value : 0} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
        <div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const actor = await currentActor();
  const [locations, u, log] = await Promise.all([listLocationsFull(ws.id), usage(ws), listAudit(ws.id, 50)]);
  const keep = ws.retentionMonths === null ? "forever" : String(ws.retentionMonths);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="flex flex-wrap items-start gap-6 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2.4vw,28px)]">
        <nav aria-label="Settings sections" className="flex max-w-[240px] flex-[1_1_200px] flex-col gap-0.5">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink no-underline hover:bg-mist">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <Card id="business" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Business profile</CardTitle>
            </CardHeader>
            <ProfileForm initial={{ name: ws.businessName, industry: ws.industry, gstin: ws.gstin, defaultLang: ws.defaultLang }} />
            <LocationsCard locations={locations} />
          </Card>

          <Card id="team" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Team &amp; roles</CardTitle>
              <Pill>SOON</Pill>
            </CardHeader>
            <p className="m-0 p-[18px] text-sm leading-[1.6] text-graphite">Today each workspace has one owner, who can do everything. Inviting managers and staff with their own permissions (view only, redeem coupons, manage tickets…) is planned; it needs separate logins, so it isn&rsquo;t built yet.</p>
          </Card>

          <Card id="billing" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Plan &amp; billing</CardTitle>
              <Link href="/pricing" className="text-[13px] font-semibold">
                Compare plans →
              </Link>
            </CardHeader>
            <div className="flex flex-wrap gap-[18px] p-[18px]">
              <div className="flex-[1_1_260px] rounded-card bg-marble p-[18px]">
                <div className="k">Current plan</div>
                <div className="mt-1.5 font-display text-[26px] font-semibold tracking-display">{PLAN_LABEL[ws.plan]}</div>
                <div className="mt-1 text-[13px]">[₹ PRICE] / location / month</div>
                <p className="mb-0 mt-3 text-[13px] leading-[1.5]">To change your plan, contact us at [sales@skanor.in]. Paying online isn&rsquo;t switched on yet.</p>
              </div>
              <div className="flex flex-[1_1_260px] flex-col gap-3">
                <Bar label="Dynamic QR codes" value={u.dynamicUsed} of={u.dynamicLimit} text={`${fmt(u.dynamicUsed)} / ${u.dynamicLimit === null ? "unlimited" : fmt(u.dynamicLimit)}`} />
                <Bar label="Scans this month" value={u.scansMonth} of={null} text={`${fmt(u.scansMonth)} / unlimited`} />
                <Bar label="Contacts" value={u.contacts} of={null} text={fmt(u.contacts)} />
                <Bar label="Team seats" value={1} of={1} text="1 / 1" />
              </div>
            </div>
            <div className="border-t border-line-soft">
              <Table caption="Invoices">
                <TableHead>
                  <TableRow>
                    <Th>Invoice</Th>
                    <Th>Date</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <Td colSpan={4} className="text-muted">
                      No invoices yet. GST invoices will list here once billing is switched on.
                    </Td>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card id="brand" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Brand kit &amp; domain</CardTitle>
              <Pill>SOON</Pill>
            </CardHeader>
            <p className="m-0 p-[18px] text-sm leading-[1.6] text-graphite">Uploading a logo needs file storage, and a scan-page domain like yourbrand.skn.to or scan.yourbrand.com needs DNS and certificate set-up. Neither is built yet. Customer pages show your business name and its initials for now.</p>
          </Card>

          <Card id="security" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Security &amp; audit log</CardTitle>
            </CardHeader>
            <p className="m-0 px-[18px] pb-1 pt-3.5 text-sm leading-[1.6] text-graphite">You sign in with a one-time code sent to your mobile number. Extra sign-in protection (two-factor, Google sign-in) isn&rsquo;t built yet. Below is what has changed in this workspace, and who did it.</p>
            <Table caption="Audit log">
              <TableHead>
                <TableRow>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>What</Th>
                  <Th>Detail</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {log.length === 0 ? (
                  <TableRow>
                    <Td colSpan={4} className="text-muted">
                      Nothing recorded yet. Changes to your profile, locations, API keys, webhooks, products and data show up here.
                    </Td>
                  </TableRow>
                ) : (
                  log.map((e) => (
                    <TableRow key={e.id}>
                      <Td className="tabular">{when(e.at)}</Td>
                      <Td>{e.actor.startsWith("Skanor admin") ? e.actor : e.actor.startsWith("API key") ? e.actor : "You"}</Td>
                      <Td>{WHAT[e.action] ?? e.action}</Td>
                      <Td className="max-w-[320px] whitespace-normal text-graphite">{e.detail || "—"}</Td>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <Card id="notifications" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <Pill>SOON</Pill>
            </CardHeader>
            <p className="m-0 p-[18px] text-sm leading-[1.6] text-graphite">Alerts on WhatsApp and email (new low rating, new lead, a ticket breaching its SLA, a weekly summary) need WhatsApp and email sending, which arrive with Integrations. Until then, the counts next to each item in the sidebar show what needs you.</p>
          </Card>

          <Card id="data" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Data &amp; privacy</CardTitle>
            </CardHeader>
            <DataPanel keep={keep} businessName={ws.businessName} canDelete={!actor?.act} />
          </Card>
        </div>
      </div>
    </>
  );
}
