"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PRIORITIES, type SlaInput } from "@/lib/ops-input";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";

/** Hours to resolve a ticket, by priority. */
export function SlaForm({ sla }: { sla: SlaInput }) {
  const router = useRouter();
  const [v, setV] = useState({ high: String(sla.high), normal: String(sla.normal), low: String(sla.low) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErrors({});
    const res = await fetch("/api/sla", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg("Saved. Open tickets now follow these hours.");
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label="SLA rules" className="flex flex-col gap-3.5 p-[18px]">
      <p className="m-0 text-sm leading-[1.5] text-graphite">How many hours a ticket has before it counts as breaching its SLA. Breaching tickets are highlighted for you. Escalating to the owner on WhatsApp needs Integrations.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
        {PRIORITIES.map((p) => (
          <Input key={p.key} label={`${p.label} priority (hours)`} inputMode="numeric" value={v[p.key]} onChange={(e) => setV((x) => ({ ...x, [p.key]: e.target.value }))} error={errors[p.key]} labelClassName={label} className="min-h-10 text-sm" />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save SLA rules"}
        </Button>
        {msg ? (
          <p role="status" className="m-0 text-sm text-graphite">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}
