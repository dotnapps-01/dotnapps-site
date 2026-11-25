import { hmacHex, randomCode, randomHex, safeEqual, signToken, verifyToken } from "./crypto";
import { getOtpProvider } from "./providers";

/**
 * OTP challenges are stateless signed tokens (kept in an HttpOnly cookie): the code itself is
 * never stored, only an HMAC of it. Attempt and send limits live in memory below, which works
 * for a single server process. When Postgres arrives (Phase 4) move `store` there so limits
 * hold across serverless instances.
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

type Store = { attempts: Map<string, number>; used: Set<string>; sends: Map<string, number[]> };
const g = globalThis as unknown as { __sknOtpStore?: Store };
const store: Store = (g.__sknOtpStore ??= { attempts: new Map(), used: new Set(), sends: new Map() });

export type SendResult =
  | { ok: true; token: string; devCode?: string; resendIn: number }
  | { ok: false; reason: "rate_limited"; retryAfter: number }
  | { ok: false; reason: "not_configured" | "delivery_failed" };

export async function sendOtp(phone: string, mode: "signup" | "login", businessName?: string): Promise<SendResult> {
  const provider = getOtpProvider();
  if (!provider) return { ok: false, reason: "not_configured" };

  const now = Date.now();
  // keep the in-memory maps bounded
  if (store.attempts.size > 10_000) { store.attempts.clear(); store.used.clear(); }
  if (store.sends.size > 10_000) store.sends.clear();
  const recent = (store.sends.get(phone) ?? []).filter((t) => now - t < 3_600_000);
  const last = recent[recent.length - 1];
  if (last && now - last < RESEND_COOLDOWN_S * 1000) {
    return { ok: false, reason: "rate_limited", retryAfter: Math.ceil((RESEND_COOLDOWN_S * 1000 - (now - last)) / 1000) };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: "rate_limited", retryAfter: Math.ceil((3_600_000 - (now - recent[0])) / 1000) };
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

  store.sends.set(phone, [...recent, now]);
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
  if (store.used.has(c.id)) return { ok: false, reason: "invalid" };

  const attempts = store.attempts.get(c.id) ?? 0;
  if (attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  store.attempts.set(c.id, attempts + 1);

  const expected = await hmacHex(`${c.id}:${c.p}:${code}`);
  if (!/^\d{6}$/.test(code) || !safeEqual(expected, c.h)) {
    const left = MAX_ATTEMPTS - (attempts + 1);
    return left > 0 ? { ok: false, reason: "wrong", attemptsLeft: left } : { ok: false, reason: "locked" };
  }
  store.used.add(c.id);
  return { ok: true, phone: c.p, mode: c.m, businessName: c.bn };
}
