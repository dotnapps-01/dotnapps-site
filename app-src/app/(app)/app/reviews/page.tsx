import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Reviews & feedback" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Engage" title="Reviews & feedback" />
      <PageBody>
        <ComingSoon name="Reviews & feedback" phase={5} designFile="Reviews.dc.html" />
      </PageBody>
    </>
  );
}
