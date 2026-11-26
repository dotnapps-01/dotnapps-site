import { NextResponse } from "next/server";
import { authedJson, conflict, invalid } from "@/lib/api-auth";
import { currentActor } from "@/lib/auth/admin";
import { endSession } from "@/lib/auth/session";
import { deleteWorkspace } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Deletes the workspace and everything in it, for good. The owner must type the business name; an admin viewing the tenant can't do it. */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const actor = await currentActor();
  if (!actor || actor.act) return conflict("not_allowed");
  const typed = String(a.body.confirm ?? "").trim();
  if (!a.ws.businessName || typed.toLowerCase() !== a.ws.businessName.trim().toLowerCase()) return invalid({ confirm: "Type your business name exactly to confirm." });
  await deleteWorkspace(a.ws.id);
  await endSession();
  return NextResponse.json({ ok: true });
}
