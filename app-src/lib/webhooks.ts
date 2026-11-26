import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp } from "@/lib/net-safety";
export { isPrivateIp };
import { after } from "next/server";
import { query } from "@/lib/db";
import { flagOn } from "@/lib/flags";

import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhook-events";
export { WEBHOOK_EVENTS, type WebhookEvent };
const EVENT_KEYS: string[] = WEBHOOK_EVENTS.map((e) => e.key);
export const isEvent = (v: unknown): v is WebhookEvent => typeof v === "string" && EVENT_KEYS.includes(v);

/** The events and URL from an endpoint form, with unknown events dropped. */
export function parseEndpoint(body: Record<string, unknown>) {
  const events = (Array.isArray(body.events) ? body.events : []).filter(isEvent) as WebhookEvent[];
  return { events: [...new Set(events)], url: String(body.url ?? "") };
}

/* ---------- where we are willing to send requests ---------- */

const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === "1" && process.env.NODE_ENV !== "production";

export type UrlCheck = { ok: true; url: string } | { ok: false; message: string };

/** A webhook URL must be https, carry no credentials, and resolve only to public addresses. Checked when saved and again before every delivery. */
export async function checkWebhookUrl(raw: string): Promise<UrlCheck> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Enter a full web address, like https://example.com/hooks/skanor." };
  }
  const priv = allowPrivate();
  if (u.protocol !== "https:" && !(priv && u.protocol === "http:")) return { ok: false, message: "The address must start with https://." };
  if (u.username || u.password) return { ok: false, message: "Don't put a username or password in the address." };
  if (u.toString().length > 300) return { ok: false, message: "That address is too long." };
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!priv && (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !isIP(host))) return { ok: false, message: "That address points at a private or internal host." };
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.length === 0) return { ok: false, message: "We couldn't find that host." };
    if (!priv && addrs.some((a) => isPrivateIp(a.address))) return { ok: false, message: "That address points at a private or internal host." };
  } catch {
    return { ok: false, message: "We couldn't find that host. Check the address." };
  }
  return { ok: true, url: u.toString() };
}

/* ---------- endpoints ---------- */

export type EndpointRecord = { id: string; url: string; events: WebhookEvent[]; active: boolean; failures: number; lastStatus: number | null; lastAt: string | null; createdAt: string };
type EpRow = { id: string; url: string; events: WebhookEvent[]; active: boolean; failures: number; last_status: number | null; last_at: Date | null; created_at: Date };
const toEp = (r: EpRow): EndpointRecord => ({ id: r.id, url: r.url, events: r.events, active: r.active, failures: r.failures, lastStatus: r.last_status, lastAt: r.last_at?.toISOString() ?? null, createdAt: r.created_at.toISOString() });
const uuidRe = /^[0-9a-f-]{36}$/i;

export const MAX_ENDPOINTS = 10;

export async function listEndpoints(workspaceId: string): Promise<EndpointRecord[]> {
  return (await query<EpRow>("select id, url, events, active, failures, last_status, last_at, created_at from webhook_endpoints where workspace_id = $1 order by created_at", [workspaceId])).map(toEp);
}

export async function createEndpoint(workspaceId: string, url: string, events: WebhookEvent[]): Promise<{ ok: true; id: string; secret: string } | { ok: false; error: "limit" }> {
  const [n] = await query<{ n: number }>("select count(*)::int as n from webhook_endpoints where workspace_id = $1", [workspaceId]);
  if (n.n >= MAX_ENDPOINTS) return { ok: false, error: "limit" };
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const [r] = await query<{ id: string }>("insert into webhook_endpoints (workspace_id, url, events, secret) values ($1,$2,$3,$4) returning id", [workspaceId, url, events, secret]);
  return { ok: true, id: r.id, secret };
}

export async function updateEndpoint(workspaceId: string, id: string, p: { url: string; events: WebhookEvent[]; active: boolean }): Promise<boolean> {
  if (!uuidRe.test(id)) return false;
  const rows = await query("update webhook_endpoints set url=$3, events=$4, active=$5, failures = case when $5 then 0 else failures end where id=$1 and workspace_id=$2 returning id", [id, workspaceId, p.url, p.events, p.active]);
  return rows.length > 0;
}

export async function deleteEndpoint(workspaceId: string, id: string): Promise<boolean> {
  if (!uuidRe.test(id)) return false;
  return (await query("delete from webhook_endpoints where id = $1 and workspace_id = $2 returning id", [id, workspaceId])).length > 0;
}

