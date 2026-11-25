import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Tickets & assets" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Tickets & assets" />
      <PageBody>
        <ComingSoon name="Tickets & assets" phase={7} designFile="Tickets.dc.html" />
      </PageBody>
    </>
  );
}
