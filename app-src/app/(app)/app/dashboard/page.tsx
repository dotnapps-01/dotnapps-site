import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard" />
      <PageBody>
        <ComingSoon name="Dashboard" phase={4} designFile="Dashboard.dc.html" />
      </PageBody>
    </>
  );
}
