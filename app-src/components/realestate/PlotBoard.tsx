"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { FACINGS, PLOT_STATUSES, priceText, type PlotStatus } from "@/lib/ops-input";
import type { PlotRecord, ProjectRecord } from "@/lib/realestate";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const CELL: Record<PlotStatus, string> = {
  available: "border border-ink bg-white text-ink",
  hold: "border border-[#E9B9D2] bg-[#FBE3EF] text-ink",
  booked: "border border-lilac bg-[#E6DEFF] text-ink",
  sold: "border border-ink bg-ink text-white",
};
const PILL: Record<PlotStatus, PillTone> = { available: "success", hold: "warning", booked: "info", sold: "neutral" };
const STATUS_LABEL = Object.fromEntries(PLOT_STATUSES.map((s) => [s.key, s.label])) as Record<PlotStatus, string>;

function PlotPanel({ plot, canBuild }: { plot: PlotRecord; canBuild: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ sizeSqft: plot.sizeSqft?.toString() ?? "", dims: plot.dims, facing: plot.facing, priceLakh: plot.priceLakh?.toString() ?? "", approval: plot.approval, corner: plot.corner });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: "sizeSqft" | "dims" | "facing" | "priceLakh" | "approval") => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(extra: Partial<{ status: PlotStatus }> = {}) {
    setBusy(true);
    setMsg("");
    setErrors({});
    const res = await fetch(`/api/plots/${plot.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, status: plot.status, ...extra }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setEditing(false);
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg("We couldn't save that. Please try again.");
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save();
  };

  const facts: [string, string][] = [
    ["Size", plot.sizeSqft ? `${plot.sizeSqft.toLocaleString("en-IN")} sq ft` : "—"],
    ["Facing", plot.facing || "—"],
    ["Dimensions", plot.dims || "—"],
    ["Price", priceText(plot.priceLakh)],
    ["Approval", plot.approval || "—"],
    ["Corner", plot.corner ? "Yes" : "No"],
  ];

  return (
    <Card className="flex-[1_1_320px]">
      <CardHeader>
        <div>
          <div className="k">Selected</div>
          <h2 className="mb-0 mt-1 text-xl font-semibold">{`Plot ${plot.number}`}</h2>
        </div>
        <Pill tone={PILL[plot.status]}>{STATUS_LABEL[plot.status].toUpperCase()}</Pill>
      </CardHeader>
      {editing ? (
        <form onSubmit={onSubmit} noValidate aria-label={`Edit plot ${plot.number}`} className="flex flex-col gap-3 border-b border-line-soft p-[18px]">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Size (sq ft)" inputMode="numeric" value={v.sizeSqft} onChange={set("sizeSqft")} error={errors.sizeSqft} labelClassName={label} className={control} />
            <Select label="Facing" value={v.facing} onChange={set("facing")} error={errors.facing} labelClassName={label} className={control}>
              <option value="">Not set</option>
              {FACINGS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
            <Input label="Dimensions" value={v.dims} onChange={set("dims")} placeholder="30 × 40 ft" labelClassName={label} className={control} />
            <Input label="Price (lakh ₹)" inputMode="decimal" value={v.priceLakh} onChange={set("priceLakh")} error={errors.priceLakh} placeholder="42.5" labelClassName={label} className={control} />
            <Input label="Approval" value={v.approval} onChange={set("approval")} placeholder="DTCP" labelClassName={label} className={control} />
          </div>
          <Toggle label="Corner plot" checked={v.corner} onCheckedChange={(a) => setV((x) => ({ ...x, corner: a }))} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Save plot"}
            </Button>
            <Button size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="m-0 grid grid-cols-2 gap-3 border-b border-line-soft p-[18px]">
          {facts.map(([k, val]) => (
            <div key={k}>
              <dt className="k">{k}</dt>
              <dd className="m-0 mt-1 text-[15px] font-semibold">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-col gap-1.5 border-b border-line-soft p-[18px] text-sm">
        <div>
          <b>{plot.scans}</b> scans · <b>{plot.enquiries}</b> enquiries
        </div>
        {plot.shortCode ? <div className="tabular text-[11px] text-muted">{`/q/${plot.shortCode}`}</div> : <div className="text-xs text-muted">No QR code yet for this plot.</div>}
        {canBuild ? (
          <Link href={`/app/studio?type=plot&ref=${plot.id}`} className="w-fit text-[13px] font-semibold underline underline-offset-2">
            {plot.qrCodes ? "Create another QR for this plot" : "Create a QR for this plot"}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2 p-[18px]">
        <Select label="Status" value={plot.status} onChange={(e) => void save({ status: e.target.value as PlotStatus })} wrapperClassName="min-w-[150px] flex-1" labelClassName={label} className={control}>
          {PLOT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button size="sm" aria-label={`Edit plot ${plot.number}`} onClick={() => setEditing(true)} className="mb-0.5">
          Edit
        </Button>
        {plot.status === "available" ? (
          <Button size="sm" variant="primary" onClick={() => void save({ status: "hold" })} disabled={busy} className="mb-0.5">
            Mark on hold
          </Button>
        ) : null}
      </div>
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pb-3 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
    </Card>
  );
}

/** The layout map: every plot as a button coloured by status, and the selected plot's details beside it. */
export function PlotBoard({ project, plots, initialNumber, canBuild = true }: { project: ProjectRecord; plots: PlotRecord[]; initialNumber: number | null; canBuild?: boolean }) {
  const [selected, setSelected] = useState<string | null>(plots.find((p) => p.number === initialNumber)?.id ?? plots[0]?.id ?? null);
  const plot = plots.find((p) => p.id === selected) ?? plots[0] ?? null;

  const rows: PlotRecord[][] = [];
  for (let i = 0; i < plots.length; i += project.columns) rows.push(plots.slice(i, i + project.columns));
  const legend: { s: PlotStatus; text: string }[] = PLOT_STATUSES.map((s) => ({ s: s.key, text: s.label }));

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex-[2_1_560px]">
        <CardHeader>
          <h2 className="m-0 text-[15px] font-semibold">Layout map</h2>
          <ul className="m-0 flex list-none flex-wrap gap-3.5 p-0">
            {legend.map((l) => (
              <li key={l.s} className="flex items-center gap-1.5 text-xs">
                <span aria-hidden="true" className={cn("h-3 w-3 rounded-[3px]", CELL[l.s])} />
                {l.text}
              </li>
            ))}
          </ul>
        </CardHeader>
        <div className="overflow-x-auto p-5">
          <div className="flex min-w-[620px] flex-col gap-2">
            {rows.map((row, ri) => (
              <div key={ri} className="flex flex-col gap-2">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${project.columns}, minmax(0, 1fr))` }}>
                  {row.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-plot={p.id}
                      data-number={p.number}
                      aria-label={`Plot ${p.number}, ${STATUS_LABEL[p.status].toLowerCase()}`}
                      aria-pressed={plot?.id === p.id}
                      onClick={() => setSelected(p.id)}
                      className={cn("aspect-[1.25] cursor-pointer rounded-lg text-xs font-semibold", CELL[p.status], plot?.id === p.id && "ring-[3px] ring-ink ring-offset-2")}
                    >
                      {p.number}
                    </button>
                  ))}
                </div>
                {project.roadAfter.includes(ri + 1) ? (
                  <div role="presentation" className="tabular flex h-7 items-center justify-center rounded-md bg-mist text-[11px] tracking-[0.1em] text-muted">
                    ROAD
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Card>
      {plot ? <PlotPanel key={plot.id + plot.status} plot={plot} canBuild={canBuild} /> : null}
    </div>
  );
}

