import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Real estate plots" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Real estate plots" />
      <PageBody>
        <ComingSoon name="Real estate plots" phase={7} designFile="RealEstate.dc.html" />
      </PageBody>
    </>
  );
}
