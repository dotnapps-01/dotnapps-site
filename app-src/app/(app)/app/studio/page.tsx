import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StudioWizard } from "@/components/qr/StudioWizard";
import { currentWorkspace } from "@/lib/auth/current";
import { listCoupons, getProgram, listForms, listPages } from "@/lib/engage";
import { countDynamic, getQrCode, listFolders, listLocations } from "@/lib/qr-repo";
import { dynamicLimit, randomShortCode, typeByKey } from "@/lib/qr-types";
import { getShortLinkBase } from "@/lib/short-link";

export const metadata: Metadata = { title: "Create a QR code" };
export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ edit?: string; type?: string; ref?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const { edit, type, ref } = await searchParams;

  const [locations, folders, used, short, record, pages, forms, coupons, program] = await Promise.all([
    listLocations(ws.id),
    listFolders(ws.id),
    countDynamic(ws.id),
    getShortLinkBase(),
    edit ? getQrCode(ws.id, edit) : Promise.resolve(null),
    listPages(ws.id),
    listForms(ws.id),
    listCoupons(ws.id),
    getProgram(ws.id),
  ]);
  const refs = {
    "page:menu": pages.filter((p) => p.kind === "menu" && p.status === "published").map((p) => ({ id: p.id, name: p.title })),
    "page:card": pages.filter((p) => p.kind === "card" && p.status === "published").map((p) => ({ id: p.id, name: p.title })),
    "page:bio": pages.filter((p) => p.kind === "bio" && p.status === "published").map((p) => ({ id: p.id, name: p.title })),
    form: forms.map((f) => ({ id: f.id, name: f.title })),
    coupon: coupons.map((c) => ({ id: c.id, name: `${c.headline} · ${c.title}` })),
    loyalty: program?.active ? [{ id: "program", name: program.name }] : [],
  };
  if (edit && (!record || record.status === "archived")) notFound();

  const limit = dynamicLimit[ws.plan];
  return (
    <StudioWizard
      key={record?.id ?? "new"}
      mode={record ? "edit" : "create"}
      initial={record ?? undefined}
      initialType={!record && typeByKey(type ?? "")?.live ? type : undefined}
      initialRef={ref}
      refs={refs}
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
