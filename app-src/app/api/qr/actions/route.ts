import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { bulkAction, type BulkAction } from "@/lib/qr-repo";

export const dynamic = "force-dynamic";

const ACTIONS: BulkAction[] = ["pause", "resume", "archive", "restore", "move"];

/** Library bulk actions. Body: { ids: string[], action, folderId?: string | null } */
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { ids?: unknown; action?: unknown; folderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === "string") : [];
  const action = body.action as BulkAction;
  if (!ACTIONS.includes(action) || ids.length === 0) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const folderId = typeof body.folderId === "string" ? body.folderId : null;

  const r = await bulkAction(ws, ids, action, folderId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "plan_limit" ? 403 : 422 });
  return NextResponse.json({ ok: true, changed: r.changed });
}
