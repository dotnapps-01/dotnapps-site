"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import type { LocationRecord } from "@/lib/settings";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

function LocationForm({ loc, onDone }: { loc: LocationRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: loc?.name ?? "", address: loc?.address ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(loc ? `/api/locations/${loc.id}` : "/api/locations", { method: loc ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.refresh();
      onDone();
    } else setErrors(j.fields ?? { name: res?.status === 409 ? "You've reached the limit of locations." : "We couldn't save that. Please try again." });
  }
  return (
    <form onSubmit={save} noValidate aria-label={loc ? "Edit location" : "Add location"} className="flex flex-col gap-3 border-t border-line-soft p-[18px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Location name" value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} error={errors.name} placeholder="RS Puram" labelClassName={label} className={control} />
        <Input label="Address" value={v.address} onChange={(e) => setV((x) => ({ ...x, address: e.target.value }))} placeholder="Street, area, city" labelClassName={label} className={control} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? "Saving…" : loc ? "Save location" : "Add location"}
        </Button>
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Where the business operates. The primary location is the one the sidebar shows. */
export function LocationsCard({ locations }: { locations: LocationRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState("");
  async function primary(l: LocationRecord) {
    const res = await fetch(`/api/locations/${l.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ primary: true }) });
    if (res.ok) router.refresh();
    else setMsg("Couldn't change the primary location.");
  }
  async function remove(l: LocationRecord) {
    if (!window.confirm(`Remove “${l.name}”? Its QR codes keep working, with no location.`)) return;
    const res = await fetch(`/api/locations/${l.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "Make another location primary first." : "Couldn't remove that location.");
  }
  const editingLoc = editing && editing !== "new" ? (locations.find((l) => l.id === editing) ?? null) : null;
  return (
    <div className="border-t border-line-soft">
      <div className="flex items-center justify-between gap-3 px-[18px] py-3.5">
        <h3 className="m-0 font-sans text-[15px] font-semibold">Locations</h3>
        <Button size="sm" onClick={() => setEditing("new")}>
          + Add location
        </Button>
      </div>
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pb-2 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      <ul className="m-0 list-none p-0">
        {locations.length === 0 ? <li className="px-[18px] py-3 text-sm text-graphite">No locations yet.</li> : null}
        {locations.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line-soft px-[18px] py-3">
            <div>
              <div className="text-sm font-semibold">{l.name}</div>
              <div className="text-[12.5px] text-muted">{[l.address, `${l.qrCodes} QR code${l.qrCodes === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {l.primary ? <Pill tone="success">PRIMARY</Pill> : <Button size="sm" aria-label={`Make ${l.name} primary`} onClick={() => primary(l)}>Make primary</Button>}
              <Button size="sm" aria-label={`Edit ${l.name}`} onClick={() => setEditing(l.id)}>
                Edit
              </Button>
              {!l.primary ? (
                <Button size="sm" aria-label={`Remove ${l.name}`} onClick={() => remove(l)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {editing ? <LocationForm key={editing} loc={editingLoc} onDone={() => setEditing(null)} /> : null}
    </div>
  );
}
