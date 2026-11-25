import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Pricing" };

export default function Page() {
  return <SitePlaceholder title="Pricing" phase={2} designFile="Pricing.dc.html" />;
}
