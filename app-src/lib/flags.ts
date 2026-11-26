import "server-only";
import { query } from "@/lib/db";

/** Platform switches the admin console controls. A flag with no row is on. Each one has a real consumer in the code. */
export const FLAGS = [
  { key: "signups_open", label: "New sign-ups", note: "Off: nobody new can create a workspace. Existing owners can still log in." },
  { key: "webhooks_delivery", label: "Webhook delivery", note: "Off: events are not sent to customers' webhook endpoints (e.g. during an incident)." },
] as const;
export type FlagKey = (typeof FLAGS)[number]["key"];

export async function flagOn(key: FlagKey): Promise<boolean> {
  const [r] = await query<{ enabled: boolean }>("select enabled from feature_flags where key = $1", [key]);
  return r ? r.enabled : true;
}

export async function listFlags(): Promise<{ key: FlagKey; label: string; note: string; enabled: boolean }[]> {
  const rows = await query<{ key: string; enabled: boolean }>("select key, enabled from feature_flags");
  return FLAGS.map((f) => ({ ...f, enabled: rows.find((r) => r.key === f.key)?.enabled ?? true }));
}

export async function setFlag(key: FlagKey, enabled: boolean): Promise<void> {
  await query("insert into feature_flags (key, enabled) values ($1,$2) on conflict (key) do update set enabled = excluded.enabled, updated_at = now()", [key, enabled]);
}
