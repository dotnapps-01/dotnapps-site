import { NextResponse } from "next/server";
import { createLead, getForm } from "@/lib/engage";
import { parseSubmission } from "@/lib/engage-input";
import { getEngageQr } from "@/lib/engage-public";
import { visitorHash } from "@/lib/scan";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A customer submits a lead form. Public: validated against the form's own definition, throttled, honeypot. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const qr = await getEngageQr(String(b.code ?? "").toLowerCase(), "lead");
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!qr.active) return NextResponse.json({ error: "unavailable" }, { status: 409 });
  const form = await getForm(qr.workspaceId, qr.config.formId ?? "");
  if (!form) return NextResponse.json({ error: "unavailable" }, { status: 409 });

  const parsed = parseSubmission(b, form);
  if (!parsed.ok) return NextResponse.json({ error: "invalid", fields: parsed.fields }, { status: 422 });
  const visitor = await visitorHash(req.headers, qr.id);
  if (!(await allow(visitor, "lead", 10))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  await createLead({ workspaceId: qr.workspaceId, formId: form.id, qrId: qr.id, qrName: qr.name, visitor, s: parsed.value });
  return NextResponse.json({ ok: true }, { status: 201 });
}
