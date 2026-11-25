import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Product QR & warranty" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Products" title="Product QR & warranty" />
      <PageBody>
        <ComingSoon name="Product QR & warranty" phase={8} designFile="Products.dc.html" />
      </PageBody>
    </>
  );
}
