import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Leads & contacts" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Engage" title="Leads & contacts" />
      <PageBody>
        <ComingSoon name="Leads & contacts" phase={6} designFile="Leads.dc.html" />
      </PageBody>
    </>
  );
}
