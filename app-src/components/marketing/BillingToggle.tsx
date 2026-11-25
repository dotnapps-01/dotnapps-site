"use client";

import { cn } from "@/lib/cn";

export type Billing = "monthly" | "yearly";

/** Monthly / yearly segmented control (toggle buttons, not tabs). */
export function BillingToggle({ value, onChange }: { value: Billing; onChange: (v: Billing) => void }) {
  const opt = (v: Billing, label: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(v)}
      className={cn(
        "tabular min-h-11 px-5 text-xs transition-colors",
        value === v ? "bg-ink text-white" : "bg-white text-ink hover:bg-mist",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Billing period" className="inline-flex overflow-hidden border border-ink bg-white">
      {opt("monthly", "MONTHLY")}
      {opt("yearly", "YEARLY · 2 MONTHS FREE")}
    </div>
  );
}
