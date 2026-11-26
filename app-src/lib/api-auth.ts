import "server-only";
import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import type { Workspace } from "@/lib/workspace";

/** Signed-in workspace plus the parsed JSON body, or the error response to return. */
export async function authedJson(req: Request, opts: { body?: boolean } = { body: true }): Promise<{ ws: Workspace; body: Record<string, unknown> } | { error: NextResponse }> {
  const ws = await currentWorkspace();
  if (!ws) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
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
