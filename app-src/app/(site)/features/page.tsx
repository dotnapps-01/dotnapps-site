import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Features" };

export default function Page() {
  return <SitePlaceholder title="Features" phase={2} designFile="Features.dc.html" />;
}
