"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/pages";
import { LANGS, type Lang } from "@/lib/review-i18n";
import { E } from "@/lib/engage-i18n";
import { BizMark } from "@/components/scan/Brand";

export const primaryBtn =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-0 bg-ink px-4 text-center text-[15px] font-semibold text-white no-underline transition-colors hover:bg-ink-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
export const outlineBtn =
  "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-track bg-white px-4 text-center text-[15px] font-semibold text-ink no-underline transition-colors hover:bg-mist hover:text-ink";
export const fieldCls = "min-h-[46px] w-full rounded-[14px] border border-line bg-white px-3.5 text-sm text-ink placeholder:text-faint";
export const chip = (on: boolean) =>
  cn("min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-paper");
export const displayH = (lang: Lang) => cn("m-0 font-display font-semibold leading-[1.1] outline-none", lang === "en" ? "tracking-heading" : "tracking-normal");

/** Business header, page content, language chips and the "Powered by" line shared by every customer page. */
export function Shell({
  business,
  location,
  lang,
  onLang,
  children,
  wide,
  embedded,
}: {
  business: string;
  location: string;
  lang: Lang;
  onLang: (l: Lang) => void;
  children: ReactNode;
  wide?: boolean;
  /** inside the builder's phone preview: no full-screen height */
  embedded?: boolean;
}) {
  const t = E[lang];
  return (
    <div lang={lang} className={cn("mx-auto flex w-full flex-col gap-3.5 px-[22px] pb-[22px] pt-6", embedded ? "min-h-0" : "min-h-screen", wide ? "max-w-[520px]" : "max-w-[430px]")}>
      <header className="flex items-center gap-2.5">
        <BizMark initials={initialsOf(business)} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{business}</div>
          {location ? <div className="truncate text-xs text-muted">{location}</div> : null}
        </div>
      </header>
      {children}
      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        <div role="group" aria-label={t.language} className="flex flex-wrap justify-center gap-2">
          {LANGS.map((l) => (
            <button key={l.key} type="button" lang={l.key} aria-pressed={lang === l.key} onClick={() => onLang(l.key)} className={chip(lang === l.key)}>
              {l.native}
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-muted">{t.powered}</div>
      </div>
    </div>
  );
}

export const ErrorText = ({ children }: { children?: string }) =>
  children ? (
    <p role="alert" className="m-0 text-xs text-danger-fg">
      {children}
    </p>
  ) : null;

export async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}
