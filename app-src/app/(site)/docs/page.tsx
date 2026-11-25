import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "API docs" };

export default function Page() {
  return <SitePlaceholder title="API docs" phase={2} designFile="Integrations.dc.html" />;
}
