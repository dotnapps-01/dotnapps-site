import type { Metadata } from "next";
import { headers } from "next/headers";
import { RatingFlow } from "@/components/review/RatingFlow";
import { DEFAULT_CHIPS, DEFAULT_QUESTION, pickLang } from "@/lib/review-i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review Assistant · customer view", robots: { index: false, follow: false } };

/** Public demo of the customer view with sample data. Nothing is saved or sent. */
export default async function ReviewDemoPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  return (
    <main id="main">
      <RatingFlow
        demo
        code="demo"
        business="Saravana Cafe"
        location="RS Puram, Coimbatore"
        source="Table 4"
        staff="Ravi"
        googleUrl=""
        question={DEFAULT_QUESTION}
        chips={DEFAULT_CHIPS}
        languages={["en", "ta", "hi"]}
        suggestText
        links={[{ label: "See the menu", url: "https://example.com" }]}
        initialLang={pickLang((await headers()).get("accept-language"), ["en", "ta", "hi"], lang)}
      />
    </main>
  );
}
