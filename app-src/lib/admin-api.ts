import "server-only";
import { NextResponse } from "next/server";
import { currentActor, type Actor } from "@/lib/auth/admin";

/** The signed-in admin, or the response to return. Non-admins get a plain 404, so the console's existence isn't advertised. */
export async function adminJson(req: Request, body = true): Promise<{ actor: Actor; body: Record<string, unknown> } | { error: NextResponse }> {
  const actor = await currentActor();
  if (!actor || !actor.admin) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (!body) return { actor, body: {} };
  try {
    const b = await req.json();
    return { actor, body: b && typeof b === "object" ? (b as Record<string, unknown>) : {} };
  } catch {
    return { error: NextResponse.json({ error: "invalid_json" }, { status: 400 }) };
  }
}
