"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { CouponRecord } from "@/lib/engage";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const STATE: Record<CouponRecord["state"], { tone: PillTone; text: string }> = { live: { tone: "success", text: "LIVE" }, paused: { tone: "warning", text: "PAUSED" }, scheduled: { tone: "info", text: "SCHEDULED" }, ended: { tone: "neutral", text: "ENDED" } };
const local = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const body = (c: CouponRecord, patch: Partial<CouponRecord> = {}) => ({ ...c, ...patch });

function CouponForm({ coupon, onDone }: { coupon: CouponRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: coupon?.title ?? "",
    headline: coupon?.headline ?? "",
    description: coupon?.description ?? "",
    codePrefix: coupon?.codePrefix ?? "",
    validDays: String(coupon?.validDays ?? 7),
    perCustomer: String(coupon?.perCustomer ?? 1),
    totalLimit: coupon?.totalLimit ? String(coupon.totalLimit) : "",
    startsAt: local(coupon?.startsAt ?? null),
    endsAt: local(coupon?.endsAt ?? null),
    status: coupon?.status ?? "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const payload = { ...v, startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null, endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null, totalLimit: v.totalLimit || null };
    const res = await fetch(coupon ? `/api/coupons/${coupon.id}` : "/api/coupons", { method: coupon ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
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
    <form onSubmit={save} noValidate aria-label={coupon ? "Edit offer" : "New offer"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Offer name" value={v.title} onChange={set("title")} error={errors.title} placeholder="Weekend filter coffee" labelClassName={label} className={control} />
        <Input label="Headline" value={v.headline} onChange={set("headline")} error={errors.headline} placeholder="2 for ₹99" labelClassName={label} className={control} />
        <Input label="Code prefix" value={v.codePrefix} onChange={(e) => setV((x) => ({ ...x, codePrefix: e.target.value.toUpperCase() }))} error={errors.codePrefix} placeholder="WKND" hint="Customer codes look like WKND-7K2Q." labelClassName={label} className={control} />
      </div>
      <Textarea label="Details (optional)" rows={2} value={v.description} onChange={set("description")} maxLength={160} labelClassName={label} className="min-h-16 text-sm" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
        <Input label="Valid for (days after claiming)" inputMode="numeric" value={v.validDays} onChange={set("validDays")} error={errors.validDays} labelClassName={label} className={control} />
        <Input label="Claims per customer" inputMode="numeric" value={v.perCustomer} onChange={set("perCustomer")} error={errors.perCustomer} labelClassName={label} className={control} />
        <Input label="Total limit" inputMode="numeric" value={v.totalLimit} onChange={set("totalLimit")} error={errors.totalLimit} placeholder="No limit" labelClassName={label} className={control} />
        <Select label="Status" value={v.status} onChange={set("status")} labelClassName={label} className={control}>
          <option value="active">Live</option>
          <option value="paused">Paused</option>
        </Select>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Starts (optional)" type="datetime-local" value={v.startsAt} onChange={set("startsAt")} labelClassName={label} className={control} />
        <Input label="Ends (optional)" type="datetime-local" value={v.endsAt} onChange={set("endsAt")} error={errors.endsAt} labelClassName={label} className={control} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : coupon ? "Save offer" : "Create offer"}
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

/** Coupons & offers: the grid of offers, and the create/edit form. */
export function CouponManager({ coupons, startOpen, editId }: { coupons: CouponRecord[]; startOpen: boolean; editId: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(editId ?? (startOpen ? "new" : null));
  const [msg, setMsg] = useState("");

  async function toggle(c: CouponRecord) {
    const res = await fetch(`/api/coupons/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body(c, { status: c.status === "active" ? "paused" : "active" })) });
    if (res.ok) router.refresh();
    else setMsg("Couldn't update that offer.");
  }
  async function remove(c: CouponRecord) {
    if (!window.confirm(`Delete “${c.title}”? Codes already claimed stop working.`)) return;
    const res = await fetch(`/api/coupons/${c.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still points at this offer. Archive it first." : "Couldn't delete that offer.");
  }

  const editingCoupon = editing && editing !== "new" ? (coupons.find((c) => c.id === editing) ?? null) : null;
  return (
    <section id="coupons" aria-labelledby="coupons-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="coupons-h" className="m-0 font-sans text-[17px] font-semibold">
          Coupons &amp; offers
        </h2>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          + New offer
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
            <CardTitle>{editingCoupon ? `Edit: ${editingCoupon.title}` : "New offer"}</CardTitle>
          </CardHeader>
          <CouponForm key={editing} coupon={editingCoupon} onDone={() => setEditing(null)} />
        </Card>
      ) : null}
      {coupons.length === 0 && !editing ? <p className="m-0 text-sm text-graphite">No offers yet. Create one, then link it to a Coupon QR code.</p> : null}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0">
        {coupons.map((c) => {
          const pct = c.totalLimit ? Math.min(100, (c.redeemed / c.totalLimit) * 100) : c.claimed ? (c.redeemed / c.claimed) * 100 : 0;
          return (
            <li key={c.id}>
              <Card className="flex h-full flex-col">
                <div className="flex justify-between gap-2.5 border-b border-dashed border-track p-4" style={{ background: c.state === "live" ? "#F3EEFF" : "#FFFFFF" }}>
                  <div>
                    <div className="tabular text-[10.5px] opacity-80">COUPON · {c.codePrefix}</div>
                    <div className="disp mt-1 text-[26px]">{c.headline}</div>
                  </div>
                  <Pill tone={STATE[c.state].tone} className="self-start">
                    {STATE[c.state].text}
                  </Pill>
                </div>
                <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
                  <div className="text-[13.5px] font-semibold">{c.title}</div>
                  <div className="tabular text-[11px] text-muted">
                    {c.perCustomer} per customer · valid {c.validDays} days{c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>Redeemed</span>
                      <span className="tabular">
                        {c.redeemed} / {c.totalLimit ?? `${c.claimed} claimed`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-mist">
                      <div className="h-1.5 bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <Link href={`/app/studio?type=coupon&ref=${c.id}`} className={buttonClasses({ size: "sm" })}>
                      Create QR
                    </Link>
                    <Button size="sm" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.title}`}>
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => toggle(c)} aria-label={`${c.status === "active" ? "Pause" : "Resume"} ${c.title}`}>
                      {c.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
