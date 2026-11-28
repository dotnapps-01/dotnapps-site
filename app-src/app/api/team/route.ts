import { NextResponse } from "next/server";
import { authedJson, invalid } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { ROLE_LABEL } from "@/lib/permissions";
import { inviteMember, parseInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

/** Adds a team member by name, mobile number and role. They join when that number next signs in. */
export async function POST(req: Request) {
  const a = await authedJson(req, "invite");
  if ("error" in a) return a.error;
  if (a.ws.suspended) return NextResponse.json({ error: "suspended" }, { status: 403 });
  const p = parseInvite(a.body);
  if (!p.ok) return invalid(p.fields);
  const r = await inviteMember(a.ws, p.value);
  if (!r.ok) {
    if (r.error === "forbidden") return NextResponse.json({ error: "forbidden", message: "Managers can add Staff only. Ask the owner to add a Manager." }, { status: 403 });
    const text = {
      seat_limit: `Your plan includes ${r.limit} team seat${r.limit === 1 ? "" : "s"} and they are all taken. Remove someone, or upgrade.`,
      owner_number: "That's the owner's own number.",
      has_workspace: "That number already has its own Skanor workspace, so it can't join another one. They'd need to use a different number.",
      member_here: "That number is already on your team.",
      member_elsewhere: "That number is already part of another business on Skanor.",
    }[r.error];
    return NextResponse.json({ error: r.error, message: text, ...(r.limit ? { limit: r.limit } : {}) }, { status: r.error === "seat_limit" ? 403 : 409 });
  }
  await auditAs(a.ws.id, "team.invited", `${p.value.name} (${ROLE_LABEL[p.value.role]})`);
  return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
}
