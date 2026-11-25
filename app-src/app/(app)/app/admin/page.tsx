import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Admin console" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Admin console" />
      <PageBody>
        <ComingSoon name="Admin console" phase={8} designFile="AdminConsole.dc.html" />
      </PageBody>
    </>
  );
}
