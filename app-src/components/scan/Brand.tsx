"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const LogoContext = createContext<string | null>(null);

/** Wrap a customer page so its header shows the business's uploaded logo (a file id) instead of initials. */
export function ScanBrand({ logoId, children }: { logoId: string | null | undefined; children: ReactNode }) {
  return <LogoContext.Provider value={logoId ?? null}>{children}</LogoContext.Provider>;
}

/** The round-cornered mark in a scan page header: the logo when there is one, else the business's initials. */
export function BizMark({ initials, className }: { initials: string; className?: string }) {
  const logoId = useContext(LogoContext);
  if (logoId) {
    return (
      // decorative: the business name sits right beside it
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/f/${logoId}`} alt="" width={40} height={40} className={cn("h-10 w-10 flex-none rounded-xl border border-line bg-white object-contain", className)} />
    );
  }
  return (
    <div aria-hidden="true" className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink text-sm font-bold text-white", className)}>
      {initials}
    </div>
  );
}
