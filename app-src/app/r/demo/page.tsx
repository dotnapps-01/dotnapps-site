import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Review Assistant — customer view" };

export default function ReviewDemoPage() {
  return (
    <main id="main">
      <SitePlaceholder title="Customer view: Review Assistant" phase={5} designFile="ScanReviews.dc.html" />
    </main>
  );
}
