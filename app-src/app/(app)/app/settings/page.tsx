import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Settings" />
      <PageBody>
        <ComingSoon name="Settings" phase={8} designFile="Settings.dc.html" />
      </PageBody>
    </>
  );
}
