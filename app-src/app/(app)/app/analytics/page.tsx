import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Overview" title="Analytics" />
      <PageBody>
        <ComingSoon name="Analytics" phase={4} designFile="Analytics.dc.html" />
      </PageBody>
    </>
  );
}
