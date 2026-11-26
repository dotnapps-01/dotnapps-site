"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { WEBHOOK_EVENTS, type DeliveryView, type EndpointView, type WebhookEvent } from "@/lib/webhook-events";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }) : "never");

/** Webhook endpoints: add one, send a test, pause it, and see what happened to recent deliveries. */
export function WebhookManager({ endpoints, deliveries }: { endpoints: EndpointView[]; deliveries: Record<string, DeliveryView[]> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["lead.created"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [tested, setTested] = useState<Record<string, string>>({});

  const toggle = (k: WebhookEvent) => setEvents((e) => (e.includes(k) ? e.filter((x) => x !== k) : [...e, k]));

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg("");
    const res = await fetch("/api/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, events }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setFresh({ url, secret: j.secret });
      setOpen(false);
      setUrl("");
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg(res?.status === 409 ? "You've reached the limit of endpoints." : "We couldn't add that endpoint. Please try again.");
  }
  async function test(ep: EndpointView) {
    setTested((t) => ({ ...t, [ep.id]: "Sending…" }));
    const res = await fetch(`/api/webhooks/${ep.id}/test`, { method: "POST" }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setTested((t) => ({ ...t, [ep.id]: res?.ok ? (j.delivered ? `Delivered (HTTP ${j.status}).` : `Failed: ${j.error || "no answer"}.`) : "Couldn't send the test." }));
    router.refresh();
  }
  async function patch(ep: EndpointView, active: boolean) {
    const res = await fetch(`/api/webhooks/${ep.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: ep.url, events: ep.events, active }) });
    if (res.ok) router.refresh();
    else setMsg("Couldn't change that endpoint.");
  }
  async function remove(ep: EndpointView) {
    if (!window.confirm(`Remove ${ep.url}?`)) return;
    const res = await fetch(`/api/webhooks/${ep.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg("Couldn't remove that endpoint.");
  }
  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.secret);
      setCopied(true);
    } catch {
      setMsg("Couldn't copy. Select the secret and copy it by hand.");
    }
  }

  return (
    <Card id="webhooks" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <Button size="sm" variant="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          + Add endpoint
        </Button>
      </CardHeader>
      {fresh ? (
        <div role="status" className="m-[18px] flex flex-col gap-2 rounded-input border border-ink bg-paper p-3.5">
          <div className="text-sm font-semibold">{`Endpoint added. Copy the signing secret now: this is the only time it is shown.`}</div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="tabular break-all rounded-lg bg-white px-2.5 py-1.5 text-[13px]">{fresh.secret}</code>
            <Button size="sm" onClick={copy} aria-label="Copy the signing secret">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => setFresh(null)}>
              I&rsquo;ve saved it
            </Button>
          </div>
        </div>
      ) : null}
      {open ? (
        <form onSubmit={add} noValidate aria-label="New webhook endpoint" className="flex flex-col gap-3 border-b border-line-soft p-[18px]">
          <Input label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} placeholder="https://example.com/hooks/skanor" className="min-h-10 text-sm" />
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 p-0 text-[11px] font-medium uppercase tracking-[0.05em] text-graphite">Send me</legend>
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev.key} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={events.includes(ev.key)} onChange={() => toggle(ev.key)} className="h-4 w-4 accent-ink" />
                <span className="tabular text-[12.5px]">{ev.key}</span>
                <span className="text-muted">{ev.label}</span>
              </label>
            ))}
            {errors.events ? (
              <p role="alert" className="m-0 text-xs text-danger-fg">
                {errors.events}
              </p>
            ) : null}
          </fieldset>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add endpoint"}
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pt-3 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {endpoints.length === 0 && !open ? <p className="m-0 p-[18px] text-sm text-graphite">No endpoints yet. Add one to be told the moment something happens.</p> : null}
      <ul className="m-0 list-none p-0">
        {endpoints.map((ep) => {
          const health = !ep.active ? { tone: "neutral" as const, text: "PAUSED" } : ep.failures > 0 ? { tone: "warning" as const, text: `${ep.failures} FAILURE${ep.failures === 1 ? "" : "S"}` } : { tone: "success" as const, text: ep.lastAt ? "HEALTHY" : "READY" };
          const ds = deliveries[ep.id] ?? [];
          return (
            <li key={ep.id} className="flex flex-col gap-2.5 border-t border-line-soft px-[18px] py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular break-all text-[12.5px] font-semibold">{ep.url}</span>
                <Pill tone={health.tone}>{health.text}</Pill>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ep.events.map((e) => (
                  <Pill key={e}>{e}</Pill>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" aria-label={`Send a test to ${ep.url}`} onClick={() => test(ep)}>
                  Send test
                </Button>
                <Button size="sm" aria-label={`${ep.active ? "Pause" : "Resume"} ${ep.url}`} onClick={() => patch(ep, !ep.active)}>
                  {ep.active ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" aria-label={`Remove ${ep.url}`} onClick={() => remove(ep)}>
                  Remove
                </Button>
                {tested[ep.id] ? (
                  <span role="status" className="text-xs text-graphite">
                    {tested[ep.id]}
                  </span>
                ) : null}
              </div>
              {ds.length ? (
                <details className="text-[13px]">
                  <summary className="cursor-pointer py-1 font-medium">{`Recent deliveries (${ds.length})`}</summary>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                    {ds.map((d) => (
                      <li key={d.id} className="tabular flex flex-wrap gap-x-3 text-xs">
                        <span className={d.ok ? "text-success-fg" : "text-danger-fg"}>{d.ok ? "✓" : "✗"}</span>
                        <span>{d.event}</span>
                        <span>{d.status ? `HTTP ${d.status}` : d.error}</span>
                        <span className="text-muted">{`attempt ${d.attempt} · ${when(d.at)}`}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs leading-[1.5] text-muted">
        Each request is signed (see the API docs). A failed delivery is tried once more straight away; there is no longer retry queue yet. After 20 failures in a row an endpoint is paused.
      </p>
    </Card>
  );
}
