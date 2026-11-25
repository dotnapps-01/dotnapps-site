import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Pages" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="QR codes" title="Pages" />
      <PageBody>
        <ComingSoon name="Pages" phase={6} designFile="Pages.dc.html" />
      </PageBody>
    </>
  );
}
