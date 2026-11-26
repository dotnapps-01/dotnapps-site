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
