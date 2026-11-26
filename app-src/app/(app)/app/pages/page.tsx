import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/PageHeader";
import { ScanBrand } from "@/components/scan/Brand";
import { PageBuilder } from "@/components/pages/PageBuilder";
import { currentWorkspace } from "@/lib/auth/current";
import { listPages } from "@/lib/engage";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function PagesScreen({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const { page } = await searchParams;
  const pages = await listPages(ws.id);
  const selected = pages.find((p) => p.id === page) ?? null;
  return (
    <>
      <PageHeader eyebrow="QR codes / Pages" title={selected ? selected.title : "Pages"} />
      <ScanBrand logoId={ws.logoFileId}>
        <PageBuilder pages={pages} selected={selected} business={ws.businessName || "Your business"} location={ws.locationName} />
      </ScanBrand>
    </>
  );
}
