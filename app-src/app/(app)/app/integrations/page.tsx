import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Integrations & API" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Integrations & API" />
      <PageBody>
        <ComingSoon name="Integrations & API" phase={8} designFile="Integrations.dc.html" />
      </PageBody>
    </>
  );
}
