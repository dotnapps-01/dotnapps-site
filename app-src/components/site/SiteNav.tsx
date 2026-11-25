"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { siteNav } from "@/lib/routes";
import { Logo } from "./Logo";

/** Marketing-site header (design/SiteNav.dc.html). Active link comes from the URL. */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // close the menu when the route changes (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkCls = (href: string) =>
    cn(
      "px-3 py-3 text-sm no-underline hover:text-ink",
      pathname === href || pathname.startsWith(href + "/") ? "font-semibold text-ink" : "text-graphite",
    );

  return (
    <header className="w-full border-b border-line bg-paper text-ink">
      <nav
        aria-label="Main"
        className="mx-auto flex min-h-[72px] max-w-frame flex-wrap items-center justify-between gap-x-6 gap-y-3 border-x border-line px-5 py-3 sm:px-8"
      >
        <Logo />

        <div className="hidden flex-wrap items-center gap-x-1.5 gap-y-1 md:flex">
          {siteNav.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(l.href)} aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex">
            <Link href="/signup" className={buttonClasses({ size: "nav" })}>
              Log in
            </Link>
          </span>
          <Link href="/signup" className={buttonClasses({ variant: "primary", size: "nav" })}>
            Start free
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink bg-surface md:hidden"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>

        <div id="site-menu" className={cn("-mx-1 w-full flex-col border-t border-line pt-2 md:hidden", open ? "flex" : "hidden")}>
          {siteNav.map((l) => (
            <Link key={l.href} href={l.href} className={cn(linkCls(l.href), "min-h-11 py-3")}>
              {l.label}
            </Link>
          ))}
          <Link href="/signup" className={cn(linkCls("/signup"), "min-h-11 py-3 sm:hidden")}>
            Log in
          </Link>
        </div>
      </nav>
    </header>
  );
}
