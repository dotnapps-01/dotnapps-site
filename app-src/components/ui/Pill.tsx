import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<PillTone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-mist text-graphite",
};

/** Status pill. Lilac (info) is the only non-neutral accent besides status colours. */
export function Pill({
  tone = "neutral",
  className,
  ...rest
}: { tone?: PillTone } & ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-[1.2] tracking-[0.04em]",
        tones[tone],
        className,
      )}
    />
  );
}

export { Pill as Badge };
