"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PathIcon } from "@/components/marketing/parts";
import { QRFramed } from "@/components/qr/QRFramed";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { fileSafe, framedPng, framedSvgString, saveBlob } from "@/lib/qr-export";
import type { QrRecord } from "@/lib/qr-repo";
import {
  MIN_QR_CONTRAST,
  contrastRatio,
  defaultDesign,
  defaultLabelFor,
  designColors,
  designVariants,
  destinationFor,
  frameLabels,
  parseQrInput,
  qrGroups,
  qrTypes,
  qrValue,
  typeByKey,
  type QrDesign,
} from "@/lib/qr-types";

type Props = {
  mode: "create" | "edit";
  initial?: QrRecord;
  /** pre-selected type for a new code (from ?type=) */
  initialType?: string;
  /** pre-selected page / form / coupon for the type's reference field (from ?ref=) */
  initialRef?: string;
  /** the workspace's own records the reference fields can point at */
  refs: Record<string, { id: string; name: string }[]>;
  locations: { id: string; name: string }[];
  folders: { id: string; name: string }[];
  shortBase: string;
  shortLabel: string;
  suggestedCode: string;
  dynamicUsed: number;
  /** null = unlimited */
  dynamicLimit: number | null;
  planName: string;
};

const STEPS = ["Type", "Content", "Design", "Download"] as const;
const REF_LINK: Record<string, string> = { "page:menu": "/app/pages", "page:card": "/app/pages", "page:bio": "/app/pages", form: "/app/leads?tab=forms", coupon: "/app/offers", loyalty: "/app/offers?tab=loyalty" };
const REF_LINK_LABEL: Record<string, string> = { "page:menu": "Create or publish a menu", "page:card": "Create or publish a card", "page:bio": "Create or publish a link page", form: "Create a form", coupon: "Create an offer", loyalty: "Set up your programme" };
const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const stepOfField = (k: string) => (k === "type" ? 0 : k === "design" ? 2 : 1);

type Banner = { tone: "success" | "error"; text: string; upgrade?: boolean };

