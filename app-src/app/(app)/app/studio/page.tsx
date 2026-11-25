import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StudioWizard } from "@/components/qr/StudioWizard";
import { currentWorkspace } from "@/lib/auth/current";
import { countDynamic, getQrCode, listFolders, listLocations } from "@/lib/qr-repo";
import { dynamicLimit, randomShortCode, typeByKey } from "@/lib/qr-types";
import { getShortLinkBase } from "@/lib/short-link";

export const metadata: Metadata = { title: "Create a QR code" };
export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ edit?: string; type?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const { edit, type } = await searchParams;

  const [locations, folders, used, short, record] = await Promise.all([
    listLocations(ws.id),
    listFolders(ws.id),
    countDynamic(ws.id),
    getShortLinkBase(),
    edit ? getQrCode(ws.id, edit) : Promise.resolve(null),
  ]);
  if (edit && (!record || record.status === "archived")) notFound();

  const limit = dynamicLimit[ws.plan];
  return (
    <StudioWizard
      key={record?.id ?? "new"}
      mode={record ? "edit" : "create"}
      initial={record ?? undefined}
      initialType={!record && typeByKey(type ?? "")?.live ? type : undefined}
      locations={locations}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      shortBase={short.base}
      shortLabel={short.label}
      suggestedCode={randomShortCode()}
      dynamicUsed={used}
      dynamicLimit={Number.isFinite(limit) ? limit : null}
      planName={ws.plan[0].toUpperCase() + ws.plan.slice(1)}
    />
  );
}
