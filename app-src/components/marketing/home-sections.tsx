import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { QRMark } from "@/components/qr/QRMark";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/NewBadge";
import { cn } from "@/lib/cn";
import {
  acts,
  advancedPoints,
  heroFloats,
  homeFaqs,
  industries,
  integrations,
  levels,
  logoPlaceholders,
  pricingTeaser,
  spotlightPoints,
  stats,
} from "@/lib/content/home";
import { CheckList, CtaBand, CtaButtons, FaqList, Frame, Mono, PathIcon, SectionHeading, Section, Stars } from "./parts";

const cell = "border-b border-r border-line";

export function Hero() {
  return (
    <Section>
      <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))]">
        <div className="flex flex-col justify-center gap-7 px-gutter py-[clamp(40px,6vw,88px)]">
          <Eyebrow>QR platform for growing businesses</Eyebrow>
          <h1 className="m-0 font-display text-[clamp(44px,6.4vw,88px)] font-semibold leading-[0.98] tracking-display">
            Every scan, working for your business.
          </h1>
          <p className="m-0 max-w-[520px] text-lg leading-[1.55] text-graphite">
            Skanor turns one QR code into reviews, leads, loyalty, service tickets, attendance and product warranty —
            all run from one dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/signup" variant="primary">
              Start free
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
            <Button href="/contact">Book a demo</Button>
          </div>
          <p className="tabular m-0 text-xs text-muted">Free plan · No card needed · Works with any phone camera</p>
        </div>

        <div className="relative flex min-h-[440px] items-center justify-center overflow-hidden border-t border-line bg-marble py-10 sm:min-h-[560px] md:border-l md:border-t-0">
          <div className="max-w-[calc(100%-32px)] rounded-hero bg-white p-4 shadow-soft sm:p-[26px]">
            <QRMark value="https://skn.to/demo" variant="halftone" size={340} quiet={false} label="Sample Skanor QR code" />
          </div>
          {heroFloats.map((f) => (
            <div
              key={f.t}
              className={cn(
                "absolute hidden max-w-[250px] items-center gap-3 overflow-hidden rounded-card border border-line bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(14,14,16,.08)] sm:flex",
                f.pos,
              )}
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center bg-mist text-ink">
                <PathIcon d={f.ic} size={18} strokeWidth={1.7} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{f.t}</span>
                <Mono className="text-[11px] text-muted">{f.s}</Mono>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    </Section>
  );
}

export function LogoStrip() {
  return (
    <Section>
      <Frame className="flex flex-col items-center gap-6 px-gutter py-9">
        <Mono className="text-xs uppercase tracking-[0.06em] text-muted">Trusted by shops, clinics, builders &amp; brands</Mono>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          {logoPlaceholders.map((l, i) => (
            <div
              key={i}
              className="flex h-12 items-center justify-center border border-dashed border-track text-xs font-medium text-muted"
            >
              {l}
            </div>
          ))}
        </div>
      </Frame>
    </Section>
  );
}

export function Levels() {
  return (
    <Section>
      <Frame>
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-gutter pb-10 pt-[clamp(48px,6vw,88px)]">
          <div className="flex max-w-[640px] flex-col gap-4">
            <Eyebrow>One platform · 4 levels</Eyebrow>
            <SectionHeading size="text-[clamp(34px,4.4vw,56px)]">From your first QR to a full QR operating system</SectionHeading>
          </div>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-graphite">
            Start with a free QR. Turn on modules as you grow. Every module runs on the same codes, the same contacts and
            the same dashboard.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          {levels.map((lv) => (
            <div
              key={lv.n}
              className={cn(cell, "flex flex-col gap-[18px] px-cell pb-10 pt-8", lv.highlight ? "bg-info-bg" : "bg-white")}
            >
              <div className="flex items-center justify-between">
                <Mono className="text-[13px]">{lv.n}</Mono>
                <Mono className="border border-line bg-white px-2 py-1 text-[11px] text-graphite">{lv.plan}</Mono>
              </div>
              <div>
                <h3 className="mb-1.5 mt-0 font-display text-[28px] font-semibold tracking-display">{lv.name}</h3>
                <p className="m-0 text-sm text-muted">{lv.tag}</p>
              </div>
              <CheckList items={lv.items} />
            </div>
          ))}
        </div>
        <div className="flex justify-center px-gutter py-6">
          <Button href="/features">See every module</Button>
        </div>
      </Frame>
    </Section>
  );
}

function StepCopy({ n, title, children }: { n: number; title: string; children: string }) {
  return (
    <div className="px-8 pb-9 pt-7">
      <h3 className="mb-2 mt-0 font-sans text-xl font-semibold">
        {n} · {title}
      </h3>
      <p className="m-0 text-[15px] leading-[1.55] text-graphite">{children}</p>
    </div>
  );
}

export function HowItWorks() {
  const visual = "flex h-[260px] items-center justify-center border-b border-line bg-thead";
  return (
    <Section>
      <Frame>
        <div className="flex flex-col items-center gap-3.5 border-b border-line px-gutter pb-10 pt-[clamp(48px,6vw,80px)] text-center">
          <Eyebrow className="self-center">How it works</Eyebrow>
          <SectionHeading>Create. Place. Act.</SectionHeading>
          <p className="m-0 max-w-[560px] text-base text-graphite">
            Every Skanor code is a small app: it opens a page, captures something, and starts a follow-up.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <div className="border-r border-line max-md:border-b">
            <div className={cn(visual, "gap-[18px]")}>
              <div className="overflow-hidden rounded-card border border-line bg-white p-3.5">
                <QRMark value="https://skn.to/menu" variant="dot" size={120} quiet={false} label="Sample dot-style QR code" />
              </div>
              <div className="flex flex-col gap-2">
                <Mono className="bg-ink px-2.5 py-1.5 text-[11px] text-white">Review page</Mono>
                {["Menu", "Lead form", "+ 20 more"].map((t) => (
                  <Mono key={t} className="border border-line bg-white px-2.5 py-1.5 text-[11px]">
                    {t}
                  </Mono>
                ))}
              </div>
            </div>
            <StepCopy n={1} title="Create">
              Pick what the scan should do, add your logo and colours, and download print-ready files or order stickers.
            </StepCopy>
          </div>
          <div className="border-r border-line max-md:border-b">
            <div className={visual}>
              <div className="box-border flex h-[220px] w-[150px] flex-col items-center gap-2.5 rounded-[22px] border border-ink bg-white px-3.5 py-[18px]">
                <span className="text-xs font-semibold">How was your visit?</span>
                <Stars size={18} gap="gap-[3px]" />
                <div className="h-2 w-full bg-mist" />
                <div className="h-2 w-4/5 bg-mist" />
                <Mono className="mt-auto w-full bg-ink py-2 text-center text-[10px] text-white">POST ON GOOGLE</Mono>
              </div>
            </div>
            <StepCopy n={2} title="Place">
              Put it on the counter, table, product box, AC unit or plot stone. Customers scan with any camera — no app
              needed.
            </StepCopy>
          </div>
          <div>
            <div className={cn(visual, "flex-col gap-2.5")}>
              {acts.map((a) => (
                <div
                  key={a.t}
                  className="box-border flex w-[260px] max-w-[calc(100%-32px)] items-center justify-between overflow-hidden rounded-card border border-line bg-white px-3 py-2.5"
                >
                  <span className="text-[13px] font-medium">{a.t}</span>
                  <Mono className="px-[7px] py-[3px] text-[10px]" style={{ background: a.bg, color: a.fg }}>
                    {a.s}
                  </Mono>
                </div>
              ))}
            </div>
            <StepCopy n={3} title="Act">
              Every scan becomes a review, lead, stamp, ticket or check-in — routed to the right person on WhatsApp and in
              your dashboard.
            </StepCopy>
          </div>
        </div>
      </Frame>
    </Section>
  );
}

export function ReviewSpotlight() {
  const box = "box-border w-full max-w-[420px] overflow-hidden rounded-card border border-line bg-white";
  const wire = <div className="h-7 w-px bg-ink" aria-hidden="true" />;
  return (
    <Section>
      <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <div className="flex flex-col gap-5 border-r border-line px-gutter py-[clamp(48px,6vw,80px)] max-md:border-r-0">
          <Eyebrow>Core module · Review Assistant</Eyebrow>
          <SectionHeading size="text-[clamp(32px,4vw,50px)]">More Google reviews. Complaints fixed before they go public.</SectionHeading>
          <p className="m-0 text-base leading-[1.6] text-graphite">
            Customers rate their visit in one tap. Everyone can post to Google with AI-suggested words; anyone unhappy
            also gets a private line to the manager, which opens a ticket instantly.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {spotlightPoints.map((s) => (
              <li key={s.n} className="flex gap-3 text-[15px] text-[#1C1C21]">
                <Mono className="pt-0.5 text-[13px]">{s.n}</Mono>
                {s.t}
              </li>
            ))}
          </ul>
          <div>
            <Button href="/features/review-assistant">Explore Review Assistant</Button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center bg-thead p-[clamp(32px,4vw,56px)]">
          <div className={cn(box, "flex items-center justify-between px-5 py-[18px]")}>
            <div>
              <Mono className="block text-[11px] text-muted">SCAN · TABLE 4</Mono>
              <div className="mt-1 text-[15px] font-semibold">Customer rates visit</div>
            </div>
            <Stars />
          </div>
          {wire}
          <div className="grid w-full max-w-[420px] grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-card border border-line border-t-[3px] border-t-ink bg-white p-4">
              <Mono className="block text-[11px]">4–5 ★</Mono>
              <div className="mb-1 mt-1.5 text-sm font-semibold">Post on Google</div>
              <div className="text-xs leading-[1.45] text-muted">AI suggests words from what they liked</div>
            </div>
            <div className="overflow-hidden rounded-card border border-line border-t-[3px] border-t-ink bg-white p-4">
              <Mono className="block text-[11px] text-graphite">1–3 ★</Mono>
              <div className="mb-1 mt-1.5 text-sm font-semibold">Tell the manager</div>
              <div className="text-xs leading-[1.45] text-muted">Google option stays visible too</div>
            </div>
          </div>
          {wire}
          <div className={cn(box, "flex items-center gap-3.5 border-ink bg-ink px-5 py-4 text-white")}>
            <PathIcon d="M4 7h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4z" size={20} strokeWidth={1.7} className="text-lilac" />
            <div>
              <div className="text-sm font-semibold">Ticket #128 · &ldquo;Food was cold&rdquo;</div>
              <Mono className="mt-[3px] block text-[11px] text-[#B8B8C0]">Manager alerted on WhatsApp · SLA 2h</Mono>
            </div>
          </div>
        </div>
      </Frame>
    </Section>
  );
}

export function Stats() {
  return (
    <Section>
      <Frame>
        <div className="border-b border-line px-gutter pb-8 pt-12 text-center">
          <SectionHeading size="text-[clamp(28px,3.4vw,42px)]">Results our customers measure</SectionHeading>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {stats.map((s) => (
            <div key={s.l} className={cn(cell, "px-cell py-8")}>
              <div className="disp text-[52px] font-medium">{s.v}</div>
              <div className="mt-1.5 text-sm text-graphite">{s.l}</div>
            </div>
          ))}
        </div>
        <figure className="m-0 flex flex-wrap items-start gap-x-16 gap-y-8 px-gutter py-10">
          <figcaption className="flex flex-none flex-col gap-1.5">
            <div className="flex h-10 w-[120px] items-center justify-center border border-dashed border-track">
              <Mono className="text-[11px] text-muted">[Logo]</Mono>
            </div>
            <span className="text-[13px] text-muted">[Name, Role]</span>
          </figcaption>
          <blockquote className="m-0 flex-[1_1_420px] text-xl leading-[1.5]">
            “[Customer quote — what changed after using Skanor, in their words. Replace with a real testimonial.]”
          </blockquote>
        </figure>
      </Frame>
    </Section>
  );
}

const industryIds = ["retail", "food", "salon", "clinic", "realestate", "mfg", "facility", "construction"];

export function IndustriesTeaser() {
  return (
    <Section>
      <Frame>
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line px-gutter pb-10 pt-[clamp(48px,6vw,80px)]">
          <div className="flex flex-col gap-3.5">
            <Eyebrow>Industries</Eyebrow>
            <SectionHeading>Set up for your kind of business</SectionHeading>
          </div>
          <Button href="/industries">All industries</Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          {industries.map((i, idx) => (
            <Link
              key={i.t}
              href={`/industries#${industryIds[idx]}`}
              className={cn(cell, "flex flex-col gap-3.5 px-cell py-7 text-ink no-underline transition-colors hover:bg-white")}
            >
              <PathIcon d={i.ic} size={26} strokeWidth={1.5} />
              <span className="text-[17px] font-semibold">{i.t}</span>
              <span className="text-sm leading-[1.5] text-graphite">{i.d}</span>
            </Link>
          ))}
        </div>
      </Frame>
    </Section>
  );
}

export function AdvancedDark() {
  return (
    <Section className="on-dark bg-ink text-white">
      <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <div className="flex flex-col gap-[22px] px-gutter py-[clamp(48px,6vw,88px)]">
          <Mono className="text-xs uppercase tracking-[0.06em] text-lilac">Advanced · For brands &amp; manufacturers</Mono>
          <h2 className="m-0 font-display text-[clamp(34px,4.4vw,56px)] font-semibold leading-[1.02] tracking-display">
            A unique QR on every product you ship.
          </h2>
          <p className="m-0 text-base leading-[1.6] text-[#C9C9D1]">
            Replace paper warranty cards. Every unit gets its own code: customers register warranty, watch setup videos,
            verify it&rsquo;s genuine and raise service requests — and you finally know who bought your product.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px border border-ink-2 bg-ink-2">
            {advancedPoints.map((a) => (
              <div key={a.n} className="bg-ink p-[18px]">
                <Mono className="block text-[11px] text-lilac">{a.n}</Mono>
                <div className="mt-1.5 text-[15px] font-semibold">{a.t}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/contact" variant="primary" className="bg-white text-ink hover:border-mist hover:bg-mist hover:text-ink border-white">
              Talk to sales
            </Button>
            <Button href="/docs" className="border-white bg-transparent text-white hover:bg-white/10 hover:text-white">
              View API docs
            </Button>
          </div>
        </div>
        <div
          className="flex items-center justify-center border-ink-2 p-[clamp(32px,4vw,64px)] md:border-l"
          style={{ backgroundImage: "radial-gradient(#2E2E36 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
          <div className="box-border flex w-full max-w-[380px] flex-col gap-4 bg-white p-6 text-ink">
            <div className="flex items-center justify-between gap-2">
              <Mono className="text-[11px] text-muted">SERIAL · AQ-24-118392</Mono>
              <Mono className="bg-success-bg px-2 py-1 text-[10px] text-success-fg">GENUINE</Mono>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-[72px] w-[72px] flex-none items-center justify-center bg-mist text-graphite">
                <PathIcon d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" size={32} strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-base font-semibold">[Product name] Water Purifier</div>
                <div className="mt-1 text-[13px] text-muted">Made [Month YYYY] · Batch B-07</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Mono className="bg-ink px-2 py-3 text-center text-[11px] text-white">REGISTER WARRANTY</Mono>
              <Mono className="border border-ink px-2 py-3 text-center text-[11px]">BOOK SERVICE</Mono>
              <Mono className="border border-line px-2 py-3 text-center text-[11px]">SETUP VIDEO</Mono>
              <Mono className="border border-line px-2 py-3 text-center text-[11px]">USER MANUAL</Mono>
            </div>
          </div>
        </div>
      </Frame>
    </Section>
  );
}

export function IntegrationsStrip() {
  return (
    <Section>
      <Frame className="flex flex-wrap items-center justify-between gap-6 px-gutter py-12">
        <div className="max-w-[360px]">
          <Eyebrow>Integrations</Eyebrow>
          <h3 className="mb-0 mt-2.5 font-display text-[30px] font-semibold tracking-display">Works with the tools you already use</h3>
        </div>
        <ul className="m-0 flex flex-[1_1_480px] list-none flex-wrap justify-start gap-2.5 p-0 md:justify-end">
          {integrations.map((n) => (
            <li key={n} className="tabular border border-line bg-white px-3.5 py-2.5 text-xs">
              {n}
            </li>
          ))}
        </ul>
      </Frame>
    </Section>
  );
}

export function PricingTeaser() {
  return (
    <Section>
      <Frame>
        <div className="flex flex-col items-center gap-3.5 border-b border-line px-gutter pb-10 pt-[clamp(48px,6vw,80px)] text-center">
          <Eyebrow className="self-center">Pricing</Eyebrow>
          <SectionHeading>Start free. Pay per location as you grow.</SectionHeading>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {pricingTeaser.map((t) => (
            <div key={t.n} className={cn(cell, "flex flex-col gap-3 px-[clamp(20px,2.4vw,28px)] py-8", t.highlight ? "bg-info-bg" : "bg-white")}>
              <Mono className="text-xs">{t.n}</Mono>
              <span className="disp text-[34px] font-medium">{t.p}</span>
              <span className="text-sm leading-[1.5] text-graphite">{t.d}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center p-6">
          <Button href="/pricing">Compare plans</Button>
        </div>
      </Frame>
    </Section>
  );
}

export function HomeFaq() {
  return (
    <Section>
      <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
        <div className="border-r border-line px-gutter py-[clamp(48px,6vw,80px)] max-md:border-r-0">
          <Eyebrow>FAQ</Eyebrow>
          <SectionHeading className="mt-3.5" size="text-[clamp(32px,4vw,48px)]">
            Questions, answered
          </SectionHeading>
        </div>
        <FaqList items={homeFaqs} />
      </Frame>
    </Section>
  );
}

export function HomeCta() {
  return (
    <CtaBand
      title="Put your first QR to work today."
      actions={<CtaButtons secondary="Book a demo" secondaryHref="/contact" />}
    >
      Set up in under 10 minutes. Free forever for one location.
    </CtaBand>
  );
}
