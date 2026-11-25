import { cookies } from "next/headers";
import { signToken, verifyToken } from "./crypto";
import { OTP_TTL_MS, type Challenge } from "./otp";

export const COOKIE = { session: "skn_session", workspace: "skn_ws", otp: "skn_otp" } as const;

const SESSION_DAYS = 30;

const base = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export type Session = { sub: string; exp: number };

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifyToken<Session>(jar.get(COOKIE.session)?.value);
}

export async function startSession(phone: string) {
  const jar = await cookies();
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  jar.set(COOKIE.session, await signToken({ sub: phone, exp } satisfies Session), { ...base(), maxAge: SESSION_DAYS * 86_400 });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE.session);
  jar.delete(COOKIE.otp);
}

export async function setChallengeCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE.otp, token, { ...base(), maxAge: Math.floor(OTP_TTL_MS / 1000) });
}

export async function readChallengeCookie() {
  const jar = await cookies();
  return jar.get(COOKIE.otp)?.value;
}

export async function clearChallengeCookie() {
  const jar = await cookies();
  jar.delete(COOKIE.otp);
}

/** The pending OTP challenge, if its cookie is present, signed and unexpired. */
export async function getChallenge(): Promise<Challenge | null> {
  return verifyToken<Challenge>(await readChallengeCookie());
}
