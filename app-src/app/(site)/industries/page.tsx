import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Industries" };

export default function Page() {
  return <SitePlaceholder title="Industries" phase={2} designFile="Industries.dc.html" />;
}
