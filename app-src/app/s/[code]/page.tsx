import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BioView } from "@/components/engage/BioView";
import { CardView } from "@/components/engage/CardView";
import { CouponView } from "@/components/engage/CouponView";
import { LeadFormView } from "@/components/engage/LeadFormView";
import { LoyaltyView } from "@/components/engage/LoyaltyView";
import { MenuView } from "@/components/engage/MenuView";
import { E } from "@/lib/engage-i18n";
import { loadPublicEngage } from "@/lib/engage-public";
import type { BioContent, CardContent, MenuContent } from "@/lib/pages";
import { pickLang } from "@/lib/review-i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skanor", robots: { index: false, follow: false } };

const ALL = ["en", "ta", "hi"] as const;

/** Customer pages for menus, business cards, link-in-bio, lead forms, coupons and loyalty cards (reached from /q/<code>). */
export default async function EngagePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { code } = await params;
  const { lang: requested } = await searchParams;
  const data = await loadPublicEngage(code.toLowerCase());
  if (!data) notFound();
  const lang = pickLang((await headers()).get("accept-language"), [...ALL], requested);

  if (data.unavailable) {
    const t = E[lang];
    return (
      <main id="main" lang={lang} className="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="m-0 font-display text-2xl font-semibold tracking-heading">{t.unavailableTitle}</h1>
        <p className="m-0 text-sm text-graphite">{t.unavailableBody}</p>
      </main>
    );
  }

  const { qr } = data;
  const common = { business: qr.business || "Your business", location: qr.location, initialLang: lang };
  return (
    <main id="main">
      {data.type === "menu" ? <MenuView {...common} title={data.page.title} content={data.page.content as MenuContent} /> : null}
      {data.type === "vcard" ? <CardView {...common} content={data.page.content as CardContent} /> : null}
      {data.type === "bio" ? <BioView {...common} title={data.page.title} content={data.page.content as BioContent} /> : null}
      {data.type === "lead" ? <LeadFormView {...common} code={qr.code} form={data.form} /> : null}
      {data.type === "coupon" ? <CouponView {...common} code={qr.code} coupon={data.coupon} /> : null}
      {data.type === "loyalty" ? <LoyaltyView {...common} code={qr.code} programName={data.program.name} /> : null}
    </main>
  );
}
