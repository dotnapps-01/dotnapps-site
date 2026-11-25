import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Offers & loyalty" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Engage" title="Offers & loyalty" />
      <PageBody>
        <ComingSoon name="Offers & loyalty" phase={6} designFile="Offers.dc.html" />
      </PageBody>
    </>
  );
}
