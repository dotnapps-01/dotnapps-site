import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, CtaButtons, Frame, Mono, PathIcon, Section } from "@/components/marketing/parts";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/Button";
import { featureLevels, qrTypes } from "@/lib/content/features";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Features",
  description: "Four levels, one dashboard: QR codes, reviews, loyalty, tickets, attendance, product warranty, API and more.",
};

/** Modules that have their own detail page. */
const moduleLinks: Record<string, string> = { "Review Assistant": "/features/review-assistant" };

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features · 40+ modules"
        title="Everything a QR code can do for a business — in one place."
        lede="Four levels, one dashboard. Turn modules on when you need them — your codes, contacts and data carry over."
      >
        <nav aria-label="Levels" className="mt-2 flex flex-wrap gap-2.5">
          {featureLevels.map((lv) => (
            <a
              key={lv.id}
              href={`#${lv.id}`}
              className="tabular border border-ink bg-white px-4 py-3 text-xs text-ink no-underline hover:bg-mist"
            >
              {lv.n} · {lv.name}
            </a>
          ))}
        </nav>
      </PageHero>

      {featureLevels.map((lv) => (
        <Section key={lv.id} id={lv.id} className="scroll-mt-4">
          <Frame>
            <div
              className={cn(
                "flex flex-wrap items-end justify-between gap-x-12 gap-y-5 border-b border-line px-gutter pb-9 pt-12",
                lv.highlight ? "bg-info-bg" : "bg-paper",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-6">
                <Mono className="text-[clamp(48px,6vw,80px)] leading-none">{lv.n}</Mono>
                <div>
                  <h2 className="m-0 font-display text-[clamp(32px,4vw,48px)] font-semibold tracking-display">{lv.name}</h2>
                  <p className="mb-0 mt-1.5 text-base text-graphite">{lv.tag}</p>
                </div>
              </div>
              <Mono className="border border-ink bg-white px-3 py-2 text-xs">INCLUDED FROM {lv.plan}</Mono>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
              {lv.mods.map((m) => {
                const href = moduleLinks[m.t];
                return (
                  <div
                    key={m.t}
                    className="flex flex-col gap-3 border-b border-r border-line bg-white px-cell pb-8 pt-7"
                  >
                    <div className="flex h-10 w-10 items-center justify-center border border-line bg-paper text-ink">
                      <PathIcon d={m.ic} size={20} />
                    </div>
                    <h3 className="mb-0 mt-1 text-lg font-semibold">
                      {href ? (
                        <Link href={href} className="no-underline hover:underline">
                          {m.t}
                        </Link>
                      ) : (
                        m.t
                      )}
                    </h3>
                    <p className="m-0 text-sm leading-[1.55] text-graphite">{m.d}</p>
                    <ul className="mb-0 mt-1 flex list-none flex-col gap-1.5 p-0">
                      {m.b.map((b) => (
                        <li key={b} className="tabular flex gap-2 text-xs text-[#1C1C21]">
                          <span aria-hidden="true">→</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                    {href ? (
                      <div className="mt-auto pt-2">
                        <Button href={href} size="sm">
                          Explore module
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {lv.showTypes ? (
              <div className="flex flex-col gap-4 border-b border-line px-gutter py-8">
                <Mono className="text-xs uppercase tracking-[0.06em] text-muted">QR types included</Mono>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {qrTypes.map((t) => (
                    <li key={t} className="tabular border border-line bg-white px-3 py-[9px] text-xs">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Frame>
        </Section>
      ))}

      <CtaBand
        align="split"
        title="Not sure which modules you need?"
        actions={<CtaButtons secondary="Compare plans" secondaryHref="/pricing" />}
      />
    </>
  );
}
