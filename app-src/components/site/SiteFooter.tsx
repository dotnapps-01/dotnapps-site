import Link from "next/link";
import { footerColumns } from "@/lib/routes";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

/** Marketing-site footer (design/SiteFooter.dc.html). */
export function SiteFooter() {
  return (
    <footer className="on-dark w-full bg-ink text-white">
      <div className="mx-auto max-w-frame border-x border-ink-2">
        <div className="grid grid-cols-2 gap-8 border-b border-ink-2 px-5 pb-10 pt-14 sm:px-[clamp(20px,5vw,64px)] lg:grid-cols-6">
          <div className="col-span-2 flex min-w-0 flex-col gap-4">
            <Logo tone="light" label="Skanor home" />
            <p className="m-0 max-w-[300px] text-sm leading-relaxed text-[#B8B8C0]">
              The QR platform for growing businesses. A Dotnapps product.
            </p>
            <NewsletterForm />
          </div>
          {footerColumns.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="flex min-w-0 flex-col gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-lilac">{col.heading}</span>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="py-0.5 text-sm text-[#D6D6DC] no-underline hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-3 px-5 py-5 text-xs text-[#9A9AA3] sm:px-[clamp(20px,5vw,64px)]">
          <span>© 2026 Skanor · Dotnapps, Bengaluru</span>
          <span>Privacy · Terms · Refund policy · Status</span>
        </div>
      </div>
    </footer>
  );
}
