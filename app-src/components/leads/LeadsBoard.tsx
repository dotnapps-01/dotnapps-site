"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { STAGES, type Stage } from "@/lib/engage-input";
import type { LeadRecord } from "@/lib/engage";
import { waDigits } from "@/lib/qr-types";

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
};

function LeadCard({ lead }: { lead: LeadRecord }) {
  const router = useRouter();
  const [owner, setOwner] = useState(lead.owner);
  const [notes, setNotes] = useState(lead.notes);
  const [note, setNote] = useState("");
  const wa = waDigits(lead.phone);

  async function patch(body: Record<string, unknown>, ok: string) {
    setNote("");
    const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setNote(ok);
      router.refresh();
    } else setNote("Couldn't save that. Try again.");
  }

  return (
    <article id={`lead-${lead.id}`} aria-label={`Lead ${lead.name}`} className="flex flex-col gap-2 overflow-hidden rounded-card border border-line bg-white p-3">
      <div className="flex justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{lead.name}</span>
        <span suppressHydrationWarning className="tabular text-[10px] text-muted">
          {ago(lead.createdAt)}
        </span>
      </div>
      <span className="text-[12.5px] text-graphite">{[lead.interest, lead.message].filter(Boolean).join(" · ") || "No message"}</span>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="info">{(lead.source || "LEAD FORM").toUpperCase()}</Pill>
        <Pill>{lead.owner || "Unassigned"}</Pill>
      </div>
      <div className="flex gap-1.5">
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${lead.name}`} className={buttonClasses({ size: "sm", className: "flex-1 px-2.5" })}>
            WhatsApp
          </a>
        ) : null}
        <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`} className={buttonClasses({ size: "sm", className: "flex-1 px-2.5" })}>
          Call
        </a>
      </div>
      <Select label={`Stage for ${lead.name}`} hideLabel value={lead.stage} onChange={(e) => patch({ stage: e.target.value as Stage }, "Moved.")} className="min-h-9 text-[13px]">
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </Select>
      <details className="text-[13px]">
        <summary className="cursor-pointer py-1 font-medium">Details</summary>
        <div className="mt-2 flex flex-col gap-2">
          {lead.email ? <div className="text-xs text-muted">{lead.email}</div> : null}
          {lead.preferredTime ? <div className="text-xs text-muted">Preferred time: {lead.preferredTime}</div> : null}
          <Input label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who follows up" maxLength={40} className="min-h-9 text-[13px]" />
          <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-16 text-[13px]" />
          <Button size="sm" onClick={() => patch({ owner, notes }, "Saved.")}>
            Save details
          </Button>
        </div>
      </details>
      {note ? (
        <p role="status" className="m-0 text-xs text-muted">
          {note}
        </p>
      ) : null}
    </article>
  );
}

/** The lead pipeline: five columns, with a stage select on every card (no drag-and-drop needed). */
export function LeadsBoard({ leads }: { leads: LeadRecord[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[1000px] grid-cols-5 gap-3">
        {STAGES.map((c) => {
          const items = leads.filter((l) => l.stage === c.key);
          return (
            <section key={c.key} aria-label={`${c.label} leads`} className="flex flex-col rounded-card border border-line bg-[#F3F3F5]">
              <div className={cn("flex items-center justify-between border-b-2 px-3.5 py-3")} style={{ borderBottomColor: c.line }}>
                <h2 className="m-0 font-sans text-[13px] font-semibold">{c.label}</h2>
                <span className="tabular text-[11px] text-muted">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2.5">
                {items.length === 0 ? <p className="m-0 px-1 py-2 text-xs text-muted">Nothing here.</p> : items.map((l) => <LeadCard key={l.id} lead={l} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
