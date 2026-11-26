"use client";

import { Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import type { DueState } from "@/lib/ops-input";
import type { AssetRecord } from "@/lib/tickets";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const DUE: Record<DueState, { tone: PillTone; text: string }> = { none: { tone: "neutral", text: "NO SCHEDULE" }, overdue: { tone: "danger", text: "OVERDUE" }, soon: { tone: "warning", text: "DUE SOON" }, ok: { tone: "success", text: "ON TRACK" } };
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const dmy = (d: string | null) => (d ? new Date(`${d}T06:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");

function AssetForm({ asset, onDone }: { asset: AssetRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: asset?.name ?? "", place: asset?.place ?? "", vendor: asset?.vendor ?? "", intervalDays: asset?.intervalDays ? String(asset.intervalDays) : "", lastService: asset?.lastService ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(asset ? `/api/assets/${asset.id}` : "/api/assets", { method: asset ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
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
    <form onSubmit={save} noValidate aria-label={asset ? "Edit asset" : "Add asset"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Asset name" value={v.name} onChange={set("name")} error={errors.name} placeholder="Daikin split AC" labelClassName={label} className={control} />
        <Input label="Where it is" value={v.place} onChange={set("place")} placeholder="Floor 3, Bay 2" labelClassName={label} className={control} />
        <Input label="Service vendor" value={v.vendor} onChange={set("vendor")} placeholder="CoolTech AMC" labelClassName={label} className={control} />
        <Input label="Service every (days)" inputMode="numeric" value={v.intervalDays} onChange={set("intervalDays")} error={errors.intervalDays} placeholder="90" labelClassName={label} className={control} />
        <Input label="Last serviced" type="date" value={v.lastService} onChange={set("lastService")} error={errors.lastService} labelClassName={label} className={control} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : asset ? "Save asset" : "Add asset"}
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

function ServiceForm({ asset, onDone }: { asset: AssetRecord; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(() => ({ servicedOn: istToday(), byName: asset.vendor, notes: "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/assets/${asset.id}/service`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.refresh();
      onDone();
    } else setErrors(j.fields ?? { notes: "Couldn't save that." });
  }
  return (
    <form onSubmit={save} noValidate aria-label={`Log service for ${asset.name}`} className="flex flex-col gap-2.5 border-t border-line-soft p-3">
      <Input label="Serviced on" type="date" value={v.servicedOn} onChange={set("servicedOn")} error={errors.servicedOn} labelClassName={label} className={control} />
      <Input label="Serviced by" value={v.byName} onChange={set("byName")} labelClassName={label} className={control} />
      <Textarea label="What was done" rows={2} value={v.notes} onChange={set("notes")} error={errors.notes} maxLength={600} labelClassName={label} className="min-h-14 text-sm" />
      <div className="flex gap-2">
        <Button size="sm" type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save service"}
        </Button>
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Assets with QR: what they are, when they are next due, raise-a-ticket codes, and the service log. */
export function AssetManager({ assets }: { assets: AssetRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function retire(a: AssetRecord) {
    if (!window.confirm(`Retire “${a.name}”? Its tickets and service history stay.`)) return;
    const res = await fetch(`/api/assets/${a.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still points at this asset. Archive it first." : "Couldn't retire that asset.");
  }

  const editingAsset = editing && editing !== "new" ? (assets.find((a) => a.id === editing) ?? null) : null;
  return (
    <section aria-labelledby="assets-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="assets-h" className="m-0 font-sans text-[17px] font-semibold">
          Assets with QR
        </h2>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          + Add asset
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
            <CardTitle>{editingAsset ? `Edit: ${editingAsset.name}` : "New asset"}</CardTitle>
          </CardHeader>
          <AssetForm key={editing} asset={editingAsset} onDone={() => setEditing(null)} />
        </Card>
      ) : null}
      {assets.length === 0 && !editing ? <p className="m-0 text-sm text-graphite">No assets yet. Add an AC, lift, genset or anything that gets serviced, then give it a QR code so people can report problems.</p> : null}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3 p-0">
        {assets.map((a) => (
          <li key={a.id}>
            <Card className="h-full">
              <article aria-label={a.name} className="flex flex-col">
                <div className="flex gap-3.5 p-4">
                  <div aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-mist">
                    <Wrench size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{a.name}</div>
                    <div className="tabular mt-0.5 text-[11px] text-muted">{[a.code, a.place].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone={DUE[a.due].tone}>{DUE[a.due].text}</Pill>
                      <span className="tabular text-[11px] text-graphite">{a.nextDue ? `Due ${dmy(a.nextDue)}` : a.lastService ? `Last ${dmy(a.lastService)}` : ""}</span>
                    </div>
                    <div className="mt-1 text-xs text-graphite">{[a.vendor, a.openTickets ? `${a.openTickets} open ticket${a.openTickets === 1 ? "" : "s"}` : "", a.inUse ? `${a.scans30} scans (30d)` : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-line-soft p-3">
                  <Button size="sm" onClick={() => setLogging(logging === a.id ? null : a.id)} aria-expanded={logging === a.id}>
                    Log service
                  </Button>
                  <Link href={`/app/studio?type=asset&ref=${a.id}`} className={buttonClasses({ size: "sm" })}>
                    {a.inUse ? "Another QR" : "Create QR"}
                  </Link>
                  <Button size="sm" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a.id)}>
                    Edit
                  </Button>
                  <Button size="sm" aria-label={`Retire ${a.name}`} onClick={() => retire(a)}>
                    Retire
                  </Button>
                </div>
                {logging === a.id ? <ServiceForm asset={a} onDone={() => setLogging(null)} /> : null}
              </article>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
