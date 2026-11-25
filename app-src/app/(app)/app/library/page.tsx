import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "QR Library" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="QR codes" title="QR Library" />
      <PageBody>
        <ComingSoon name="QR Library" phase={4} designFile="QRLibrary.dc.html" />
      </PageBody>
    </>
  );
}
