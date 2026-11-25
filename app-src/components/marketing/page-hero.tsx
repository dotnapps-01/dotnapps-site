import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/NewBadge";
import { cn } from "@/lib/cn";
import { Frame, Section } from "./parts";

/** Left-aligned hero used by Features and Industries (eyebrow, H1, lede, optional jump links). */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Section>
      <Frame className={cn("flex flex-col gap-[22px] px-gutter pb-12 pt-[clamp(56px,7vw,104px)]", className)}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="m-0 max-w-[1000px] font-display text-[clamp(42px,6vw,80px)] font-semibold leading-none tracking-display">
          {title}
        </h1>
        <p className="m-0 max-w-[640px] text-lg leading-[1.55] text-graphite">{lede}</p>
        {children}
      </Frame>
    </Section>
  );
}
