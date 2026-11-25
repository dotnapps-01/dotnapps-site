import "server-only";
import { query } from "@/lib/db";
import { hmacHex } from "@/lib/auth/crypto";

export type Device = "android" | "iphone" | "other";

export function parseDevice(ua: string): Device {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  return "other";
}

/** Link-preview fetchers, crawlers and scripts are not people scanning a code. */
export function isBot(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl\/|wget|python-requests|headless|monitor|uptime/i.test(ua);
}

export function parseLang(accept: string): "en" | "ta" | "hi" | "other" {
  const first = accept.split(",")[0]?.trim().toLowerCase().split(/[-;]/)[0];
  return first === "en" || first === "ta" || first === "hi" ? first : "other";
}

/** Records one scan. Never throws: a logging problem must not stop the redirect. */
export async function logScan(qr: { id: string; workspace_id: string }, h: Headers): Promise<void> {
  try {
    const ua = h.get("user-agent") ?? "";
    if (isBot(ua)) return;
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "";
    const visitor = (await hmacHex(`${ip}|${ua}|${qr.id}`)).slice(0, 32);
    const rawCity = h.get("x-vercel-ip-city") ?? h.get("cf-ipcity") ?? "";
    let city: string | null = null;
    try {
      city = rawCity ? decodeURIComponent(rawCity).slice(0, 80) : null;
    } catch {
      city = null;
    }
    await query("insert into scans (qr_id, workspace_id, visitor, city, device, lang) values ($1, $2, $3, $4, $5, $6)", [
      qr.id,
      qr.workspace_id,
      visitor,
      city,
      parseDevice(ua),
      parseLang(h.get("accept-language") ?? ""),
    ]);
  } catch (e) {
    console.error("[scan] could not record scan:", e instanceof Error ? e.message : e);
  }
}
