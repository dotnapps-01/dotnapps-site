import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/otp";
import { clearChallengeCookie, readChallengeCookie, startSession } from "@/lib/auth/session";
import { flagOn } from "@/lib/flags";
import { claimInvite, hasInvite } from "@/lib/team";
import { ensureWorkspace, getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let code = "";
  try {
    code = String((await req.json()).code ?? "").replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const r = await verifyOtp(await readChallengeCookie(), code);
  if (!r.ok) {
    if (r.reason === "wrong") return NextResponse.json({ error: "wrong", attemptsLeft: r.attemptsLeft }, { status: 401 });
    if (r.reason === "locked") return NextResponse.json({ error: "locked" }, { status: 429 });
    return NextResponse.json({ error: r.reason }, { status: 400 });
  }

  // the admin console can close sign-ups; people who already have a workspace can still log in
  if (!(await getWorkspace(r.phone)) && !(await hasInvite(r.phone)) && !(await flagOn("signups_open"))) return NextResponse.json({ error: "signups_closed" }, { status: 403 });

  await startSession(r.phone);
  await clearChallengeCookie();

  // someone invited to a team joins it now (an invitation wins over starting a workspace of their own)
  await claimInvite(r.phone);
  const ws = await ensureWorkspace(r.phone, r.businessName ?? "");
  // Returning users who already finished setup go straight to the app; so does a team member, whose workspace the owner set up.
  return NextResponse.json({ ok: true, next: ws.onboarded || ws.role !== "owner" ? "/app/dashboard" : null });
}
