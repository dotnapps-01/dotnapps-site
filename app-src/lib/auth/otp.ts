import { query } from "@/lib/db";
import { hmacHex, randomCode, randomHex, safeEqual, signToken, verifyToken } from "./crypto";
import { getOtpProvider } from "./providers";

/**
 * OTP challenges are stateless signed tokens (kept in an HttpOnly cookie): the code itself is
 * never stored, only an HMAC of it. Attempt and send limits live in Postgres (otp_attempts,
 * otp_sends) so they hold across server instances.
 */

export const OTP_TTL_MS = 5 * 60_000;
export const RESEND_COOLDOWN_S = 30;
export const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export type Challenge = {
  id: string;
  /** phone, E.164 */
  p: string;
  /** HMAC binding id + phone + code */
  h: string;
  /** "signup" or "login" */
  m: "signup" | "login";
  /** business name given at sign-up */
  bn?: string;
  exp: number;
};

export type SendResult =
  | { ok: true; token: string; devCode?: string; resendIn: number }
  | { ok: false; reason: "rate_limited"; retryAfter: number }
  | { ok: false; reason: "not_configured" | "delivery_failed" };

export async function sendOtp(phone: string, mode: "signup" | "login", businessName?: string): Promise<SendResult> {
  const provider = getOtpProvider();
  if (!provider) return { ok: false, reason: "not_configured" };

  const now = Date.now();
  const [recent] = await query<{ n: number; last: Date | null; oldest: Date | null }>(
    `select count(*)::int as n, max(sent_at) as last, min(sent_at) as oldest
       from otp_sends where phone = $1 and sent_at > now() - interval '1 hour'`,
    [phone],
  );
  if (recent.last && now - recent.last.getTime() < RESEND_COOLDOWN_S * 1000) {
    return { ok: false, reason: "rate_limited", retryAfter: Math.ceil((RESEND_COOLDOWN_S * 1000 - (now - recent.last.getTime())) / 1000) };
  }
  if (recent.n >= MAX_SENDS_PER_HOUR && recent.oldest) {
    return { ok: false, reason: "rate_limited", retryAfter: Math.ceil((3_600_000 - (now - recent.oldest.getTime())) / 1000) };
  }

  const code = randomCode(6);
  const id = randomHex(12);
  const exp = now + OTP_TTL_MS;
  const challenge: Challenge = { id, p: phone, h: await hmacHex(`${id}:${phone}:${code}`), m: mode, bn: businessName, exp };

  try {
    await provider.send(phone, code);
  } catch (e) {
    console.error("[auth] OTP delivery failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "delivery_failed" };
  }

  await query("insert into otp_sends (phone) values ($1)", [phone]);
  // opportunistic cleanup keeps both tables small
  await query("delete from otp_sends where sent_at < now() - interval '2 hours'");
  await query("delete from otp_attempts where expires_at < now() - interval '1 hour'");

  return {
    ok: true,
    token: await signToken(challenge),
    resendIn: RESEND_COOLDOWN_S,
    devCode: provider.name === "dev" ? code : undefined,
  };
}

export type VerifyResult =
  | { ok: true; phone: string; mode: "signup" | "login"; businessName?: string }
  | { ok: false; reason: "invalid" | "expired" | "locked" }
  | { ok: false; reason: "wrong"; attemptsLeft: number };

export async function verifyOtp(token: string | undefined, code: string): Promise<VerifyResult> {
  const c = await verifyToken<Challenge>(token);
  if (!c) return { ok: false, reason: token ? "expired" : "invalid" };

  // Count this attempt atomically; the returned number is this attempt's position.
  const [rec] = await query<{ attempts: number; used: boolean }>(
    `insert into otp_attempts (challenge_id, attempts, expires_at) values ($1, 1, $2)
     on conflict (challenge_id) do update set attempts = otp_attempts.attempts + 1
     returning attempts, used`,
    [c.id, new Date(c.exp)],
  );
  if (rec.used) return { ok: false, reason: "invalid" };
  if (rec.attempts > MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const expected = await hmacHex(`${c.id}:${c.p}:${code}`);
  if (!/^\d{6}$/.test(code) || !safeEqual(expected, c.h)) {
    const left = MAX_ATTEMPTS - rec.attempts;
    return left > 0 ? { ok: false, reason: "wrong", attemptsLeft: left } : { ok: false, reason: "locked" };
  }
  await query("update otp_attempts set used = true where challenge_id = $1", [c.id]);
  return { ok: true, phone: c.p, mode: c.m, businessName: c.bn };
}
