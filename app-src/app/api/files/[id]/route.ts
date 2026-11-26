import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { auditAs } from "@/lib/audit";
import { deleteFile } from "@/lib/files";

export const dynamic = "force-dynamic";

/** Deletes a file. Anything that links to it (a QR code, a page) stops working; deleting the logo just removes the logo. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await deleteFile(ws.id, id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await auditAs(ws.id, "file.deleted", id);
  return NextResponse.json({ ok: true });
}
