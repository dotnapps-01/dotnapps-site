import { Plus } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Max-width page frame used inside every marketing section. */
export function Frame({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div {...rest} className={cn("relative mx-auto max-w-frame", className)} />;
}

/** Full-width section wrapper. */
export function Section({ className, ...rest }: ComponentPropsWithoutRef<"section">) {
  return <section {...rest} className={cn("relative", className)} />;
}

/** Inline SVG icon from one of the design's 24×24 path strings. */
export function PathIcon({
  d,
  size = 20,
  strokeWidth = 1.6,
  fill = "none",
  className,
}: {
  d: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("flex-none", className)}
    >
      <path d={d} />
    </svg>
  );
}

export const STAR_PATH = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

/** Row of filled stars (decorative). */
export function Stars({ count = 5, size = 16, gap = "gap-0.5" }: { count?: number; size?: number; gap?: string }) {
  return (
    <span className={cn("flex text-ink", gap)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PathIcon key={i} d={STAR_PATH} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

const CHECK = "M5 12l5 5 9-10";
export function CheckList({
  items,
  size = 16,
  className,
  itemClassName,
}: {
  items: string[];
  size?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2.5 p-0", className)}>
      {items.map((it) => (
        <li key={it} className={cn("flex gap-2.5 text-sm leading-[1.4] text-[#1C1C21]", itemClassName)}>
          <PathIcon d={CHECK} size={size} strokeWidth={2} className="mt-0.5 text-ink" />
          {it}
        </li>
      ))}
    </ul>
  );
}

/** Small tabular-figure text (the design's ".mono"). */
export function Mono({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span {...rest} className={cn("tabular", className)} />;
}

/** Marble call-to-action band that closes most pages. */
export function CtaBand({
  title,
  children,
  actions,
  align = "center",
  className,
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  align?: "center" | "split";
  className?: string;
}) {
  const split = align === "split";
  return (
    <Section>
      <Frame
        className={cn(
          "bg-marble px-gutter py-[clamp(56px,7vw,104px)]",
          split
            ? "flex flex-wrap items-center justify-between gap-8"
            : "flex flex-col items-center gap-5 text-center",
          className,
        )}
      >
        <div className={split ? "max-w-[720px]" : "max-w-[900px]"}>
          <h2 className="m-0 font-display text-[clamp(34px,4.6vw,64px)] font-semibold leading-[1.02] tracking-display">
            {title}
          </h2>
          {children ? <p className="mx-0 mb-0 mt-3.5 text-base text-graphite sm:text-[17px]">{children}</p> : null}
        </div>
        <div className={cn("flex flex-wrap gap-3", !split && "justify-center")}>{actions}</div>
      </Frame>
    </Section>
  );
}

export function CtaButtons({ primary = "Start free", secondary, secondaryHref }: { primary?: string; secondary: string; secondaryHref: string }) {
  return (
    <>
      <Button href="/signup" variant="primary">
        {primary}
      </Button>
      <Button href={secondaryHref}>{secondary}</Button>
    </>
  );
}

/** Native <details> accordion rows (keyboard + screen-reader friendly with no JS). */
export function FaqList({ items, compact }: { items: { q: string; a: string }[]; compact?: boolean }) {
  return (
    <div>
      {items.map((it) => (
        <details key={it.q} className="group border-b border-line px-5 py-[22px] sm:px-[clamp(20px,3vw,40px)]">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-start justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden",
              compact ? "text-base" : "text-[17px]",
            )}
          >
            {it.q}
            <Plus
              size={18}
              aria-hidden="true"
              className="mt-0.5 flex-none transition-transform group-open:rotate-45"
            />
          </summary>
          <p className="m-0 mt-3 text-[15px] leading-[1.6] text-graphite">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Eyebrow + H2 header used at the top of most sections. */
export function SectionHeading({
  className,
  size = "text-[clamp(32px,4vw,52px)]",
  children,
}: {
  className?: string;
  size?: string;
  children: ReactNode;
}) {
  return <h2 className={cn("m-0 font-display font-semibold leading-[1.04] tracking-display", size, className)}>{children}</h2>;
}