export function StudioWizard({ mode, initial, initialType, initialRef, refs, locations, folders, shortBase, shortLabel, suggestedCode, dynamicUsed, dynamicLimit, planName }: Props) {
  const router = useRouter();
  const editing = mode === "edit";
  const [step, setStep] = useState(editing || initialType ? 1 : 0);
  const [type, setType] = useState(initial?.type ?? initialType ?? "url");
  const [name, setName] = useState(initial?.name ?? "");
  const [nameTouched, setNameTouched] = useState(Boolean(initial));
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [folderId, setFolderId] = useState(initial?.folderId ?? "");
  const [config, setConfig] = useState<Record<string, string>>(() => {
    if (initial) return initial.config;
    const first = typeByKey(initialType ?? "")?.fields.find((f) => f.kind === "ref");
    if (initialType === "loyalty" && refs.loyalty?.length) return { program: "program" };
    return first && initialRef ? { [first.key]: initialRef } : {};
  });
  const [dynamic, setDynamic] = useState(initial?.dynamic ?? true);
  const [shortCode, setShortCode] = useState(initial?.shortCode ?? "");
  const [scheduled, setScheduled] = useState(Boolean(initial?.startsAt || initial?.endsAt));
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [designState, setDesign] = useState<QrDesign>(initial?.design ?? defaultDesign);
  const [labelTouched, setLabelTouched] = useState(Boolean(initial));
  // the frame label follows the type until the person picks one themselves
  const design: QrDesign = labelTouched ? designState : { ...designState, label: defaultLabelFor(type) };
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: string; shortCode: string | null; status: string } | null>(
    initial ? { id: initial.id, shortCode: initial.shortCode, status: initial.status } : null,
  );
  const [slugNote, setSlugNote] = useState<{ ok: boolean; text: string } | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  /** Step navigation by the person (not by a failed save): drop any stale error banner. */
  const go = (next: number | ((s: number) => number)) => {
    setStep(next);
    setBanner((b) => (b?.tone === "error" ? null : b));
  };

  const def = typeByKey(type)!;
  const isDynamic = def.dynamicOnly ? true : def.staticOnly ? false : dynamic;
  const locName = locations.find((l) => l.id === locationId)?.name ?? "All locations";

  // the name follows the type and location until the person types their own
  const shownName = nameTouched ? name : `${def.label} — ${locName}`;

  // is the chosen short link free? (debounced)
  useEffect(() => {
    if (editing || !isDynamic || !shortCode) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/qr/slug?slug=${encodeURIComponent(shortCode)}`);
        const j = await r.json();
        setSlugNote(j.available ? { ok: true, text: "Available" } : { ok: false, text: j.error ?? "Not available" });
      } catch {
        setSlugNote(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [shortCode, editing, isDynamic]);

  const activeCode = saved?.shortCode ?? (shortCode || suggestedCode);
  const previewValue = useMemo(() => {
    const v = qrValue({ dynamic: isDynamic, shortCode: activeCode, type, config }, shortBase);
    return v || `${shortBase}/preview`;
  }, [isDynamic, activeCode, type, config, shortBase]);
  const complete = parseQrInput({ name: shownName, type, config, design, dynamic: isDynamic }, true).ok;

  const ratio = contrastRatio(design.color);
  const scanOk = ratio >= MIN_QR_CONTRAST;
  const scanText = ratio >= 7 ? "Excellent" : scanOk ? "Good" : "Too low";

  const limitNote =
    dynamicLimit === null ? null : `${planName} plan: ${Math.min(dynamicUsed, dynamicLimit)} of ${dynamicLimit} dynamic codes used. Static codes are unlimited.`;

  const destHost = (() => {
    const d = isDynamic ? destinationFor(type, config) : null;
    try {
      return d ? new URL(d).hostname : null;
    } catch {
      return null;
    }
  })();

  async function save(publish: boolean) {
    setBusy(true);
    setBanner(null);
    const body = {
      name: shownName,
      type,
      dynamic: isDynamic,
      locationId: locationId || null,
      folderId: folderId || null,
      config,
      design,
      shortCode: isDynamic && !editing && !saved ? shortCode || undefined : undefined,
      startsAt: scheduled ? fromLocalInput(startsAt) : null,
      endsAt: scheduled ? fromLocalInput(endsAt) : null,
      publish,
    };
    try {
      const res = await fetch(saved ? `/api/qr/${saved.id}` : "/api/qr", {
        method: saved ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setErrors({});
        setSaved({ id: j.id, shortCode: j.shortCode, status: j.status });
        setBanner({
          tone: "success",
          text: j.status === "active" ? (j.shortCode ? `Published. Your short link is ${shortLabel}/${j.shortCode}.` : "Published. Your static code is ready to download.") : "Draft saved. It won't open until you publish it.",
        });
        if (publish) setStep(3);
      } else if (res.status === 422 && j.fields) {
        setErrors(j.fields);
        const first = Object.keys(j.fields)[0];
        setStep(stepOfField(first));
        setBanner({ tone: "error", text: "Please fix the highlighted fields." });
      } else if (res.status === 403 && j.error === "plan_limit") {
        setBanner({ tone: "error", text: `Your ${planName} plan includes ${j.limit} dynamic QR codes. Make this one static, or upgrade for more.`, upgrade: true });
      } else if (res.status === 409) {
        setErrors({ shortCode: "That short link is taken." });
        setStep(1);
        setBanner({ tone: "error", text: "Pick a different short link." });
      } else if (res.status === 401) {
        router.push("/login");
        return;
      } else {
        setBanner({ tone: "error", text: "We couldn't save that. Please try again." });
      }
    } catch {
      setBanner({ tone: "error", text: "We couldn't reach the server. Check your connection and try again." });
    }
    setBusy(false);
    requestAnimationFrame(() => bannerRef.current?.focus());
  }

  async function download(kind: "png" | "svg") {
    const file = fileSafe(shownName);
    if (kind === "png") saveBlob(await framedPng(previewValue, design), `${file}.png`);
    else saveBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${framedSvgString(previewValue, design)}`], { type: "image/svg+xml" }), `${file}.svg`);
  }

  const err = (k: string) => errors[k];
  const showSave = !editing || saved?.status === "draft";

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-[clamp(16px,2.4vw,32px)] py-3.5">
        <div>
          <div className="k">QR codes / {editing ? "Edit" : "Create"}</div>
          <h1 className="mb-0 mt-0.5 font-display text-2xl font-semibold tracking-display">{editing ? "Edit QR code" : "Create a QR code"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/library" className={buttonClasses()}>
            {saved ? "Back to library" : "Cancel"}
          </Link>
          {showSave ? (
            <Button onClick={() => save(false)} disabled={busy}>
              Save draft
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => save(true)} disabled={busy}>
            {editing && saved?.status !== "draft" ? "Save changes" : "Save & publish"}
          </Button>
        </div>
      </header>

      <nav aria-label="Steps" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {STEPS.map((t, i) => (
          <button
            key={t}
            type="button"
            aria-current={i === step ? "step" : undefined}
            onClick={() => go(i)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px]",
              i === step ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink",
            )}
          >
            <span className="tabular text-[11px] text-ink">0{i + 1}</span>
            {t}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-5 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2.4vw,28px)]">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          {banner ? (
            <div
              ref={bannerRef}
              tabIndex={-1}
              role={banner.tone === "error" ? "alert" : "status"}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-input px-4 py-3 text-sm outline-none",
                banner.tone === "error" ? "bg-danger-bg text-danger-fg" : "bg-success-bg text-success-fg",
              )}
            >
              <span>{banner.text}</span>
              {banner.upgrade ? (
                <Link href="/app/settings" className="font-semibold underline underline-offset-2">
                  See plans
                </Link>
              ) : null}
            </div>
          ) : null}

          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What should the scan do?</CardTitle>
                <Input label="Filter types" hideLabel type="search" placeholder="Search types" value={query} onChange={(e) => setQuery(e.target.value)} wrapperClassName="w-[200px] max-w-full" className={control} />
              </CardHeader>
              <div className="flex flex-col gap-[18px] p-[18px]">
                {err("type") ? (
                  <p role="alert" className="m-0 text-sm text-danger-fg">
                    {err("type")}
                  </p>
                ) : null}
                {qrGroups.map((g) => {
                  const types = qrTypes.filter((t) => t.group === g.key && t.label.toLowerCase().includes(query.trim().toLowerCase()));
                  if (types.length === 0) return null;
                  return (
                    <div key={g.key} className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="k">{g.key}</span>
                        <Pill tone={g.tone === "info" ? "info" : "neutral"} className={g.tone === "ink" ? "bg-ink text-white" : undefined}>
                          {g.plan}
                        </Pill>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                        {types.map((t) => {
                          const on = t.key === type;
                          const locked = editing && !on;
                          const off = !t.live || locked;
                          return (
                            <button
                              key={t.key}
                              type="button"
                              aria-pressed={on}
                              disabled={off}
                              onClick={() => {
                                setType(t.key);
                                setConfig(t.key === "loyalty" && refs.loyalty?.length ? { program: "program" } : {});
                                setErrors({});
                              }}
                              className={cn(
                                "box-border flex min-h-[84px] flex-col items-start gap-2 p-3 text-left text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-55",
                                on ? "border-2 border-ink bg-info-bg" : "border border-line bg-white enabled:hover:bg-paper",
                              )}
                            >
                              <PathIcon d={t.icon} size={20} />
                              <span className="text-[13px] font-semibold">{t.label}</span>
                              {!t.live ? <span className="tabular text-[10px] text-muted">SOON · PHASE {t.phase}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {qrTypes.every((t) => !t.label.toLowerCase().includes(query.trim().toLowerCase())) ? (
                  <p className="m-0 text-sm text-muted">No types match &ldquo;{query}&rdquo;.</p>
                ) : null}
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{def.label} · content</CardTitle>
                <Pill tone={isDynamic ? "info" : "neutral"}>{isDynamic ? "DYNAMIC" : "STATIC"}</Pill>
              </CardHeader>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 p-5">
                <Input
                  label="QR name (internal)"
                  value={shownName}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameTouched(true);
                  }}
                  error={err("name")}
                  labelClassName={label}
                  className={control}
                />
                <Select label="Location" value={locationId} onChange={(e) => setLocationId(e.target.value)} labelClassName={label} className={control}>
                  <option value="">All locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                {def.fields.map((f) =>
                  f.kind === "ref" ? (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      {(refs[f.ref ?? ""] ?? []).length > 0 ? (
                        <Select
                          label={f.label}
                          value={config[f.key] ?? ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                          error={err(`config.${f.key}`)}
                          labelClassName={label}
                          className={control}
                        >
                          <option value="">{f.placeholder}</option>
                          {refs[f.ref ?? ""].map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <>
                          <span className={label}>{f.label}</span>
                          <p role={err(`config.${f.key}`) ? "alert" : undefined} className={cn("m-0 border border-dashed border-track bg-paper px-3 py-2.5 text-sm", err(`config.${f.key}`) ? "text-danger-fg" : "text-graphite")}>
                            {err(`config.${f.key}`) ?? "You haven't created one yet."}{" "}
                            <Link href={REF_LINK[f.ref ?? ""] ?? "/app/pages"} className="font-semibold underline underline-offset-2">
                              {REF_LINK_LABEL[f.ref ?? ""] ?? "Create one"}
                            </Link>
                          </p>
                        </>
                      )}
                    </div>
                  ) : f.kind === "select" ? (
                    <Select
                      key={f.key}
                      label={f.label}
                      value={config[f.key] ?? f.options?.[0] ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                      labelClassName={label}
                      className={control}
                    >
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      key={f.key}
                      label={f.label}
                      type={f.kind === "password" ? "text" : f.kind === "number" ? "text" : (f.kind ?? "text")}
                      inputMode={f.kind === "number" ? "decimal" : undefined}
                      placeholder={f.placeholder}
                      hint={f.hint}
                      value={config[f.key] ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                      error={err(`config.${f.key}`)}
                      autoComplete="off"
                      labelClassName={label}
                      className={control}
                    />
                  ),
                )}
                <Select label="Folder" value={folderId} onChange={(e) => setFolderId(e.target.value)} labelClassName={label} className={control}>
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                {isDynamic ? (
                  <Input
                    label="Short link"
                    value={editing || saved ? (saved?.shortCode ?? shortCode) : shortCode}
                    onChange={(e) => setShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder={suggestedCode}
                    readOnly={editing || Boolean(saved)}
                    hint={editing || saved ? "The short link can't change once the code exists, so printed copies keep working." : slugNote ? slugNote.text : `${shortLabel}/… (leave blank for ${suggestedCode})`}
                    error={err("shortCode")}
                    autoComplete="off"
                    labelClassName={label}
                    className={control}
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-3 px-5 pb-5">
                <span className="k">Advanced</span>
                <div className="flex items-center justify-between gap-3 border border-line-soft px-3.5 py-3">
                  <div>
                    <div className="text-[13.5px] font-semibold">Dynamic (editable after print)</div>
                    <div className="text-xs text-muted">
                      {def.staticOnly ? `${def.label} codes are always static: the data is inside the code.` : def.dynamicOnly ? `${def.label} codes are always dynamic: they open a page and count scans.` : (limitNote ?? "Change the destination any time, and count scans.")}
                    </div>
                  </div>
                  <Toggle
                    aria-label="Dynamic (editable after print)"
                    checked={isDynamic}
                    disabled={def.staticOnly || def.dynamicOnly || editing || Boolean(saved)}
                    onCheckedChange={setDynamic}
                  />
                </div>
                <div className="border border-line-soft px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13.5px] font-semibold">Schedule start / end</div>
                      <div className="text-xs text-muted">{isDynamic ? "Auto-pause outside these dates" : "Only dynamic codes can be scheduled"}</div>
                    </div>
                    <Toggle aria-label="Schedule start and end" checked={scheduled && isDynamic} disabled={!isDynamic} onCheckedChange={setScheduled} />
                  </div>
                  {scheduled && isDynamic ? (
                    <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
                      <Input label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} labelClassName={label} className={control} />
                      <Input label="Ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} error={err("endsAt")} labelClassName={label} className={control} />
                    </div>
                  ) : null}
                </div>
                {[
                  { t: "Smart redirect", d: "Different page by time, language or city" },
                  { t: "Password protect", d: "Ask for a PIN before opening" },
                ].map((a) => (
                  <div key={a.t} className="flex items-center justify-between gap-3 border border-line-soft px-3.5 py-3">
                    <div>
                      <div className="text-[13.5px] font-semibold">
                        {a.t} <span className="tabular ml-1 text-[10px] font-normal text-muted">SOON</span>
                      </div>
                      <div className="text-xs text-muted">{a.d}</div>
                    </div>
                    <Toggle aria-label={a.t} disabled />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Design</CardTitle>
                <Button disabled title="Brand kits arrive with Settings">
                  Apply brand kit
                </Button>
              </CardHeader>
              <div className="flex flex-col gap-[22px] p-5">
                {err("design") ? (
                  <p role="alert" className="m-0 text-sm text-danger-fg">
                    {err("design")}
                  </p>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <span className={label} id="lbl-colour">
                    Colour
                  </span>
                  <div role="group" aria-labelledby="lbl-colour" className="flex flex-wrap gap-2.5">
                    {designColors.map((c) => {
                      const on = design.color === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          aria-label={c.name}
                          aria-pressed={on}
                          onClick={() => setDesign((d) => ({ ...d, color: c.value }))}
                          className="h-11 w-11 border border-line p-0"
                          style={{ background: c.value, outline: on ? `2px solid ${c.value}` : undefined, outlineOffset: on ? 2 : undefined, boxShadow: on ? "inset 0 0 0 3px #FAFAFA" : undefined }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={label} id="lbl-dots">
                    Dot style
                  </span>
                  <div role="group" aria-labelledby="lbl-dots" className="flex flex-wrap gap-2.5">
                    {designVariants.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        aria-pressed={design.variant === v.key}
                        onClick={() => setDesign((d) => ({ ...d, variant: v.key }))}
                        className={cn("tabular min-h-11 px-4 text-xs text-ink", design.variant === v.key ? "border-2 border-ink bg-info-bg" : "border border-line bg-white hover:bg-paper")}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={label} id="lbl-frame">
                    Frame label
                  </span>
                  <div role="group" aria-labelledby="lbl-frame" className="flex flex-wrap gap-2.5">
                    {frameLabels.map((l) => (
                      <button
                        key={l || "none"}
                        type="button"
                        aria-pressed={design.label === l}
                        onClick={() => {
                          setDesign((d) => ({ ...d, label: l }));
                          setLabelTouched(true);
                        }}
                        className={cn("tabular min-h-11 px-3.5 text-[11px] text-ink", design.label === l ? "border-2 border-ink bg-info-bg" : "border border-line bg-white hover:bg-paper")}
                      >
                        {l || "NO LABEL"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
                  <div className="flex items-center gap-3 border border-dashed border-track p-3.5">
                    <div className="flex h-10 w-10 flex-none items-center justify-center bg-ink text-xs font-semibold text-white">[B]</div>
                    <div>
                      <div className="text-[13px] font-semibold">Logo in centre</div>
                      <div className="text-xs text-muted">
                        Logo upload arrives with Settings <span className="tabular text-[10px]">SOON</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border border-line-soft p-3.5">
                    <div>
                      <div className="text-[13px] font-semibold">Scannability</div>
                      <div className={cn("text-xs", scanOk ? "text-success-fg" : "text-danger-fg")}>
                        {scanText} · contrast {ratio.toFixed(1)}:1
                      </div>
                    </div>
                    <Pill tone={scanOk ? "success" : "danger"}>{scanOk ? "PASS" : "FAIL"}</Pill>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Download &amp; print</CardTitle>
              </CardHeader>
              {!saved ? (
                <p role="note" className="m-5 mb-0 border border-dashed border-track bg-paper px-3 py-2 text-sm text-graphite">
                  Save your QR code first (Finish, or Save &amp; publish) to unlock the downloads.{" "}
                </p>
              ) : null}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2.5 p-5">
                {[
                  { k: "png", t: "PNG", d: "High-res, 2000 px", ready: true },
                  { k: "svg", t: "SVG", d: "Vector for designers", ready: true },
                  { k: "pdf", t: "PDF", d: "Print-ready with bleed" },
                  { k: "eps", t: "EPS", d: "For print shops" },
                  { k: "tent", t: "Table tent", d: "A6 fold template" },
                  { k: "sheet", t: "Sticker sheet", d: "A4, 12 per sheet" },
                ].map((f) => {
                  const enabled = Boolean(f.ready && saved);
                  return (
                    <button
                      key={f.k}
                      type="button"
                      disabled={!enabled}
                      onClick={() => enabled && download(f.k as "png" | "svg")}
                      className="flex flex-col items-start gap-1 border border-line bg-white p-3.5 text-left text-ink enabled:hover:bg-paper disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="tabular text-[13px] font-medium">{f.t}</span>
                      <span className="text-xs text-muted">{f.ready ? f.d : `${f.d} · soon`}</span>
                    </button>
                  );
                })}
              </div>
              <div className="m-5 mt-0 flex flex-wrap items-center justify-between gap-4 bg-ink p-[18px] text-white">
                <div>
                  <div className="tabular text-[11px] text-lilac">PRINT SHOP</div>
                  <div className="mt-1 text-[15px] font-semibold">Order 20 acrylic table tents</div>
                  <div className="mt-0.5 text-xs text-[#B8B8C0]">Delivered in 3–5 days · from [₹ PRICE]</div>
                </div>
                <Button disabled className="bg-white">
                  Order prints (soon)
                </Button>
              </div>
            </Card>
          )}

          <div className="flex justify-between gap-2.5">
            <Button onClick={() => go((s) => Math.max(0, s - 1))} className={step === 0 ? "invisible" : undefined} tabIndex={step === 0 ? -1 : undefined} aria-hidden={step === 0 || undefined}>
              Back
            </Button>
            {step < 3 ? (
              <Button variant="primary" onClick={() => go((s) => Math.min(3, s + 1))}>
                Next step
              </Button>
            ) : saved ? (
              <Link href="/app/library" className={buttonClasses({ variant: "primary" })}>
                Go to library
              </Link>
            ) : (
              <Button variant="primary" onClick={() => save(true)} disabled={busy}>
                Finish
              </Button>
            )}
          </div>
        </div>

        <aside aria-label="QR code preview" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <span className="tabular text-[11px] text-muted">{def.label}</span>
            </CardHeader>
            <div className="flex flex-col items-center gap-3.5 bg-marble px-5 py-7">
              <QRFramed value={previewValue} variant={design.variant} color={design.color} label={design.label} size={240} title={`Preview of your ${def.label} QR code`} />
              {!complete ? <p className="m-0 rounded-full bg-white px-3 py-1.5 text-xs text-graphite">Preview only until the details are complete</p> : null}
            </div>
            <dl className="m-0 flex flex-col gap-2.5 border-t border-line px-[18px] py-3.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Short link</dt>
                <dd className="tabular m-0 break-all text-right">{isDynamic ? `${shortLabel}/${activeCode}` : "None (static)"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Type</dt>
                <dd className="m-0">{isDynamic ? "Dynamic · editable" : "Static · fixed"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Opens</dt>
                <dd className="m-0 break-all text-right">{destHost ?? (isDynamic ? `${def.label} page` : "Data in the code")}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Test on your phone</CardTitle>
            </CardHeader>
            <div className="px-[18px] py-3.5 text-[13px] leading-[1.5] text-graphite">
              {saved && saved.status === "active" ? (
                <>
                  Scan the preview with your camera
                  {saved.shortCode ? (
                    <>
                      , or{" "}
                      <a href={`${shortBase}/${saved.shortCode}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                        open the short link
                      </a>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "Save & publish, then scan the preview with your camera to test it."
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
