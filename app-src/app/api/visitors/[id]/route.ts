import { authedJson, conflict, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { actOnVisitor, type VisitorAction } from "@/lib/attendance";

export const dynamic = "force-dynamic";
const ACTIONS: VisitorAction[] = ["approve", "decline", "in", "out"];

/** Approve or decline a pass request, then mark the visitor in and out at the gate. */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const action = a.body.action as VisitorAction;
  if (!ACTIONS.includes(action)) return invalid({ action: "Unknown action." });
  const r = await actOnVisitor(a.ws.id, (await params).id, action);
  return r === "ok" ? ok() : r === "bad_state" ? conflict("bad_state") : notFound();
}
