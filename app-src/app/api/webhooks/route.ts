import { authedJson, conflict, invalid, ok, planRequired } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { canUse } from "@/lib/plans";
import { checkWebhookUrl, createEndpoint, parseEndpoint } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Adds a webhook endpoint. The signing secret is in this response and nowhere else. */
export async function POST(req: Request) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  if (!canUse(a.ws.plan, "api")) return planRequired("api");
  const { events, url } = parseEndpoint(a.body);
  const f: Record<string, string> = {};
  const safe = await checkWebhookUrl(url);
  if (!safe.ok) f.url = safe.message;
  if (events.length === 0) f.events = "Choose at least one event.";
  if (Object.keys(f).length || !safe.ok) return invalid(f);
  const r = await createEndpoint(a.ws.id, safe.url, events);
  if (!r.ok) return conflict("limit");
  await auditAs(a.ws.id, "webhook.created", safe.url);
  return ok({ id: r.id, secret: r.secret }, 201);
}
