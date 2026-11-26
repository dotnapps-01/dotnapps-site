import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ScanBrand } from "@/components/scan/Brand";
import { Track } from "@/components/ops/Track";
import { getVisitorByToken } from "@/lib/attendance";
import { getBookingByToken } from "@/lib/bookings";
import { pickLang } from "@/lib/review-i18n";
import { getTicketByToken } from "@/lib/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skanor", robots: { index: false, follow: false } };

/** A customer's own page: a ticket's progress (t…), a visitor pass (v…) or a booking (b…). The unguessable token in the link is the only key. */
export default async function OwnLinkPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const { lang: requested } = await searchParams;
  const lang = pickLang((await headers()).get("accept-language"), ["en", "ta", "hi"], requested);
  const kind = token[0];
  if (kind === "t") {
    const data = await getTicketByToken(token);
    if (!data) notFound();
    return <main id="main"><ScanBrand logoId={data.logoId}><Track kind="t" token={token} initialLang={lang} data={data} /></ScanBrand></main>;
  }
  if (kind === "v") {
    const data = await getVisitorByToken(token);
    if (!data) notFound();
    return <main id="main"><ScanBrand logoId={data.logoId}><Track kind="v" token={token} initialLang={lang} data={data} /></ScanBrand></main>;
  }
  if (kind === "b") {
    const data = await getBookingByToken(token);
    if (!data) notFound();
    return <main id="main"><ScanBrand logoId={data.logoId}><Track kind="b" token={token} initialLang={lang} data={data} /></ScanBrand></main>;
  }
  notFound();
}
