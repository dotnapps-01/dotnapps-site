"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import type { ItemRecord } from "@/lib/bookings";
import { DOW_NAMES, hhmm, type DayHours } from "@/lib/ops-input";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const rupees = (n: number | null) => (n === null || n === 0 ? "Free" : `₹${n.toLocaleString("en-IN")}`);

function ServiceForm({ item, onDone }: { item: ItemRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: item?.name ?? "", description: item?.description ?? "", durationMin: String(item?.durationMin ?? 30), price: item?.price != null ? String(item.price) : "", staff: (item?.staff ?? []).join(", "), needsApproval: item?.needsApproval ?? false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: "name" | "description" | "durationMin" | "price" | "staff") => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(item ? `/api/booking/items/${item.id}` : "/api/booking/items", { method: item ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "service", ...v }) }).catch(() => null);
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
    <form onSubmit={save} noValidate aria-label={item ? "Edit service" : "Add service"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Service name" value={v.name} onChange={set("name")} error={errors.name} placeholder="Haircut" labelClassName={label} className={control} />
        <Input label="Duration (minutes)" inputMode="numeric" value={v.durationMin} onChange={set("durationMin")} error={errors.durationMin} labelClassName={label} className={control} />
        <Input label="Price (₹)" inputMode="decimal" value={v.price} onChange={set("price")} error={errors.price} placeholder="Leave blank if free" labelClassName={label} className={control} />
        <Input label="Staff (comma separated)" value={v.staff} onChange={set("staff")} placeholder="Meena, Ravi" hint="Each person can take one booking at a time. Leave blank for one at a time in total." labelClassName={label} className={control} />
      </div>
      <Textarea label="Description (optional)" rows={2} value={v.description} onChange={set("description")} maxLength={200} labelClassName={label} className="min-h-14 text-sm" />
      <Toggle label="I confirm each booking myself (customers see “waiting for confirmation”)" checked={v.needsApproval} onCheckedChange={(a) => setV((x) => ({ ...x, needsApproval: a }))} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : item ? "Save service" : "Add service"}
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

function HoursForm({ hours }: { hours: DayHours[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => hours.map((h) => ({ dow: h.dow, closed: h.closed, open: hhmm(h.open), close: hhmm(h.close) })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (dow: number, p: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.dow === dow ? { ...x, ...p } : x)));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErrors({});
    const res = await fetch("/api/booking/hours", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hours: rows }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg("Saved.");
      router.refresh();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted times.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label="Opening hours" className="flex flex-col gap-2.5 px-[18px] pb-4 pt-3">
      <p className="m-0 text-sm text-graphite">Customers can only book inside these hours, up to two weeks ahead.</p>
      {rows.map((r) => (
        <div key={r.dow} className="grid grid-cols-[110px_1fr] items-end gap-3 sm:grid-cols-[110px_auto_1fr_1fr]">
          <div className="pb-2.5 text-sm font-semibold">{DOW_NAMES[r.dow]}</div>
          <div className="pb-1.5">
            <Toggle label="Open" checked={!r.closed} onCheckedChange={(a) => patch(r.dow, { closed: !a })} />
          </div>
          <Input label={`${DOW_NAMES[r.dow]} opens`} type="time" value={r.open} disabled={r.closed} onChange={(e) => patch(r.dow, { open: e.target.value })} error={errors[`${r.dow}.open`]} labelClassName="sr-only" className={control} />
          <Input label={`${DOW_NAMES[r.dow]} closes`} type="time" value={r.close} disabled={r.closed} onChange={(e) => patch(r.dow, { close: e.target.value })} error={errors[`${r.dow}.close`]} labelClassName="sr-only" className={control} />
        </div>
      ))}
      <div className="flex items-center gap-2.5 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save hours"}
        </Button>
        {msg ? (
          <span role="status" className="text-sm text-graphite">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** Services people can book, and the weekly hours their time slots come from. */
export function ServiceManager({ services, hours, startOpen }: { services: ItemRecord[]; hours: DayHours[]; startOpen: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(startOpen ? "new" : null);
  const [msg, setMsg] = useState("");
  async function retire(s: ItemRecord) {
    if (!window.confirm(`Remove “${s.name}”? Past bookings stay.`)) return;
    const res = await fetch(`/api/booking/items/${s.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still points at this service. Archive it first." : "Couldn't remove that service.");
  }
  const editingItem = editing && editing !== "new" ? (services.find((s) => s.id === editing) ?? null) : null;
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="svc-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="svc-h" className="m-0 font-sans text-[17px] font-semibold">
            Services
          </h2>
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            + Add service
          </Button>
        </div>
        {msg ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {msg}
          </p>
        ) : null}
        {editing ? (
          <Card>
            <CardHeader>
              <CardTitle>{editingItem ? `Edit: ${editingItem.name}` : "New service"}</CardTitle>
            </CardHeader>
            <ServiceForm key={editing} item={editingItem} onDone={() => setEditing(null)} />
          </Card>
        ) : null}
        <Card>
          <Table caption="Services">
            <TableHead>
              <TableRow>
                <Th>Service</Th>
                <Th>Duration</Th>
                <Th>Price</Th>
                <Th>Staff</Th>
                <Th>Booking</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.length === 0 ? (
                <TableRow>
                  <Td colSpan={6} className="text-muted">
                    No services yet. Add one, then make a Booking QR for it.
                  </Td>
                </TableRow>
              ) : (
                services.map((s) => (
                  <TableRow key={s.id}>
                    <Td className="font-semibold">
                      {s.name}
                      {s.needsApproval ? <span className="ml-1.5 text-[11px] font-normal text-muted">needs your confirmation</span> : null}
                    </Td>
                    <Td className="tabular">{`${s.durationMin} min`}</Td>
                    <Td className="tabular">{rupees(s.price)}</Td>
                    <Td>{s.staff.join(", ") || "—"}</Td>
                    <Td>
                      <Link href={`/app/studio?type=booking&ref=${s.id}`} className={buttonClasses({ size: "sm" })}>
                        {s.inUse ? "Another QR" : "Create QR"}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button size="sm" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.id)}>
                          Edit
                        </Button>
                        <Button size="sm" aria-label={`Remove ${s.name}`} onClick={() => retire(s)}>
                          Remove
                        </Button>
                      </div>
                    </Td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
            WhatsApp reminders before an appointment need Integrations, so they aren&rsquo;t sent yet.
          </p>
        </Card>
      </section>
      <Card className="max-w-[720px]">
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
        </CardHeader>
        <HoursForm hours={hours} />
      </Card>
    </div>
  );
}
