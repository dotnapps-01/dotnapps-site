import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RatingFlow } from "@/components/review/RatingFlow";
import { currentWorkspace } from "@/lib/auth/current";
import { pickLang } from "@/lib/review-i18n";
import { getReviewSettings } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview rating page", robots: { index: false, follow: false } };

/** The signed-in business's own rating page (its name and settings) in demo mode: nothing is saved or sent. */
export default async function RatingPreviewPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/r/demo");
  const s = await getReviewSettings(ws.id);
  const { lang } = await searchParams;
  return (
    <main id="main">
      <RatingFlow
        demo
        code="preview"
        business={ws.businessName || "Your business"}
        location={ws.locationName}
        source="Table 4"
        staff=""
        googleUrl=""
        question={s.question}
        chips={s.chips}
        languages={s.languages}
        suggestText={s.suggestText}
        links={s.links}
        initialLang={pickLang((await headers()).get("accept-language"), s.languages, lang)}
      />
    </main>
  );
}
