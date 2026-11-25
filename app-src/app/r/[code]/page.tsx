import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { RatingFlow } from "@/components/review/RatingFlow";
import { T, pickLang } from "@/lib/review-i18n";
import { getRatingPage } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const page = await getRatingPage((await params).code.toLowerCase());
  return { title: page ? `${page.business} · Rate your visit` : "Rate your visit", robots: { index: false, follow: false } };
}

/** The customer's rating page, reached after a scan of a Review QR code (/q/<code> redirects here). */
export default async function RatingPageRoute({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { code } = await params;
  const { lang } = await searchParams;
  const page = await getRatingPage(code.toLowerCase());
  if (!page) notFound();

  const initialLang = pickLang((await headers()).get("accept-language"), page.settings.languages, lang);
  if (page.state === "unavailable") {
    const t = T[initialLang];
    return (
      <main id="main" lang={initialLang} className="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="m-0 font-display text-2xl font-semibold tracking-heading">{t.unavailableTitle}</h1>
        <p className="m-0 text-sm text-graphite">{t.unavailableBody}</p>
      </main>
    );
  }
  return (
    <main id="main">
      <RatingFlow
        code={page.code}
        business={page.business || "Your business"}
        location={page.location}
        source={page.source}
        staff={page.staff}
        googleUrl={page.googleUrl}
        question={page.settings.question}
        chips={page.settings.chips}
        languages={page.settings.languages}
        suggestText={page.settings.suggestText}
        links={page.settings.links}
        initialLang={initialLang}
      />
    </main>
  );
}
