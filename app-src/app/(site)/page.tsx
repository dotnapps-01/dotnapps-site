import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: { absolute: "Skanor — QR codes that work for your business" } };

export default function Page() {
  return <SitePlaceholder title="Every scan, working for your business." phase={2} designFile="Main.dc.html" />;
}
