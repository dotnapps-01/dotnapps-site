import "server-only";
import { query, tx } from "@/lib/db";
import { normalizeIndianMobile } from "@/lib/auth/phone";
import { canGrant, canManageMember, isMemberRole, type MemberRole, type Role } from "@/lib/permissions";
import { SEATS } from "@/lib/plans";
import type { Result } from "@/lib/engage-input";
import type { Workspace } from "@/lib/workspace";

/**
 * The owner plus the people they invite. An invitation is just a name, a mobile number and a role: when that number
 * signs in with its one-time code it joins the workspace (no message needs to be sent for it to work). A phone number
 * belongs to one workspace at most, as the owner of their own or as a member of someone else's.
 */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const uuidRe = /^[0-9a-f-]{36}$/i;

export type Member = { id: string; name: string; phone: string; role: Role; status: "owner" | "invited" | "active"; invitedBy: string; joinedAt: string | null; lastLoginAt: string | null; isYou: boolean };

type Row = { id: string; name: string; phone: string; role: MemberRole; status: "invited" | "active"; invited_by: string; joined_at: Date | null; last_login_at: Date | null };

/** The owner first, then the members, newest first. */
export async function listTeam(ws: Workspace): Promise<Member[]> {
  const [owner] = await query<{ phone: string }>("select u.phone from workspaces w join users u on u.id = w.owner_id where w.id = $1", [ws.id]);
  const rows = await query<Row>("select id, name, phone, role, status, invited_by, joined_at, last_login_at from workspace_members where workspace_id = $1 order by created_at desc", [ws.id]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return [
    { id: "owner", name: ws.role === "owner" ? "You" : "Owner", phone: owner?.phone ?? "", role: "owner", status: "owner", invitedBy: "", joinedAt: null, lastLoginAt: null, isYou: ws.role === "owner" },
    ...rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, role: r.role, status: r.status, invitedBy: r.invited_by, joinedAt: iso(r.joined_at), lastLoginAt: iso(r.last_login_at), isYou: r.phone === ws.sub })),
  ];
}

export const seatsUsed = async (workspaceId: string): Promise<number> => 1 + (await query<{ n: number }>("select count(*)::int as n from workspace_members where workspace_id = $1", [workspaceId]))[0].n;
export const seatLimit = (ws: Workspace) => SEATS[ws.plan];

export type InviteInput = { name: string; phone: string; role: MemberRole };
export function parseInvite(raw: unknown): Result<InviteInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter their name (2+ characters).";
  const phone = normalizeIndianMobile(String(r.phone ?? ""));
  if (!phone) f.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!isMemberRole(r.role)) f.role = "Choose Manager or Staff.";
  if (Object.keys(f).length) return { ok: false, fields: f };
  return { ok: true, value: { name, phone: phone!, role: r.role as MemberRole } };
}

export type InviteResult = { ok: true; id: string } | { ok: false; error: "forbidden" | "seat_limit" | "owner_number" | "has_workspace" | "member_here" | "member_elsewhere"; limit?: number };

/** Adds a pending member. A Manager can invite Staff only. */
export async function inviteMember(ws: Workspace, i: InviteInput): Promise<InviteResult> {
  if (!canGrant(ws.role, i.role)) return { ok: false, error: "forbidden" };
  return tx(async (q) => {
    // the workspace row is the lock: two invitations at once can't both take the last seat
    await q.query("select id from workspaces where id = $1 for update", [ws.id]);
    const [own] = await q.query<{ id: string; workspace_id: string }>("select w.id, w.id as workspace_id from users u join workspaces w on w.owner_id = u.id where u.phone = $1", [i.phone]);
    if (own) return own.id === ws.id ? { ok: false as const, error: "owner_number" as const } : { ok: false as const, error: "has_workspace" as const };
    const [m] = await q.query<{ workspace_id: string }>("select workspace_id from workspace_members where phone = $1", [i.phone]);
    if (m) return { ok: false as const, error: m.workspace_id === ws.id ? ("member_here" as const) : ("member_elsewhere" as const) };
    const [n] = await q.query<{ n: number }>("select count(*)::int as n from workspace_members where workspace_id = $1", [ws.id]);
    const limit = SEATS[ws.plan];
    if (1 + n.n >= limit) return { ok: false as const, error: "seat_limit" as const, limit };
    const [row] = await q.query<{ id: string }>("insert into workspace_members (workspace_id, phone, name, role, invited_by) values ($1,$2,$3,$4,$5) returning id", [ws.id, i.phone, i.name, i.role, ws.sub]);
    return { ok: true as const, id: row.id };
  });
}

/** True when a phone number has a pending invitation (so it may sign in even while sign-ups are closed). */
export async function hasInvite(phone: string): Promise<boolean> {
  return (await query("select 1 from workspace_members where phone = $1 and status = 'invited'", [phone])).length > 0;
}

/** Called when a number has just proved it owns itself with a one-time code: turns a pending invitation into membership. Returns the workspace joined, if any. */
export async function claimInvite(phone: string): Promise<string | null> {
  return tx(async (q) => {
    const [m] = await q.query<{ id: string; workspace_id: string; status: string }>("select id, workspace_id, status from workspace_members where phone = $1 for update", [phone]);
    if (!m) return null;
    if (m.status === "invited") {
      const [u] = await q.query<{ id: string }>("insert into users (phone) values ($1) on conflict (phone) do update set phone = excluded.phone returning id", [phone]);
      await q.query("update workspace_members set user_id = $2, status = 'active', joined_at = now(), last_login_at = now() where id = $1", [m.id, u.id]);
    } else {
      await q.query("update workspace_members set last_login_at = now() where id = $1", [m.id]);
    }
    return m.workspace_id;
  });
}

export type ChangeResult = "ok" | "forbidden" | "not_found" | "invalid";

export async function changeRole(ws: Workspace, memberId: string, role: unknown): Promise<ChangeResult> {
  if (!uuidRe.test(memberId)) return "not_found";
  if (!isMemberRole(role)) return "invalid";
  const [m] = await query<{ role: MemberRole }>("select role from workspace_members where id = $1 and workspace_id = $2", [memberId, ws.id]);
  if (!m) return "not_found";
  // roles are the Owner's to change: a Manager can't promote Staff, or demote another Manager
  if (ws.role !== "owner") return "forbidden";
  await query("update workspace_members set role = $2 where id = $1", [memberId, role]);
  return "ok";
}

/** Removes a member (or cancels an invitation). Their access ends at once. A Manager can remove Staff only. */
export async function removeMember(ws: Workspace, memberId: string): Promise<ChangeResult> {
  if (!uuidRe.test(memberId)) return "not_found";
  const [m] = await query<{ role: MemberRole; user_id: string | null }>("select role, user_id from workspace_members where id = $1 and workspace_id = $2", [memberId, ws.id]);
  if (!m) return "not_found";
  if (!canManageMember(ws.role, m.role)) return "forbidden";
  // the member row goes with their user row, so the number is free to sign up on its own afterwards
  if (m.user_id) await query("delete from users where id = $1", [m.user_id]);
  await query("delete from workspace_members where id = $1", [memberId]);
  return "ok";
}
