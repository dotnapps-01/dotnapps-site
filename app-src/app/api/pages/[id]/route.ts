import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { deletePage, getPage, updatePage } from "@/lib/engage";
import { parseContent, parseTitle } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** Save a page. Body: { title, content, status }. Publishing applies the strict content rules. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  const page = await getPage(a.ws.id, id);
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const title = parseTitle(a.body.title ?? page.title);
  if (!title.ok) return invalid({ title: title.error });
  const status = a.body.status === "published" ? "published" : "draft";
  const content = parseContent(page.kind, a.body.content ?? page.content, status === "published");
  if (!content.ok) return invalid(content.fields);
  // a page that live QR codes point at can't be pulled back to draft
  if (status === "draft" && page.inUse > 0 && page.status === "published") return NextResponse.json({ error: "in_use", fields: { status: "Live QR codes use this page. Archive them first, or keep it published." } }, { status: 409 });

  await updatePage(a.ws.id, id, { title: title.value, content: content.value, status });
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  const r = await deletePage(a.ws.id, (await params).id);
  if (r === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (r === "in_use") return NextResponse.json({ error: "in_use" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
