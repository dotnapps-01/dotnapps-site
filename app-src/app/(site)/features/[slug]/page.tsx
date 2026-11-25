import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand, CtaButtons, Frame, Mono, Section } from "@/components/marketing/parts";
import { ReviewVisual } from "@/components/marketing/ReviewVisual";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/NewBadge";
import {
  reviewFeatures,
  reviewFlow,
  reviewModule,
  reviewProblems,
  reviewSteps,
} from "@/lib/content/module-reviews";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Module page template (design/ModuleReviews.dc.html). Add a module by adding an entry here:
 * copy/data in lib/content, plus an optional hero visual.
 */
type ModuleContent = {
  slug: string;
  breadcrumb: string[];
  title: string;
  lede: string;
  demoHref: string;
  flowHeading: string;
  flowLede: string;
  featuresHeading: string;
  setupHeading: string;
  setupLede: string;
  ctaTitle: string;
  problems: { n: string; a: string; b: string }[];
  flow: { n: string; t: string; d: string; arrow: boolean }[];
  features: { n: string; t: string; d: string }[];
  steps: { n: string; t: string; d: string }[];
  visual: ReactNode;
};

const modules: Record<string, ModuleContent> = {
  [reviewModule.slug]: {
    ...reviewModule,
    problems: reviewProblems,
    flow: reviewFlow,
    features: reviewFeatures,
    steps: reviewSteps,
    visual: <ReviewVisual />,
  },
};

export function generateStaticParams() {
  return Object.keys(modules).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = modules[slug];
  return m ? { title: m.breadcrumb[m.breadcrumb.length - 1], description: m.lede } : {};
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = modules[slug];
  if (!m) notFound();

  return (
    <>
      <Section>
        <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))]">
          <div className="flex flex-col justify-center gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
            <nav aria-label="Breadcrumb" className="tabular text-xs text-muted">
              <Link href="/features" className="text-muted no-underline hover:text-ink">
                ← {m.breadcrumb.join(" / ")}
              </Link>
            </nav>
            <h1 className="m-0 font-display text-[clamp(42px,5.6vw,76px)] font-semibold leading-none tracking-display">
              {m.title}
            </h1>
            <p className="m-0 max-w-[520px] text-lg leading-[1.55] text-graphite">{m.lede}</p>
            <div className="flex flex-wrap gap-3">
              <Button href="/signup" variant="primary">
                Start free
              </Button>
              <Button href={m.demoHref}>See the customer view</Button>
            </div>
          </div>
          {m.visual}
        </Frame>
      </Section>

      <Section>
        <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          {m.problems.map((p) => (
            <div key={p.n} className="flex flex-col gap-2.5 border-r border-line px-[clamp(20px,2.6vw,36px)] py-9 max-md:border-b">
              <Mono className="text-xs text-muted">{p.n} · THE PROBLEM</Mono>
              <p className="m-0 text-[15px] leading-[1.5] text-muted">{p.a}</p>
              <Mono className="mt-2 text-xs text-ink">WITH SKANOR</Mono>
              <p className="m-0 text-lg font-semibold leading-[1.4]">{p.b}</p>
            </div>
          ))}
        </Frame>
      </Section>

      <Section>
        <Frame>
          <div className="flex flex-col items-center gap-3 px-gutter pb-8 pt-[clamp(48px,6vw,80px)] text-center">
            <Eyebrow className="self-center">The flow</Eyebrow>
            <h2 className="m-0 font-display text-[clamp(32px,4vw,50px)] font-semibold leading-[1.04] tracking-display">
              {m.flowHeading}
            </h2>
            <p className="m-0 max-w-[620px] text-base leading-[1.55] text-graphite">{m.flowLede}</p>
          </div>
          <ol className="m-0 flex list-none flex-wrap items-center justify-center gap-y-4 px-gutter pb-16 pt-4">
            {m.flow.map((f) => (
              <li key={f.t} className="flex items-center">
                <div className="box-border w-[200px] overflow-hidden rounded-card border border-line border-t-[3px] border-t-ink bg-white p-[18px]">
                  <Mono className="block text-[11px] text-muted">{f.n}</Mono>
                  <div className="mb-1 mt-1.5 text-[15px] font-semibold">{f.t}</div>
                  <div className="text-[13px] leading-[1.45] text-graphite">{f.d}</div>
                </div>
                {f.arrow ? (
                  <svg width="40" height="16" viewBox="0 0 40 16" aria-hidden="true" className="max-sm:hidden">
                    <path d="M2 8h34M30 3l6 5-6 5" fill="none" stroke="#0E0E10" strokeWidth="1.5" />
                  </svg>
                ) : null}
              </li>
            ))}
          </ol>
        </Frame>
      </Section>

      <Section>
        <Frame>
          <div className="border-b border-line px-gutter pb-8 pt-12">
            <Eyebrow>What&rsquo;s inside</Eyebrow>
            <h2 className="mb-0 mt-3 font-display text-[clamp(30px,3.6vw,44px)] font-semibold leading-[1.04] tracking-display">
              {m.featuresHeading}
            </h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            {m.features.map((f) => (
              <div key={f.n} className="border-b border-r border-line bg-white px-cell py-7">
                <Mono className="block text-xs text-ink">{f.n}</Mono>
                <h3 className="mb-1.5 mt-2.5 text-[17px] font-semibold">{f.t}</h3>
                <p className="m-0 text-sm leading-[1.5] text-graphite">{f.d}</p>
              </div>
            ))}
          </div>
        </Frame>
      </Section>

      <Section>
        <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))]">
          <div className="flex flex-col gap-4 border-r border-line px-gutter py-[clamp(48px,6vw,80px)] max-md:border-r-0">
            <Eyebrow>Setup</Eyebrow>
            <h2 className="m-0 font-display text-[clamp(30px,3.6vw,44px)] font-semibold leading-[1.04] tracking-display">
              {m.setupHeading}
            </h2>
            <p className="m-0 text-base leading-[1.55] text-graphite">{m.setupLede}</p>
            <div>
              <Button href="/onboarding" variant="primary">
                Set it up now
              </Button>
            </div>
          </div>
          <ol className="m-0 list-none p-0">
            {m.steps.map((s) => (
              <li
                key={s.n}
                className={cn("flex items-start gap-5 border-b border-line px-5 py-6 sm:px-[clamp(20px,3vw,40px)]")}
              >
                <Mono className="text-[28px] leading-none text-ink">{s.n}</Mono>
                <div>
                  <div className="text-[17px] font-semibold">{s.t}</div>
                  <div className="mt-1 text-sm text-graphite">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </Frame>
      </Section>

      <CtaBand title={m.ctaTitle} actions={<CtaButtons secondary="See pricing" secondaryHref="/pricing" />} />
    </>
  );
}
