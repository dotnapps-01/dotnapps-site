"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/NewBadge";
import { cn } from "@/lib/cn";
import { plans } from "@/lib/content/pricing";
import { BillingToggle, type Billing } from "./BillingToggle";
import { CheckList, Frame, Mono, Section } from "./parts";

/** Pricing hero (with billing toggle) and plan cards. Prices stay as [₹ PRICE] placeholders until confirmed. */
export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");
  return (
    <>
      <Section>
        <Frame className="flex flex-col items-center gap-5 px-gutter pb-10 pt-[clamp(56px,7vw,96px)] text-center">
          <Eyebrow className="self-center">Pricing</Eyebrow>
          <h1 className="m-0 font-display text-[clamp(42px,6vw,80px)] font-semibold leading-none tracking-display">
            Simple plans. Per location.
          </h1>
          <p className="m-0 max-w-[580px] text-lg text-graphite">
            Start free. Upgrade when you need more modules. All prices exclude GST.
          </p>
          <BillingToggle value={billing} onChange={setBilling} />
        </Frame>
      </Section>
      <Section>
        <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {plans.map((t) => (
            <div
              key={t.n}
              className={cn(
                "relative flex flex-col gap-4 border-b border-r border-line px-[clamp(20px,2vw,28px)] py-8",
                t.highlight ? "bg-info-bg" : "bg-white",
              )}
            >
              {t.pop ? (
                <Mono className="absolute inset-x-0 top-0 bg-ink p-[5px] text-center text-[10px] text-white">MOST POPULAR</Mono>
              ) : null}
              <Mono className="mt-3 text-xs text-ink">{t.n}</Mono>
              <div>
                <span className="disp text-[38px] font-medium">{t.p}</span>
                <span className="text-[13px] text-muted">
                  {" "}
                  {t.per}
                  {t.per && billing === "yearly" ? " · billed yearly" : ""}
                </span>
              </div>
              <p className="m-0 min-h-[42px] text-sm leading-[1.5] text-graphite">{t.d}</p>
              <Button href={t.href} variant={t.primary ? "primary" : "secondary"} className="w-full">
                {t.cta}
              </Button>
              <CheckList items={t.f} size={15} className="mt-2 gap-[9px]" itemClassName="gap-2 text-[13px]" />
            </div>
          ))}
        </Frame>
      </Section>
    </>
  );
}
