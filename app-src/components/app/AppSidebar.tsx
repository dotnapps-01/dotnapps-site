"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/cn";
import { currentUser, locations, plan, sidebarBadges } from "@/lib/mock/app";
import { appNav } from "@/lib/routes";
import { LocationSwitcher } from "./LocationSwitcher";

type Props = {
  /** shown only below lg, where the sidebar is a drawer */
  onClose?: () => void;
};

/** App sidebar (design/AppSidebar.dc.html). Every app route is linked; active state comes from the URL. */
export function AppSidebar({ onClose }: Props) {
  const pathname = usePathname();
  const pct = Math.round((plan.used / plan.limit) * 100);

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-surface text-ink">
      <div className="flex flex-col gap-3.5 border-b border-line px-[18px] pb-3.5 pt-[18px]">
        <div className="flex items-center justify-between">
          <Logo href="/app/dashboard" label="Skanor dashboard" size={22} />
          {onClose ? (
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-mist lg:hidden"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <LocationSwitcher locations={locations} />
      </div>

      <nav aria-label="App" className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-2.5 pb-4 pt-2.5">
        {appNav.map((g) => (
          <div key={g.heading} className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
              {g.heading}
            </span>
            {g.items.map((it) => {
              const on = pathname === it.href || pathname.startsWith(it.href + "/");
              const badge = sidebarBadges[it.key];
              const Icon = it.icon;
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 border-l-2 px-2.5 text-[13.5px] no-underline transition-colors",
                    on
                      ? "border-ink bg-mist font-semibold text-ink"
                      : "border-transparent text-graphite hover:bg-paper hover:text-ink",
                  )}
                >
                  <Icon size={16} strokeWidth={1.7} aria-hidden="true" className="flex-none" />
                  <span className="flex-1">{it.label}</span>
                  {badge ? (
                    <span className="bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {badge}
                      <span className="sr-only"> new</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-line p-3.5">
        <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-marble-soft p-3.5">
          <div className="flex justify-between text-[11px] font-medium uppercase">
            <span className="text-ink">{plan.name} plan</span>
            <span className="text-graphite">
              {plan.used}/{plan.limit} QR
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="QR codes used"
            aria-valuemin={0}
            aria-valuemax={plan.limit}
            aria-valuenow={plan.used}
            className="h-1 rounded bg-white"
          >
            <div className="h-1 rounded bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <Link href="/app/settings" className="text-xs font-semibold text-ink underline-offset-2 hover:underline">
            Upgrade to {plan.upgradeTo}
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white"
          >
            {currentUser.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold">{currentUser.name}</span>
            <span className="text-[11px] text-muted">{currentUser.role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
