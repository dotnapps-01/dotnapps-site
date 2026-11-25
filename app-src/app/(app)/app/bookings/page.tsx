import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/ComingSoon";
import { PageBody, PageHeader } from "@/components/app/PageHeader";

export const metadata: Metadata = { title: "Bookings & events" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Bookings & events" />
      <PageBody>
        <ComingSoon name="Bookings & events" phase={7} designFile="Bookings.dc.html" />
      </PageBody>
    </>
  );
}
