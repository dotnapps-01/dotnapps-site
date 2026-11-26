"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import type { PointRecord } from "@/lib/attendance";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

function PointForm({ point, onDone }: { point: PointRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: point?.name ?? "", lat: point?.lat?.toString() ?? "", lng: point?.lng?.toString() ?? "", radiusM: String(point?.radiusM ?? 100), requireGeo: point?.requireGeo ?? true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: "name" | "lat" | "lng" | "radiusM") => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  function useHere() {
    setMsg("");
    if (!("geolocation" in navigator)) return setMsg("This browser can't share its location. Type the coordinates instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => setV((x) => ({ ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })),
      () => setMsg("Couldn't get your location. Allow it in the browser, or type the coordinates."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(point ? `/api/points/${point.id}` : "/api/points", { method: point ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
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
    <form onSubmit={save} noValidate aria-label={point ? "Edit check-in point" : "Add check-in point"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Name" value={v.name} onChange={set("name")} error={errors.name} placeholder="Main gate" labelClassName={label} className={control} />
        <Input label="Latitude" inputMode="decimal" value={v.lat} onChange={set("lat")} error={errors.lat} placeholder="13.0827" labelClassName={label} className={control} />
        <Input label="Longitude" inputMode="decimal" value={v.lng} onChange={set("lng")} error={errors.lng} placeholder="80.2707" labelClassName={label} className={control} />
        <Input label="Radius (metres)" inputMode="numeric" value={v.radiusM} onChange={set("radiusM")} error={errors.radiusM} labelClassName={label} className={control} />
      </div>
      <div>
        <Button size="sm" onClick={useHere}>
          <MapPin size={14} aria-hidden="true" /> Use my current location
        </Button>
      </div>
      <Toggle label="Workers must be at this location to check in" checked={v.requireGeo} onCheckedChange={(a) => setV((x) => ({ ...x, requireGeo: a }))} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : point ? "Save point" : "Add point"}
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

/** Check-in points: where workers scan, and how close they must be. */
export function PointManager({ points }: { points: PointRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState("");
  async function remove(p: PointRecord) {
    if (!window.confirm(`Delete “${p.name}”?`)) return;
    const res = await fetch(`/api/points/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still points at this check-in point. Archive it first." : "Couldn't delete that point.");
  }
  const editingPoint = editing && editing !== "new" ? (points.find((p) => p.id === editing) ?? null) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-in points</CardTitle>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          + Add
        </Button>
      </CardHeader>
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pt-3 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {editing ? <PointForm key={editing} point={editingPoint} onDone={() => setEditing(null)} /> : null}
      {points.length === 0 && !editing ? <p className="m-0 p-[18px] text-sm text-graphite">No check-in points yet. Add one, then make an Attendance point QR for it.</p> : null}
      <ul className="m-0 list-none p-0">
        {points.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-[18px] py-3 last:border-b-0">
            <div>
              <div className="text-[13.5px] font-semibold">{p.name}</div>
              <div className="tabular mt-0.5 text-[11px] text-muted">{p.requireGeo && p.lat !== null ? `Geofence ${p.radiusM} m` : "No location check"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="tabular text-[11px] text-graphite">{`${p.today} today`}</span>
              <Link href={`/app/studio?type=attend&ref=${p.id}`} className={buttonClasses({ size: "sm" })}>
                {p.inUse ? "Another QR" : "Create QR"}
              </Link>
              <Button size="sm" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p.id)}>
                Edit
              </Button>
              <Button size="sm" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
