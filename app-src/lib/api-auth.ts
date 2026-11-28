import "server-only";
import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { can, PERMISSION_TEXT, type Permission } from "@/lib/permissions";
import type { Workspace } from "@/lib/workspace";

/** The 403 for a person whose role doesn't allow the action. */
export const forbidden = (need: Permission) =>
  NextResponse.json({ error: "forbidden", need, message: `Your role can't ${PERMISSION_TEXT[need]}. Ask the owner if you need to.` }, { status: 403 });

/**
 * The signed-in workspace if the person's role allows `need`, or the error response to return.
 * Every owner API calls this (or authedJson) with the permission it needs, so a new route can't forget to choose one.
 */
export async function authorize(need: Permission): Promise<{ ws: Workspace } | { error: NextResponse }> {
  const ws = await currentWorkspace();
  if (!ws) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!can(ws.role, need)) return { error: forbidden(need) };
  return { ws };
}

/** Same, plus the parsed JSON body (skip it with `{ body: false }` for routes that take none). */
export async function authedJson(req: Request, need: Permission, opts: { body?: boolean } = { body: true }): Promise<{ ws: Workspace; body: Record<string, unknown> } | { error: NextResponse }> {
  const a = await authorize(need);
  if ("error" in a) return a;
  const ws = a.ws;
  if (opts.body === false) return { ws, body: {} };
  try {
    const body = await req.json();
    return { ws, body: body && typeof body === "object" ? (body as Record<string, unknown>) : {} };
  } catch {
    return { error: NextResponse.json({ error: "invalid_json" }, { status: 400 }) };
  }
}

export const invalid = (fields: Record<string, string>) => NextResponse.json({ error: "invalid", fields }, { status: 422 });

/* ---------- small response helpers shared by the owner APIs ---------- */
export type Ctx = { params: Promise<{ id: string }> };
export const ok = (extra: Record<string, unknown> = {}, status = 200) => NextResponse.json({ ok: true, ...extra }, { status });
export const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
export const conflict = (error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status: 409 });
/** Maps the "ok | in_use | not_found" result of a delete to a response. */
export const deleted = (r: "ok" | "in_use" | "not_found") => (r === "ok" ? ok() : r === "in_use" ? conflict("in_use") : notFound());

/** Owner APIs for plan-gated modules answer 403 { error: "plan_required" } below the plan. */
export const planRequired = (feature: string) => NextResponse.json({ error: "plan_required", feature }, { status: 403 });
