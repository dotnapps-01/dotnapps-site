"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PRIORITIES, type TicketStatus } from "@/lib/ops-input";
import { waDigits } from "@/lib/qr-types";
import type { TicketEvent, TicketRecord } from "@/lib/tickets";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const STATUS_TEXT: Record<TicketStatus, string> = { open: "OPEN", in_progress: "IN PROGRESS", resolved: "RESOLVED" };

/** One ticket: who has it, how urgent, what happened, and a reply the customer sees on their ticket page. */
export function TicketDetail({ ticket, events, origin, slaText }: { ticket: TicketRecord; events: TicketEvent[]; origin: string; slaText: string }) {
  const router = useRouter();
  const [assignee, setAssignee] = useState(ticket.assignee);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const wa = waDigits(ticket.customerPhone);

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/tickets/${ticket.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setMsg(ok);
      if ("reply" in body) setReply("");
      if ("note" in body) setNote("");
      router.refresh();
    } else setMsg("Couldn't save that. Please try again.");
  }

  return (
    <Card className="flex-[1_1_340px]">
      <CardHeader>
        <div>
          <div className="k">{`#${ticket.seq} · ${ticket.category}`}</div>
          <h2 className="mb-0 mt-1 text-[15px] font-semibold">{ticket.title}</h2>
        </div>
        <Pill tone={ticket.status === "resolved" ? "success" : ticket.breached ? "danger" : ticket.status === "in_progress" ? "info" : "warning"}>{ticket.status !== "resolved" && ticket.breached ? "BREACHED" : STATUS_TEXT[ticket.status]}</Pill>
      </CardHeader>
      <div className="flex flex-col gap-1 border-b border-line-soft px-[18px] py-3 text-sm text-graphite">
        {ticket.place ? <div>{ticket.place}</div> : null}
        {ticket.assetName ? <div>Asset: {ticket.assetName}</div> : null}
        {ticket.details ? <div className="whitespace-pre-wrap text-ink">{ticket.details}</div> : null}
        {ticket.customerName || ticket.customerPhone ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span>{[ticket.customerName, ticket.customerPhone].filter(Boolean).join(" · ")}</span>
            {wa ? (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${ticket.customerName || ticket.customerPhone}`} className={buttonClasses({ size: "sm" })}>
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="tabular text-xs text-muted">{`${ticket.status === "resolved" ? "Resolved" : "SLA left"}: ${ticket.status === "resolved" ? fmt(ticket.resolvedAt ?? ticket.createdAt) : slaText}`}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-b border-line-soft p-[18px]">
        <div className="flex flex-col gap-1.5">
          <Input label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} onBlur={() => assignee !== ticket.assignee && patch({ assignee }, "Assigned.")} maxLength={60} labelClassName={label} className={control} />
        </div>
        <Select label="Priority" value={ticket.priority} onChange={(e) => patch({ priority: e.target.value }, "Priority changed.")} labelClassName={label} className={control}>
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3.5 p-[18px]">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span aria-hidden="true" className={`mt-[5px] h-2.5 w-2.5 flex-none rounded-full ${e.kind === "note" ? "bg-track" : "bg-ink"}`} />
            <div>
              <div className="text-[13.5px]">
                {e.kind === "note" ? <strong>Internal note: </strong> : null}
                {e.kind === "reply" ? <strong>Reply to customer: </strong> : null}
                {e.text}
              </div>
              <div className="tabular mt-0.5 text-[11px] text-muted">{fmt(e.at)}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2.5 px-[18px] pb-[18px]">
        <Textarea label="Reply to customer" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={600} hint="Shown on the customer's ticket page. WhatsApp sending needs Integrations." labelClassName={label} className="min-h-[76px] text-sm" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={busy || !reply.trim()} onClick={() => patch({ reply }, "Reply saved.")}>
            Send reply
          </Button>
          {ticket.status === "open" ? (
            <Button size="sm" disabled={busy} onClick={() => patch({ status: "in_progress" }, "Work started.")}>
              Start work
            </Button>
          ) : null}
          {ticket.status !== "resolved" ? (
            <Button size="sm" disabled={busy} onClick={() => patch({ status: "resolved" }, "Marked resolved.")}>
              Mark resolved
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => patch({ status: "open" }, "Reopened.")}>
              Reopen
            </Button>
          )}
        </div>
        <Textarea label="Internal note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} labelClassName={label} className="min-h-14 text-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy || !note.trim()} onClick={() => patch({ note }, "Note added.")}>
            Add note
          </Button>
          <a href={`${origin}/o/${ticket.token}`} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">
            Customer&rsquo;s ticket page
          </a>
        </div>
        {msg ? (
          <p role="status" className="m-0 text-xs text-muted">
            {msg}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
