import "server-only";
import { query } from "@/lib/db";
import { currentActor } from "@/lib/auth/admin";

export type AuditEntry = { id: number; actor: string; action: string; detail: string; at: string };

/** Records what happened in a workspace. Never throws: a logging problem must not break the action. */
export async function audit(workspaceId: string, actor: string, action: string, detail = ""): Promise<void> {
  try {
    await query("insert into audit_log (workspace_id, actor, action, detail) values ($1,$2,$3,$4)", [workspaceId, actor.slice(0, 80), action.slice(0, 60), detail.slice(0, 300)]);
  } catch (e) {
    console.error("[audit] could not record:", e instanceof Error ? e.message : e);
  }
}

/** Same, with the actor taken from the session: the owner, or "Skanor admin +91…" while an admin is viewing the tenant. */
export async function auditAs(workspaceId: string, action: string, detail = ""): Promise<void> {
  const a = await currentActor();
  await audit(workspaceId, a?.act ? `Skanor admin ${a.act}` : (a?.sub ?? "system"), action, detail);
}

export async function listAudit(workspaceId: string, limit = 50): Promise<AuditEntry[]> {
  const rows = await query<{ id: number; actor: string; action: string; detail: string; at: Date }>("select id, actor, action, detail, at from audit_log where workspace_id = $1 order by at desc, id desc limit $2", [workspaceId, limit]);
  return rows.map((r) => ({ id: r.id, actor: r.actor, action: r.action, detail: r.detail, at: r.at.toISOString() }));
}
