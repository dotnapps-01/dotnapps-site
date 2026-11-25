import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/NewBadge";
import { FaqList, Frame, Mono, Section, SectionHeading } from "@/components/marketing/parts";
import { PricingPlans } from "@/components/marketing/PricingPlans";
import { addons, billingFaqs, compareRows, planColumns } from "@/lib/content/pricing";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple plans, per location. Start free and upgrade when you need more modules. All prices exclude GST.",
};

type Cell = { kind: string; text: string };

function CompareCell({ v }: { v: Cell }) {
  if (v.kind === "yes")
    return (
      <>
        <Check size={16} strokeWidth={2.2} aria-hidden="true" className="text-info-fg" />
        <span className="sr-only">Included</span>
      </>
    );
  if (v.kind === "no")
    return (
      <>
        <span aria-hidden="true" className="text-faint">
          —
        </span>
        <span className="sr-only">Not included</span>
      </>
    );
  return <span>{v.text}</span>;
}

export default function PricingPage() {
  return (
    <>
      <PricingPlans />

      <Section>
        <Frame>
          <div className="px-gutter pb-7 pt-12">
            <Eyebrow>Compare</Eyebrow>
            <SectionHeading className="mt-3" size="text-[clamp(30px,3.6vw,44px)]">
              Every feature, by plan
            </SectionHeading>
          </div>
          <div
            role="region"
            aria-label="Plan comparison table, scrolls sideways on small screens"
            tabIndex={0}
            className="relative overflow-x-auto border-t border-line"
          >
            <table className="w-full min-w-[900px] border-collapse">
              <caption className="sr-only">Features included in each plan</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="w-[32%] border-b border-line bg-thead px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.02em] text-graphite"
                  >
                    Feature
                  </th>
                  {planColumns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="border-b border-line bg-thead px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.02em] text-graphite"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r) =>
                  "group" in r ? (
                    <tr key={r.group}>
                      <th
                        scope="rowgroup"
                        colSpan={6}
                        className="tabular border-b border-line bg-info-bg px-4 pb-3.5 pt-[18px] text-left text-xs font-normal tracking-[0.06em] text-ink"
                      >
                        {r.group}
                      </th>
                    </tr>
                  ) : (
                    <tr key={r.label} className="bg-white">
                      <th scope="row" className="border-b border-line px-4 py-3.5 text-left text-sm font-normal text-ink">
                        {r.label}
                      </th>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          className={cn(
                            "tabular border-b border-line px-4 py-3.5 text-left text-[13px]",
                            v.kind === "text" ? "text-ink" : "",
                          )}
                        >
                          <CompareCell v={v} />
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Frame>
      </Section>

      <Section>
        <Frame>
          <div className="border-b border-line px-gutter pb-7 pt-12">
            <Eyebrow>Add-ons</Eyebrow>
            <SectionHeading className="mt-3" size="text-[clamp(30px,3.6vw,44px)]">
              Pay only for what you use
            </SectionHeading>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {addons.map((a) => (
              <div key={a.t} className="flex flex-col gap-2 border-b border-r border-line bg-white px-[clamp(20px,2.4vw,28px)] py-7">
                <h3 className="m-0 text-base font-semibold">{a.t}</h3>
                <Mono className="text-sm text-ink">{a.p}</Mono>
                <span className="text-[13px] leading-[1.5] text-graphite">{a.d}</span>
              </div>
            ))}
          </div>
        </Frame>
      </Section>

      <Section>
        <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
          <div className="border-r border-line px-gutter py-[clamp(48px,6vw,72px)] max-md:border-r-0">
            <Eyebrow>Billing FAQ</Eyebrow>
            <SectionHeading className="mt-3.5" size="text-[clamp(30px,3.6vw,44px)]">
              Good to know
            </SectionHeading>
          </div>
          <FaqList items={billingFaqs} compact />
        </Frame>
      </Section>
    </>
  );
}
