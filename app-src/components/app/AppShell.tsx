"use client";

import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/cn";
import { AppSidebar, type SidebarLocation, type SidebarPlan, type SidebarUser } from "./AppSidebar";
import type { AppNavKey } from "@/lib/routes";

type AppSidebarProps = { badges: Partial<Record<AppNavKey, string>> };

/**
 * App layout: sticky sidebar from lg up; a slide-in drawer with a top bar below lg.
 * Pages render a <PageHeader/> and their content inside.
 */
export function AppShell({ children, user, locations, plan, badges, admin = false, viewingAs = null }: { children: ReactNode; user: SidebarUser; locations: SidebarLocation[]; plan: SidebarPlan; badges: AppSidebarProps["badges"]; admin?: boolean; /** business name while a Skanor admin is viewing it */ viewingAs?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // close the menu when the route changes (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-screen">
      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Logo href="/app/dashboard" label="Skanor dashboard" size={22} />
        <button
          ref={menuBtn}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink bg-surface"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      ) : null}

      <div
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] max-w-[88vw] transition-[transform,visibility] duration-200",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[260px] lg:max-w-none lg:flex-none lg:translate-x-0 lg:visible",
          open ? "translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <AppSidebar user={user} locations={locations} plan={plan} badges={badges} admin={admin} onClose={() => setOpen(false)} />
      </div>

      <main id="main" className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        {viewingAs ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-ink px-[clamp(16px,2.4vw,32px)] py-2.5 text-sm text-white">
            <span>
              Skanor admin: you are viewing <strong>{viewingAs}</strong> as its owner. What you do here is recorded in their audit log.
            </span>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/admin/impersonate/exit", { method: "POST" }).catch(() => {});
                router.push("/app/admin");
                router.refresh();
              }}
              className="inline-flex min-h-9 items-center rounded-full border border-white bg-transparent px-4 text-sm font-medium text-white hover:bg-white hover:text-ink"
            >
              Exit and go back to the admin console
            </button>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
