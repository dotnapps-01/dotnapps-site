import "server-only";
import { query } from "@/lib/db";

/**
 * Counts hits from one visitor for one kind of public action and says whether another is allowed.
 * Used by the lead form, coupon claim and loyalty endpoints. Backed by Postgres so it holds across instances.
 */
export async function allow(visitor: string, kind: string, limit: number, windowMinutes = 60): Promise<boolean> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from public_hits where visitor = $1 and kind = $2 and at > now() - ($3 || ' minutes')::interval", [
    visitor,
    kind,
    String(windowMinutes),
  ]);
  if (r.n >= limit) return false;
  await query("insert into public_hits (visitor, kind) values ($1, $2)", [visitor, kind]);
  if (Math.random() < 0.02) await query("delete from public_hits where at < now() - interval '1 day'");
  return true;
}
