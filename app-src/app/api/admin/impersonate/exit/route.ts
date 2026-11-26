import { NextResponse } from "next/server";
import { currentActor } from "@/lib/auth/admin";
import { startSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Back to your own account. */
export async function POST() {
  const actor = await currentActor();
  if (!actor?.act) return NextResponse.json({ error: "not_impersonating" }, { status: 409 });
  await startSession(actor.act);
  return NextResponse.json({ ok: true });
}
