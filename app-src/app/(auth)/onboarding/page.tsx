import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return (
    <main id="main">
      <SitePlaceholder title="Onboarding" phase={3} designFile="Onboarding.dc.html" />
    </main>
  );
}
