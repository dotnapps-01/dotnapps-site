import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Create a QR code" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="QR codes" title="Create a QR code" />
      <PageBody>
        <ComingSoon name="Create a QR code" phase={4} designFile="QRStudio.dc.html" />
      </PageBody>
    </>
  );
}
