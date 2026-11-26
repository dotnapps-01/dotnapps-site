import { authedJson, invalid, notFound, ok, type Ctx } from "@/lib/api-auth";
import { auditAs } from "@/lib/audit";
import { checkWebhookUrl, deleteEndpoint, parseEndpoint, updateEndpoint } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authedJson(req);
  if ("error" in a) return a.error;
  const { events, url } = parseEndpoint(a.body);
  const f: Record<string, string> = {};
  const safe = await checkWebhookUrl(url);
  if (!safe.ok) f.url = safe.message;
  if (events.length === 0) f.events = "Choose at least one event.";
  if (Object.keys(f).length || !safe.ok) return invalid(f);
  return (await updateEndpoint(a.ws.id, (await params).id, { url: safe.url, events, active: a.body.active !== false })) ? ok() : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authedJson(req, { body: false });
  if ("error" in a) return a.error;
  if (!(await deleteEndpoint(a.ws.id, (await params).id))) return notFound();
  await auditAs(a.ws.id, "webhook.deleted");
  return ok();
}
