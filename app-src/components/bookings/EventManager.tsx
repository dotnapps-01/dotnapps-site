"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { ItemRecord } from "@/lib/bookings";
import { GateScanner } from "./GateScanner";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const local = (iso: string | null) => {
  // an <input type="datetime-local"> shows India time regardless of the browser's zone
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : "");
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function EventForm({ item, onDone }: { item: ItemRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: item?.name ?? "", description: item?.description ?? "", startsAt: local(item?.startsAt ?? null), capacity: String(item?.capacity ?? 100), price: item?.price != null ? String(item.price) : "", venue: item?.venue ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(item ? `/api/booking/items/${item.id}` : "/api/booking/items", { method: item ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "event", ...v, startsAt: fromLocal(v.startsAt) }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.refresh();
      onDone();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted fields.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label={item ? "Edit event" : "Add event"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Event name" value={v.name} onChange={set("name")} error={errors.name} placeholder="Diwali Food Fest" labelClassName={label} className={control} />
        <Input label="Starts (India time)" type="datetime-local" value={v.startsAt} onChange={set("startsAt")} error={errors.startsAt} labelClassName={label} className={control} />
        <Input label="Tickets available" inputMode="numeric" value={v.capacity} onChange={set("capacity")} error={errors.capacity} labelClassName={label} className={control} />
        <Input label="Ticket price (₹)" inputMode="decimal" value={v.price} onChange={set("price")} error={errors.price} placeholder="Leave blank if free" labelClassName={label} className={control} />
        <Input label="Venue" value={v.venue} onChange={set("venue")} placeholder="Main hall" labelClassName={label} className={control} />
      </div>
      <Textarea label="Description (optional)" rows={2} value={v.description} onChange={set("description")} maxLength={200} labelClassName={label} className="min-h-14 text-sm" />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : item ? "Save event" : "Add event"}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        {msg ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Events with limited tickets: registrations, check-ins at the gate, and the code to put on the poster. */
export function EventManager({ events, startOpen }: { events: ItemRecord[]; startOpen: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(startOpen ? "new" : null);
  const [msg, setMsg] = useState("");
  async function retire(e: ItemRecord) {
    if (!window.confirm(`Remove “${e.name}”? Tickets already booked stay in the bookings list.`)) return;
    const res = await fetch(`/api/booking/items/${e.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still points at this event. Archive it first." : "Couldn't remove that event.");
  }
  const editingItem = editing && editing !== "new" ? (events.find((e) => e.id === editing) ?? null) : null;
  return (
    <section aria-labelledby="ev-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ev-h" className="m-0 font-sans text-[17px] font-semibold">
          Events &amp; tickets
        </h2>
        <div className="flex gap-2">
          <GateScanner />
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            + New event
          </Button>
        </div>
      </div>
      {msg ? (
        <p role="alert" className="m-0 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingItem ? `Edit: ${editingItem.name}` : "New event"}</CardTitle>
          </CardHeader>
          <EventForm key={editing} item={editingItem} onDone={() => setEditing(null)} />
        </Card>
      ) : null}
      {events.length === 0 && !editing ? <p className="m-0 text-sm text-graphite">No events yet. Create one with a ticket limit, then make a Booking QR for the poster.</p> : null}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3 p-0">
        {events.map((e) => {
          const cap = e.capacity ?? 0;
          const pct = cap ? Math.min(100, Math.round((e.checkedIn / cap) * 100)) : 0;
          return (
            <li key={e.id}>
              <Card className="h-full">
                <article aria-label={e.name} className="flex flex-col gap-3 p-4">
                  <div>
                    <div className="text-[15px] font-semibold">{e.name}</div>
                    <div className="mt-0.5 text-xs text-graphite">{[e.startsAt ? when(e.startsAt) : "", e.venue].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="font-display text-[32px] font-medium tracking-display">
                        {`${e.booked}`}
                        <span className="text-base text-muted">{` / ${cap}`}</span>
                      </div>
                      <div className="k">Tickets booked</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-sm font-semibold">{`${e.checkedIn} checked in`}</div>
                    </div>
                  </div>
                  <div role="progressbar" aria-label={`${e.name} check-ins`} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={e.checkedIn} className="h-2 overflow-hidden rounded-full bg-mist">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/app/studio?type=booking&ref=${e.id}`} className={buttonClasses({ size: "sm" })}>
                      {e.inUse ? "Another QR" : "Create QR"}
                    </Link>
                    <Button size="sm" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e.id)}>
                      Edit
                    </Button>
                    <Button size="sm" aria-label={`Remove ${e.name}`} onClick={() => retire(e)}>
                      Remove
                    </Button>
                  </div>
                </article>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
