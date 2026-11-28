import { authedJson, notFound, ok, type Ctx } from "@/lib/api-auth";
import { sendTest } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Sends a "ping" to the endpoint now and says what came back. */
export async function POST(req: Request, { params }: Ctx) {
  const a = await authedJson(req, "owner", { body: false });
  if ("error" in a) return a.error;
  const r = await sendTest(a.ws.id, (await params).id);
  return r ? ok({ delivered: r.ok, status: r.status, error: r.error }) : notFound();
}
