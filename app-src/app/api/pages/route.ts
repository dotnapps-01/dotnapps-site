import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { createPage } from "@/lib/engage";
import { PAGE_KINDS, parseTitle, type PageKind } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** Create a draft page. Body: { kind, title }. */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const kind = a.body.kind as PageKind;
  if (!PAGE_KINDS.some((k) => k.key === kind)) return invalid({ kind: "Choose a page type." });
  const title = parseTitle(a.body.title);
  if (!title.ok) return invalid({ title: title.error });
  const id = await createPage(a.ws.id, kind, title.value);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
