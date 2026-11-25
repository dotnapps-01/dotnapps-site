import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/auth/otp";
import { normalizeIndianMobile } from "@/lib/auth/phone";
import { getChallenge, setChallengeCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Body = { phone?: string; mode?: string; businessName?: string; resend?: boolean };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let phone: string | null;
  let mode: "signup" | "login";
  let businessName: string | undefined;

  if (body.resend) {
    // "Resend code": reuse the number from the pending challenge cookie.
    const pending = await getChallenge();
    if (!pending) return NextResponse.json({ error: "expired" }, { status: 400 });
    phone = pending.p;
    mode = pending.m;
    businessName = pending.bn;
  } else {
    mode = body.mode === "login" ? "login" : "signup";
    phone = normalizeIndianMobile(String(body.phone ?? ""));
    businessName = String(body.businessName ?? "").trim().slice(0, 120) || undefined;
    const fields: Record<string, string> = {};
    if (!phone) fields.phone = "Enter a valid 10-digit Indian mobile number.";
    if (mode === "signup" && (businessName?.length ?? 0) < 2) fields.businessName = "Enter your business name.";
    if (Object.keys(fields).length) return NextResponse.json({ error: "invalid", fields }, { status: 422 });
  }

  const r = await sendOtp(phone!, mode, businessName);
  if (!r.ok) {
    if (r.reason === "rate_limited")
      return NextResponse.json({ error: "rate_limited", retryAfter: r.retryAfter }, { status: 429, headers: { "retry-after": String(r.retryAfter) } });
    if (r.reason === "not_configured") return NextResponse.json({ error: "not_configured" }, { status: 503 });
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }
  await setChallengeCookie(r.token);
  return NextResponse.json({ ok: true, resendIn: r.resendIn, ...(r.devCode ? { devCode: r.devCode } : {}) });
}
