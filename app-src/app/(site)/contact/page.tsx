import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <SitePlaceholder title="Contact" phase={2} designFile="Contact.dc.html" />;
}
