import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/product/ProductView";
import { PT } from "@/lib/product-i18n";
import { istDay } from "@/lib/ops-input";
import { getPublicProduct, recordScan } from "@/lib/products";
import { pickLang } from "@/lib/review-i18n";
import { isBot, visitorHash } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skanor", robots: { index: false, follow: false } };

const cityOf = (h: Headers) => {
  const raw = h.get("x-vercel-ip-city") ?? h.get("cf-ipcity") ?? "";
  try {
    return raw ? decodeURIComponent(raw).slice(0, 80) : "";
  } catch {
    return "";
  }
};

/**
 * The page behind a serialized product QR code (/p/<secret token>). Opening it is a scan: the first scan of a code reads
 * "genuine", a scan from another device reads "scanned before", and unusual patterns raise an alert for the brand.
 */
export default async function ProductPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const { lang: requested } = await searchParams;
  const pp = await getPublicProduct(token);
  if (!pp) notFound();
  const h = await headers();
  const lang = pickLang(h.get("accept-language"), ["en", "ta", "hi"], requested);

  if (pp.suspended) {
    const t = PT[lang];
    return (
      <main id="main" lang={lang} className="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="m-0 font-display text-2xl font-semibold tracking-heading">{t.unavailableTitle}</h1>
        <p className="m-0 text-sm text-graphite">{t.unavailableBody}</p>
      </main>
    );
  }

  // link-preview robots must not count as a buyer scanning the product
  const scan = isBot(h.get("user-agent") ?? "")
    ? { verdict: "again" as const, scanCount: 0, firstScanAt: null, firstCity: "", thisCity: "" }
    : await recordScan(pp, await visitorHash(h, pp.codeId), cityOf(h));

  return (
    <main id="main">
      <ProductView token={token} business={pp.business} serial={pp.serial} initialLang={lang} today={istDay()} madeOn={pp.madeOn} product={pp.product} warranty={pp.warranty} scan={scan} />
    </main>
  );
}
