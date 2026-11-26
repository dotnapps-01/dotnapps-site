import { adminJson } from "@/lib/admin-api";
import { invalid, ok } from "@/lib/api-auth";
import { FLAGS, setFlag, type FlagKey } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const a = await adminJson(req);
  if ("error" in a) return a.error;
  if (!FLAGS.some((f) => f.key === a.body.key) || typeof a.body.enabled !== "boolean") return invalid({ key: "Unknown switch." });
  await setFlag(a.body.key as FlagKey, a.body.enabled);
  return ok();
}
