import { NextResponse } from "next/server";
import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { query } from "@/lib/db";
import { ROLE_LABEL, isMemberRole } from "@/lib/permissions";
import { changeRole, removeMember } from "@/lib/team";

export const dynamic = "force-dynamic";

const label = async (workspaceId: string, id: string) => !/^[0-9a-f-]{36}$/i.test(id) ? undefined : (await query<{ name: string; phone: string }>("select name, phone from workspace_members where id = $1 and workspace_id = $2", [id, workspaceId]))[0];

/** Changes a member's role. Only the owner can. */
export async function PATCH(req: Request, ctx: Ctx) {
  const a = await authedJson(req, "invite");
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  if (!isMemberRole(a.body.role)) return invalid({ role: "Choose Manager or Staff." });
  const who = await label(a.ws.id, id);
  const r = await changeRole(a.ws, id, a.body.role);
  if (r === "not_found") return notFound();
  if (r === "forbidden") return NextResponse.json({ error: "forbidden", message: "Only the owner can change roles." }, { status: 403 });
  if (r === "invalid") return invalid({ role: "Choose Manager or Staff." });
  await auditAs(a.ws.id, "team.role_changed", `${who?.name ?? id} is now ${ROLE_LABEL[a.body.role]}`);
  return ok();
}

/** Removes a member or cancels an invitation; their access ends at once. A manager can remove Staff only. */
export async function DELETE(req: Request, ctx: Ctx) {
  const a = await authedJson(req, "invite", { body: false });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const who = await label(a.ws.id, id);
  const r = await removeMember(a.ws, id);
  if (r === "not_found") return notFound();
  if (r !== "ok") return NextResponse.json({ error: "forbidden", message: "Managers can remove Staff only. Ask the owner to remove a Manager." }, { status: 403 });
  await auditAs(a.ws.id, "team.removed", who?.name ?? id);
  return ok();
}
