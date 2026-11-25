import type { Metadata } from "next";
import { CtaBand, Frame, Mono, PathIcon, Section } from "@/components/marketing/parts";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/Button";
import { industryPages } from "@/lib/content/industries";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Industries",
  description: "Pick your business type at sign-up and Skanor switches on the right modules, templates and QR placements.",
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Your workspace sets itself up for your industry."
        lede="Pick your business type at sign-up and Skanor switches on the right modules, templates and QR placements for you."
        className="pb-10 gap-[22px]"
      >
        <nav aria-label="Industries" className="mt-2 flex flex-wrap gap-2">
          {industryPages.map((i) => (
            <a
              key={i.id}
              href={`#${i.id}`}
              className="tabular border border-line bg-white px-3.5 py-2.5 text-xs text-ink no-underline hover:bg-mist"
            >
              {i.t}
            </a>
          ))}
        </nav>
      </PageHero>

      {industryPages.map((i) => (
        <Section key={i.id} id={i.id} className="scroll-mt-4">
          <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
            <div className="flex flex-col gap-3.5 border-r border-line px-[clamp(20px,3vw,40px)] py-9">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center bg-ink text-white">
                  <PathIcon d={i.ic} size={24} />
                </div>
                <Mono className="text-xs text-muted">{i.n}</Mono>
              </div>
              <h2 className="m-0 font-display text-[32px] font-semibold tracking-display">{i.t}</h2>
              <p className="m-0 text-[15px] leading-[1.55] text-graphite">{i.d}</p>
            </div>
            <div className="flex flex-col gap-3 border-r border-line bg-thead px-[clamp(20px,3vw,40px)] py-9">
              <h3 className="tabular m-0 text-[11px] font-normal tracking-[0.06em] text-muted">WHERE THE QR GOES</h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {i.where.map((w) => (
                  <li key={w} className="flex gap-2.5 text-sm">
                    <span aria-hidden="true" className="mt-1 box-border h-2.5 w-2.5 flex-none border-2 border-ink" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3.5 bg-white px-[clamp(20px,3vw,40px)] py-9">
              <h3 className="tabular m-0 text-[11px] font-normal tracking-[0.06em] text-muted">MODULES SWITCHED ON</h3>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {i.mods.map((m) => (
                  <li key={m} className="tabular border border-[#E2D9FF] bg-info-bg px-2.5 py-2 text-xs text-info-fg">
                    {m}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                <Mono className="text-xs text-graphite">Best plan: {i.plan}</Mono>
                <Link href="/signup" className="text-sm font-semibold underline-offset-2 hover:underline">
                  Start with this setup →
                </Link>
              </div>
            </div>
          </Frame>
        </Section>
      ))}

      <CtaBand
        align="split"
        title="Don’t see your industry?"
        actions={<Button href="/contact" variant="primary">Talk to us</Button>}
      >
        Tell us how you’d use QR codes — we’ll set up a workspace with you.
      </CtaBand>
    </>
  );
}
