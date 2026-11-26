"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/cn";
import { appNav, type AppNavKey } from "@/lib/routes";
import { LocationSwitcher } from "./LocationSwitcher";

export type SidebarUser = { initials: string; name: string; role: string };
export type SidebarLocation = { id: string; name: string };
export type SidebarPlan = { name: string; used: number; /** null = unlimited */ limit: number | null; upgradeTo: string | null };

type Props = {
  user: SidebarUser;
  locations: SidebarLocation[];
  plan: SidebarPlan;
  /** counts shown next to nav items that need attention */
  badges: Partial<Record<AppNavKey, string>>;
  /** Skanor staff see the Admin console link; nobody else does */
  admin?: boolean;
  /** shown only below lg, where the sidebar is a drawer */
  onClose?: () => void;
};

/** App sidebar (design/AppSidebar.dc.html). Every app route is linked; active state comes from the URL. */
export function AppSidebar({ user, locations, plan, badges, admin = false, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }
  const pct = plan.limit ? Math.min(100, Math.round((plan.used / plan.limit) * 100)) : 0;

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
        {appNav.filter((g) => admin || g.items.some((it) => it.key !== "admin")).map((g) => (
          <div key={g.heading} className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
              {g.heading}
            </span>
            {g.items.filter((it) => it.key !== "admin" || admin).map((it) => {
              const on = pathname === it.href || pathname.startsWith(it.href + "/");
              const badge = badges[it.key];
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
            <span className="text-graphite">{plan.limit === null ? `${plan.used} QR · unlimited` : `${plan.used}/${plan.limit} QR`}</span>
          </div>
          <div
            role="progressbar"
            aria-label="QR codes used"
            aria-valuemin={0}
            aria-valuemax={plan.limit ?? plan.used}
            aria-valuenow={plan.used}
            className="h-1 rounded bg-white"
          >
            <div className="h-1 rounded bg-ink" style={{ width: `${pct}%` }} />
          </div>
          {plan.upgradeTo ? (
            <Link href="/app/settings" className="text-xs font-semibold text-ink underline-offset-2 hover:underline">
              Upgrade to {plan.upgradeTo}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white"
          >
            {user.initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold">{user.name}</span>
            <span className="text-[11px] text-muted">{user.role}</span>
          </div>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={logOut}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full text-graphite hover:bg-mist hover:text-ink"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
