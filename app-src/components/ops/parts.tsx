"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, displayH, fieldCls } from "@/components/engage/chrome";

/** A labelled field with its inline error, for the customer pages. */
export function Row({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export const input = (error?: string) => cn(fieldCls, error && "border-danger-fg");

/** The marble header block at the top of a customer page. */
export function Hero({ lang, title, sub }: { lang: Lang; title: string; sub?: string }) {
  return (
    <div className="rounded-[22px] bg-marble p-5">
      <h1 className={cn(displayH(lang), "text-[26px]")}>{title}</h1>
      {sub ? <p className="mx-0 mb-0 mt-1.5 text-sm text-graphite">{sub}</p> : null}
    </div>
  );
}

export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function Success({ lang, title, body, children }: { lang: Lang; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 text-center" role="status">
      <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-bg">
        <Check size={36} strokeWidth={1.8} className="text-success-fg" />
      </div>
      <h1 className={cn(displayH(lang), "text-[26px]")}>{title}</h1>
      {body ? <p className="m-0 text-sm text-graphite">{body}</p> : null}
      {children}
    </div>
  );
}
