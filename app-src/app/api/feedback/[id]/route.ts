import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { setFeedbackStatus, type FeedbackStatus } from "@/lib/reviews";

export const dynamic = "force-dynamic";
const STATUSES: FeedbackStatus[] = ["open", "in_progress", "resolved"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  let status: unknown;
  try {
    status = (await req.json()).status;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!STATUSES.includes(status as FeedbackStatus)) return NextResponse.json({ error: "invalid" }, { status: 422 });
  return (await setFeedbackStatus(ws.id, id, status as FeedbackStatus)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
