import { authedJson, invalid, ok } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { RETENTION, purgeExpired, saveRetention } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** How long scans and leads are kept. Choosing a shorter period deletes the older ones straight away. */
export async function PUT(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const opt = RETENTION.find((r) => r.value === String(a.body.keep));
  if (!opt) return invalid({ keep: "Choose 24 months, 12 months or forever." });
  await saveRetention(a.ws.id, opt.months);
  const removed = await purgeExpired(a.ws.id, opt.months);
  await auditAs(a.ws.id, "retention.changed", `${opt.label}${removed.scans + removed.leads ? ` (removed ${removed.scans} scans, ${removed.leads} leads)` : ""}`);
  return ok({ removed });
}
