import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type KpiTone = "up" | "down" | "warn" | "flat";
const tones: Record<KpiTone, string> = {
  up: "text-success-fg",
  down: "text-danger-fg",
  warn: "text-warning-fg",
  flat: "text-graphite",
};

type Props = {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  tone?: KpiTone;
  /** "card" = standalone bordered tile; "cell" = tile inside a <KpiStrip> */
  variant?: "card" | "cell";
  className?: string;
};

export function KpiTile({ label, value, delta, tone = "up", variant = "card", className }: Props) {
  const isCard = variant === "card";
  return (
    <div
      className={cn(
        isCard
          ? "rounded-card border border-line bg-surface p-4"
          : "flex flex-col gap-1.5 border-r border-line-soft px-[18px] py-4",
        className,
      )}
    >
      <div className="k">{label}</div>
      <div className={cn("font-display tracking-display", isCard ? "mt-1.5 text-[32px] font-semibold" : "text-[30px] font-medium")}>
        {value}
      </div>
      {delta ? <div className={cn("tabular text-xs", isCard && "mt-1", tones[tone])}>{delta}</div> : null}
    </div>
  );
}

/** Row of KPI cells divided by hairlines (dashboard layout). */
export function KpiStrip({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...rest}
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    />
  );
}
