import { authedJson, invalid, ok } from "@/lib/api-auth";
import { saveLateAfter } from "@/lib/attendance";

export const dynamic = "force-dynamic";

/** The grace period before a check-in counts as late. */
export async function PUT(req: Request) {
  const a = await authedJson(req, "build");
  if ("error" in a) return a.error;
  const n = Number(a.body.lateAfterMin);
  if (!Number.isInteger(n) || n < 0 || n > 240) return invalid({ lateAfterMin: "Enter whole minutes between 0 and 240." });
  await saveLateAfter(a.ws.id, n);
  return ok();
}
