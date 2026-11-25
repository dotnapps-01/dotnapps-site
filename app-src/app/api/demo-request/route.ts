import { NextResponse } from "next/server";
import { validateDemoRequest, type DemoRequest } from "@/lib/demo-request";

export const dynamic = "force-dynamic";

/**
 * Book-a-demo submissions. Until a CRM / database exists (Phase 3+), requests are
 * forwarded as JSON to DEMO_REQUEST_WEBHOOK_URL. With no webhook configured the
 * endpoint answers 503 rather than pretending the request was stored.
 */
export async function POST(req: Request) {
  let body: Partial<DemoRequest> & { website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
  if (body.website) return NextResponse.json({ ok: true });

  const errors = validateDemoRequest(body);
  if (Object.keys(errors).length) return NextResponse.json({ error: "invalid", fields: errors }, { status: 422 });

  const webhook = process.env.DEMO_REQUEST_WEBHOOK_URL;
  if (!webhook) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const payload: DemoRequest = {
    name: String(body.name).trim().slice(0, 120),
    whatsapp: String(body.whatsapp).trim().slice(0, 30),
    email: String(body.email).trim().slice(0, 160),
    businessType: String(body.businessType ?? "").slice(0, 60),
    locations: String(body.locations ?? "").slice(0, 20),
    interests: Array.isArray(body.interests) ? body.interests.slice(0, 12).map((i) => String(i).slice(0, 60)) : [],
    notes: String(body.notes ?? "").slice(0, 2000),
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "skanor-site/contact", receivedAt: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
