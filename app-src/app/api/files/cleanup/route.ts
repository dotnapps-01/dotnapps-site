import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { auditAs } from "@/lib/audit";
import { deleteUnused, requestOrigin } from "@/lib/files";

export const dynamic = "force-dynamic";

/** Deletes every file that no QR code, page, product or logo uses. */
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const removed = await deleteUnused(ws.id, requestOrigin(req));
  if (removed) await auditAs(ws.id, "file.cleanup", `${removed} unused file${removed === 1 ? "" : "s"}`);
  return NextResponse.json({ ok: true, removed });
}