export type DeliveryRecord = { id: number; event: string; status: number | null; ok: boolean; error: string; attempt: number; at: string };
export async function recentDeliveries(workspaceId: string, endpointId: string, limit = 10): Promise<DeliveryRecord[]> {
  if (!uuidRe.test(endpointId)) return [];
  const rows = await query<{ id: number; event: string; status: number | null; ok: boolean; error: string; attempt: number; at: Date }>(
    "select id, event, status, ok, error, attempt, at from webhook_deliveries where workspace_id = $1 and endpoint_id = $2 order by at desc, id desc limit $3",
    [workspaceId, endpointId, limit],
  );
  return rows.map((r) => ({ id: r.id, event: r.event, status: r.status, ok: r.ok, error: r.error, attempt: r.attempt, at: r.at.toISOString() }));
}

/* ---------- delivery ---------- */

/** What we send: header `Skanor-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>" with the endpoint's secret>`. */
export function sign(secret: string, t: number, body: string): string {
  return createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
}

type Target = { id: string; workspace_id: string; url: string; secret: string };
const ATTEMPTS = 2;
const AUTO_DISABLE_AFTER = 20;

async function deliver(ep: Target, eventId: string, type: string, body: string): Promise<{ ok: boolean; status: number | null; error: string }> {
  let last: { ok: boolean; status: number | null; error: string } = { ok: false, status: null, error: "not sent" };
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const safe = await checkWebhookUrl(ep.url);
    if (!safe.ok) last = { ok: false, status: null, error: `blocked: ${safe.message}`.slice(0, 200) };
    else {
      const t = Math.floor(Date.now() / 1000);
      try {
        const res = await fetch(safe.url, {
          method: "POST",
          redirect: "manual", // never follow a redirect into somewhere we haven't checked
          signal: AbortSignal.timeout(5000),
          headers: { "content-type": "application/json", "user-agent": "Skanor-Webhooks/1", "skanor-event": type, "skanor-delivery": eventId, "skanor-signature": `t=${t},v1=${sign(ep.secret, t, body)}` },
          body,
        });
        last = { ok: res.status >= 200 && res.status < 300, status: res.status, error: res.status >= 200 && res.status < 300 ? "" : `HTTP ${res.status}` };
      } catch (e) {
        last = { ok: false, status: null, error: (e instanceof Error ? (e.name === "TimeoutError" ? "timed out after 5 s" : e.message) : "failed").slice(0, 200) };
      }
    }
    await query("insert into webhook_deliveries (endpoint_id, workspace_id, event, event_id, status, ok, error, attempt) values ($1,$2,$3,$4,$5,$6,$7,$8)", [ep.id, ep.workspace_id, type, eventId, last.status, last.ok, last.error, attempt]);
    if (last.ok) break;
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 1500));
  }
  await query(
    `update webhook_endpoints set last_status = $2, last_at = now(),
            failures = case when $3 then 0 else failures + 1 end,
            active = case when not $3 and failures + 1 >= $4 then false else active end
      where id = $1`,
    [ep.id, last.status, last.ok, AUTO_DISABLE_AFTER],
  );
  if (Math.random() < 0.02) await query("delete from webhook_deliveries where at < now() - interval '30 days'");
  return last;
}

const later = (fn: () => Promise<unknown>) => {
  const run = () => fn().catch((e) => console.error("[webhook]", e instanceof Error ? e.message : e));
  try {
    after(run); // runs after the response is sent, so a slow endpoint never slows a customer
  } catch {
    void run(); // outside a request (scripts, tests)
  }
};

/** Tells every active endpoint that subscribes to `type`. Never throws and never makes the caller wait for the customer's server. */
export async function emitEvent(workspaceId: string, type: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  try {
    if (!(await flagOn("webhooks_delivery"))) return;
    const eps = await query<Target>("select id, workspace_id, url, secret from webhook_endpoints where workspace_id = $1 and active and $2 = any(events)", [workspaceId, type]);
    if (eps.length === 0) return;
    const eventId = randomUUID();
    const body = JSON.stringify({ id: eventId, type, created_at: new Date().toISOString(), data });
    for (const ep of eps) later(() => deliver(ep, eventId, type, body));
  } catch (e) {
    console.error("[webhook] could not emit:", e instanceof Error ? e.message : e);
  }
}

/** Sends a "ping" to one endpoint right now and returns what happened (for the Test button). */
export async function sendTest(workspaceId: string, id: string): Promise<{ ok: boolean; status: number | null; error: string } | null> {
  if (!uuidRe.test(id)) return null;
  const [ep] = await query<Target>("select id, workspace_id, url, secret from webhook_endpoints where id = $1 and workspace_id = $2", [id, workspaceId]);
  if (!ep) return null;
  const eventId = randomUUID();
  return deliver(ep, eventId, "ping", JSON.stringify({ id: eventId, type: "ping", created_at: new Date().toISOString(), data: { message: "This is a test from Skanor." } }));
}

/** Like emitEvent, but even the lookup of who is listening happens after the response. For hot paths such as scans. */
export function emitLater(workspaceId: string, type: WebhookEvent, data: Record<string, unknown>): void {
  later(() => emitEvent(workspaceId, type, data));
}
