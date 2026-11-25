import { headers } from "next/headers";

/**
 * Where short links live. In production set SHORT_LINK_BASE=https://skn.to (and SHORT_LINK_HOST=skn.to
 * so proxy.ts serves it). Otherwise links use this app's own /q path, which works for local testing.
 */
export async function getShortLinkBase(): Promise<{ base: string; label: string }> {
  const env = process.env.SHORT_LINK_BASE?.replace(/\/+$/, "");
  if (env) return { base: env, label: env.replace(/^https?:\/\//, "") };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { base: `${proto}://${host}/q`, label: `${host}/q` };
}
