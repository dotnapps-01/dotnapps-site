import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Grey pill with a small black "+ New" chip inside. */
export function NewBadge({ children, chip = "+ New", className }: { children: ReactNode; chip?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full bg-mist py-[5px] pl-[5px] pr-3.5 text-sm font-medium text-ink",
        className,
      )}
    >
      <span className="rounded-full bg-ink px-2.5 py-[3px] text-xs font-semibold text-white">{chip}</span>
      {children}
    </span>
  );
}

/** Eyebrow label: grey pill with the marble dot (the design's ".lbl"). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex self-start items-center gap-2.5 rounded-full bg-mist py-[5px] pl-[5px] pr-3.5 text-sm font-medium leading-[1.2] text-ink",
        className,
      )}
    >
      <span aria-hidden="true" className="h-[22px] w-[22px] flex-none rounded-full bg-marble-dot" />
      {children}
    </span>
  );
}
