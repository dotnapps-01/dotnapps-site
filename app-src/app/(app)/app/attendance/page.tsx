import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Attendance & visitors" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Attendance & visitors" />
      <PageBody>
        <ComingSoon name="Attendance & visitors" phase={7} designFile="Attendance.dc.html" />
      </PageBody>
    </>
  );
}
