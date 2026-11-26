"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PRIORITIES } from "@/lib/ops-input";
import { TICKET_CATEGORIES } from "@/lib/qr-types";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

/** Raise a ticket by hand: a phone call, a walk-in, something you noticed yourself. */
export function NewTicketForm() {
  const router = useRouter();
  const [v, setV] = useState({ title: "", category: "Facility", priority: "normal", place: "", assignee: "", details: "", customerName: "", customerPhone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.push(`/app/tickets?ticket=${j.id}`);
      router.refresh();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted fields.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label="New ticket" className="flex flex-col gap-3.5 p-4">
      <Input label="What is the problem?" value={v.title} onChange={set("title")} error={errors.title} placeholder="AC too cold near window" labelClassName={label} className={control} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
        <Select label="Category" value={v.category} onChange={set("category")} error={errors.category} labelClassName={label} className={control}>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select label="Priority" value={v.priority} onChange={set("priority")} labelClassName={label} className={control}>
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input label="Where" value={v.place} onChange={set("place")} placeholder="Hall 1, Table 6" labelClassName={label} className={control} />
        <Input label="Assignee" value={v.assignee} onChange={set("assignee")} placeholder="Who will fix it" labelClassName={label} className={control} />
      </div>
      <Textarea label="Details (optional)" rows={2} value={v.details} onChange={set("details")} maxLength={600} labelClassName={label} className="min-h-16 text-sm" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Customer name (optional)" value={v.customerName} onChange={set("customerName")} labelClassName={label} className={control} />
        <Input label="Customer mobile (optional)" type="tel" value={v.customerPhone} onChange={set("customerPhone")} error={errors.customerPhone} placeholder="+91" labelClassName={label} className={control} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Create ticket"}
        </Button>
        <Link href="/app/tickets" className={buttonClasses()}>
          Cancel
        </Link>
        {msg ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}
