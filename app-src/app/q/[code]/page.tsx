import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/site/Logo";
import { findByShortCode } from "@/lib/qr-repo";
import { SCAN_PAGE_TYPES, destinationFor, effectiveStatus } from "@/lib/qr-types";
import { logScan } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skanor QR", robots: { index: false, follow: false } };

const messages: Record<string, { title: string; body: string }> = {
  paused: { title: "This QR code is paused", body: "The business has paused it for now. Please try again later." },
  expired: { title: "This QR code has expired", body: "It was only available for a limited time." },
  scheduled: { title: "This QR code isn't live yet", body: "It will start working on its scheduled date." },
  draft: { title: "This QR code isn't published yet", body: "The business hasn't switched it on." },
};

/**
 * The redirect service. A scan lands here, is logged, then 307-redirects to the code's destination.
 * Served at /q/<code> and, with SHORT_LINK_HOST set, at the short domain (skn.to/<code>) via proxy.ts.
 */
export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const qr = await findByShortCode(code.toLowerCase());
  if (!qr || qr.status === "archived") notFound();

  // a business switched off by a Skanor admin reads as paused
  const state = qr.suspended ? "paused" : effectiveStatus(qr);
  if (state !== "active") {
    const m = messages[state] ?? messages.draft;
    return (
      <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Logo />
        <h1 className="m-0 font-display text-[clamp(28px,6vw,40px)] font-semibold tracking-display">{m.title}</h1>
        <p className="m-0 max-w-sm text-base text-graphite">{m.body}</p>
        <p className="m-0 text-xs text-muted">Contact the business that gave you this code if you need help.</p>
      </main>
    );
  }

  // Review codes open the rating page, Engage and Operate types open their customer page, the rest go to their destination.
  const dest = qr.type === "review" ? `/r/${code.toLowerCase()}` : SCAN_PAGE_TYPES.includes(qr.type) ? `/s/${code.toLowerCase()}` : destinationFor(qr.type, qr.config);
  if (!dest) notFound();

  await logScan(qr, await headers());
  redirect(dest);
}
