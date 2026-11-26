import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryView } from "@/components/qr/LibraryView";
import { currentWorkspace } from "@/lib/auth/current";
import { listFolders, listLocations, listQrCodes } from "@/lib/qr-repo";
import { getShortLinkBase } from "@/lib/short-link";

export const metadata: Metadata = { title: "QR Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const [codes, folders, locations, short] = await Promise.all([listQrCodes(ws.id), listFolders(ws.id), listLocations(ws.id), getShortLinkBase()]);
  return (
    <LibraryView
      codes={codes}
      folders={folders}
      locations={locations}
      shortBase={short.base}
      shortLabel={short.label}
      bulkLocked={ws.plan === "free" || ws.plan === "starter"}
      logoId={ws.logoFileId}
    />
  );
}
