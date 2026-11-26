import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { canUse } from "@/lib/plans";
import { allow } from "@/lib/throttle";
import { getWorkspaceById, type Workspace } from "@/lib/workspace";

import { KEY_SCOPES, type KeyRecord, type KeyScope } from "@/lib/api-keys-shared";
export { KEY_SCOPES, type KeyRecord, type KeyScope };
export const isScope = (v: unknown): v is KeyScope => KEY_SCOPES.some((s) => s.key === v);
export const MAX_KEYS = 20;
export const RATE_PER_MINUTE = 120;

const hash = (key: string) => createHash("sha256").update(key).digest("hex"); // keys are 192 random bits, so a plain hash is enough
const uuidRe = /^[0-9a-f-]{36}$/i;


export async function listKeys(workspaceId: string): Promise<KeyRecord[]> {
  const rows = await query<{ id: string; name: string; scope: KeyScope; last4: string; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }>(
    "select id, name, scope, last4, created_at, last_used_at, revoked_at from api_keys where workspace_id = $1 order by (revoked_at is not null), created_at desc",
    [workspaceId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, scope: r.scope, last4: r.last4, createdAt: r.created_at.toISOString(), lastUsedAt: r.last_used_at?.toISOString() ?? null, revokedAt: r.revoked_at?.toISOString() ?? null }));
}

/** The plain key is returned once, here, and never stored: only its hash and last 4 characters are. */
export async function createKey(workspaceId: string, name: string, scope: KeyScope): Promise<{ ok: true; id: string; key: string } | { ok: false; error: "limit" }> {
  const [n] = await query<{ n: number }>("select count(*)::int as n from api_keys where workspace_id = $1 and revoked_at is null", [workspaceId]);
  if (n.n >= MAX_KEYS) return { ok: false, error: "limit" };
  const key = `sk_live_${randomBytes(24).toString("base64url")}`;
  const [r] = await query<{ id: string }>("insert into api_keys (workspace_id, name, scope, key_hash, last4) values ($1,$2,$3,$4,$5) returning id", [workspaceId, name, scope, hash(key), key.slice(-4)]);
  return { ok: true, id: r.id, key };
}

export async function revokeKey(workspaceId: string, id: string): Promise<boolean> {
  if (!uuidRe.test(id)) return false;
  return (await query("update api_keys set revoked_at = now() where id = $1 and workspace_id = $2 and revoked_at is null returning id", [id, workspaceId])).length > 0;
}

/* ---------- the public /v1 API ---------- */

export const apiError = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error: { code, message, ...extra } }, { status });

export type ApiCtx = { ws: Workspace; keyId: string; scope: KeyScope };

/**
 * Checks the bearer key, its scope, the workspace's plan and the per-key rate limit, then runs the handler.
 * `write` handlers need a key with qr:write or all.
 */
export async function withApiKey(req: Request, need: "read" | "write", handler: (ctx: ApiCtx) => Promise<NextResponse>): Promise<NextResponse> {
  const m = /^Bearer\s+(sk_live_[A-Za-z0-9_-]{20,})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return apiError(401, "unauthorized", "Send your key as `Authorization: Bearer sk_live_…`.");
  const [k] = await query<{ id: string; workspace_id: string; scope: KeyScope }>("select id, workspace_id, scope from api_keys where key_hash = $1 and revoked_at is null", [hash(m[1])]);
  if (!k) return apiError(401, "unauthorized", "That key is not valid or has been revoked.");
  const ws = await getWorkspaceById(k.workspace_id);
  if (!ws || ws.suspended) return apiError(403, "suspended", "This account is not active.");
  if (!canUse(ws.plan, "api")) return apiError(403, "plan_required", "API access is part of the Enterprise plan.");
  if (!(await allow(`key:${k.id}`, "api", RATE_PER_MINUTE, 1))) return apiError(429, "rate_limited", `Limit is ${RATE_PER_MINUTE} requests a minute per key.`, { retry_after: 60 });
  if (need === "write" && k.scope === "read") return apiError(403, "insufficient_scope", "This key is read-only. Use a key with the qr:write or all scope.");
  await query("update api_keys set last_used_at = now() where id = $1", [k.id]);
  return handler({ ws, keyId: k.id, scope: k.scope });
}
