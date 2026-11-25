import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QRMark } from "@/components/qr/QRMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Input } from "@/components/ui/Input";
import { NewBadge, Eyebrow } from "@/components/ui/NewBadge";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { colors, qrSamples, radii, status, typeScale } from "@/lib/mock/styleguide";

export const metadata: Metadata = { title: "Style guide" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px]">
      <h2 className="m-0 font-display text-[28px] font-semibold tracking-heading">{title}</h2>
      {children}
    </section>
  );
}

const topQr = [
  { n: "Table tents — Review", ty: "REVIEW", l: "Anna Nagar", s: "3,204", r: "128 reviews", tone: "success", st: "ACTIVE" },
  { n: "Main menu", ty: "MENU", l: "All locations", s: "2,860", r: "41 WhatsApp orders", tone: "success", st: "ACTIVE" },
  { n: "Diwali 20% off", ty: "COUPON", l: "All locations", s: "1,140", r: "388 redeemed", tone: "neutral", st: "EXPIRED" },
] as const;

export default function StyleGuidePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-14 px-[clamp(20px,5vw,80px)] py-[clamp(28px,5vw,72px)]"
    >
      <header className="flex flex-col gap-4">
        <Eyebrow>Skanor design system</Eyebrow>
        <h1 className="m-0 font-display text-[clamp(44px,6vw,84px)] font-semibold leading-[0.95] tracking-display">
          Clean white. Bold black.
          <br />
          Soft marble.
        </h1>
        <p className="m-0 max-w-[620px] text-lg leading-[1.55] text-graphite">
          One system for the website, the business app and every scan page. Black does the work, pastel marble adds
          warmth, and status colours carry meaning.
        </p>
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-4">
          {colors.map((c) => (
            <div key={c.n} className="flex flex-col gap-2">
              <span className="block h-[84px] rounded-card border border-line" style={{ background: c.v }} />
              <div className="text-sm font-semibold">{c.n}</div>
              <div className="k normal-case tracking-normal">
                {c.v} · {c.u}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
          {status.map((s) => (
            <Card key={s.n} className="flex items-center justify-between p-4">
              <span className="text-sm font-semibold">{s.n}</span>
              <Pill tone={s.tone}>{s.t}</Pill>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Marble gradient">
        <div className="flex flex-wrap gap-4">
          <div className="flex h-60 flex-[2_1_min(100%,420px)] items-end rounded-frame bg-marble p-6">
            <span className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold">
              Hero frames, plan cards, scan page headers
            </span>
          </div>
          <div className="flex flex-[1_1_260px] flex-col gap-2.5 text-sm leading-[1.6] text-graphite">
            <div>
              <b className="text-ink">Base</b> #EEF2FF
            </div>
            <div>
              <b className="text-ink">Stops</b> #AFCBFF · #F6B8DA · #CDBDFF · #F8C6D6
            </div>
            <div>
              Use it as a frame behind content, never behind long text. One marble area per screen.
            </div>
          </div>
        </div>
      </Section>

      <Section title="Type">
        <Card large>
          {typeScale.map((t) => (
            <div
              key={t.n}
              className="flex flex-wrap items-baseline gap-4 border-b border-line-soft px-[22px] py-[18px] last:border-b-0"
            >
              <div className="k w-[170px]">{t.n}</div>
              <div className={`min-w-0 flex-[1_1_min(100%,360px)] leading-[1.15] ${t.cls}`}>{t.e}</div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap gap-4">
          <Card large className="flex flex-[1_1_min(100%,320px)] flex-col gap-4 p-[22px]">
            <div className="k">Buttons</div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary">Start free</Button>
              <Button>Book a demo</Button>
              <Button size="sm">Small</Button>
            </div>
            <div className="k">Badge</div>
            <div>
              <NewBadge>Product QR with counterfeit alerts</NewBadge>
            </div>
          </Card>

          <Card large className="flex flex-[1_1_min(100%,320px)] flex-col gap-3.5 p-[22px]">
            <div className="k">Inputs</div>
            <Input label="Business name" defaultValue="Saravana Cafe" />
            <Select label="City" defaultValue="Coimbatore">
              <option>Coimbatore</option>
              <option>Chennai</option>
              <option>Bengaluru</option>
            </Select>
            <Textarea label="Message" placeholder="Tell us about your business" rows={3} />
            <div className="k">Toggles and tabs</div>
            <div className="flex flex-wrap items-center gap-3.5">
              <Toggle aria-label="On example" defaultChecked />
              <Toggle aria-label="Off example" />
              <Tabs
                aria-label="Example tabs"
                className="ml-3 min-w-[200px]"
                items={[
                  { id: "overview", label: "Overview", panel: <p className="m-0 text-[13px] text-muted">Overview panel</p> },
                  { id: "inbox", label: "Inbox", panel: <p className="m-0 text-[13px] text-muted">Inbox panel</p> },
                  { id: "settings", label: "Settings", panel: <p className="m-0 text-[13px] text-muted">Settings panel</p> },
                ]}
              />
            </div>
          </Card>

          <Card large className="flex flex-[1_1_min(100%,320px)] flex-col gap-3.5 p-[22px]">
            <div className="k">Card and KPI</div>
            <KpiTile label="Google reviews" value="1,284" delta="▲ 18% this month" />
            <div className="k">Radii</div>
            <div className="flex items-end gap-2.5 text-[11px] text-muted">
              {radii.map((r) => (
                <div key={r} className="flex flex-col items-center gap-1.5">
                  <span className="h-[52px] w-[52px] border border-line bg-mist" style={{ borderRadius: r }} />
                  {r}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Table">
        <Card>
          <Table caption="Top QR codes">
            <TableHead>
              <TableRow>
                <Th>QR code</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                <Th>Scans</Th>
                <Th>Result</Th>
                <Th>Status</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {topQr.map((r) => (
                <TableRow key={r.n}>
                  <Td className="font-semibold">{r.n}</Td>
                  <Td>
                    <Pill tone="info">{r.ty}</Pill>
                  </Td>
                  <Td className="text-graphite">{r.l}</Td>
                  <Td className="tabular">{r.s}</Td>
                  <Td className="text-graphite">{r.r}</Td>
                  <Td>
                    <Pill tone={r.tone}>{r.st}</Pill>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="QR mark">
        <p className="m-0 text-[15px] text-graphite">
          Three styles from QR Studio. Always black on white with a quiet zone, so every phone can read it. These are
          real codes: scan them.
        </p>
        <div className="flex flex-wrap gap-4">
          {qrSamples.map((q) => (
            <Card key={q.label} large className="flex flex-col items-center gap-2.5 p-5">
              <QRMark value={q.value} variant={q.variant} size={170} label={`${q.label} style QR code`} />
              <span className="text-[13px] font-semibold">{q.label}</span>
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}
