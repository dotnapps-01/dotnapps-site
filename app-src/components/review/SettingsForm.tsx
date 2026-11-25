"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { LANGS, type Lang } from "@/lib/review-i18n";
import type { ReviewSettings } from "@/lib/review-settings";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

/** Rating page settings (design/Reviews.dc.html). */
export function SettingsForm({ initial }: { initial: ReviewSettings }) {
  const router = useRouter();
  const [question, setQuestion] = useState(initial.question);
  const [chips, setChips] = useState(initial.chips.join(", "));
  const [languages, setLanguages] = useState<Lang[]>(initial.languages);
  const [phone, setPhone] = useState(initial.managerPhone);
  const [suggest, setSuggest] = useState(initial.suggestText);
  const [links, setLinks] = useState([initial.links[0] ?? { label: "", url: "" }, initial.links[1] ?? { label: "", url: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/review/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, chips, languages, managerPhone: phone, suggestText: suggest, links }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setErrors({});
        setStatus({ tone: "ok", text: "Saved. Your rating pages use these settings now." });
        router.refresh();
      } else if (res.status === 422 && j.fields) {
        setErrors(j.fields);
        setStatus({ tone: "error", text: "Please fix the highlighted fields." });
      } else setStatus({ tone: "error", text: "We couldn't save that. Please try again." });
    } catch {
      setStatus({ tone: "error", text: "We couldn't reach the server. Please try again." });
    }
    setBusy(false);
  }

  const toggleLang = (l: Lang) => setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Rating page settings">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 p-5">
        <Input label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} error={errors.question} hint="Shown in English, Tamil and Hindi only when left as the default." labelClassName={label} className={control} />
        <Input label="Chips customers can tap" value={chips} onChange={(e) => setChips(e.target.value)} error={errors.chips} hint="Separated by commas, up to 8." labelClassName={label} className={control} />
        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className={`${label} mb-1.5 p-0`}>Languages</legend>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <label key={l.key} className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-line px-3 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-mist">
                <input type="checkbox" checked={languages.includes(l.key)} onChange={() => toggleLang(l.key)} className="h-4 w-4 accent-ink" />
                <span lang={l.key}>{l.native}</span>
              </label>
            ))}
          </div>
          {errors.languages ? <p className="m-0 text-xs text-danger-fg">{errors.languages}</p> : null}
        </fieldset>
        <Input
          label="Private feedback goes to"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 manager's WhatsApp"
          error={errors.managerPhone}
          hint="Saved for WhatsApp alerts, which arrive with Tickets. Until then, read feedback in the inbox."
          labelClassName={label}
          className={control}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 px-5 pb-5">
        {links.map((l, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Input
              label={`Thank-you button ${i + 1} label`}
              value={l.label}
              onChange={(e) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              placeholder={i === 0 ? "See the menu" : "Follow on Instagram"}
              error={errors[`links.${i}.label`]}
              labelClassName={label}
              className={control}
            />
            <Input
              label={`Thank-you button ${i + 1} link`}
              value={l.url}
              onChange={(e) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://"
              error={errors[`links.${i}.url`]}
              labelClassName={label}
              className={control}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pb-5">
        {[
          { t: "Always show “Post on Google” to every rating", d: "Required by Google review policy. Locked on.", on: true, locked: true },
          { t: "Suggested review text", d: "Draft wording from the chips a customer taps. They can edit it freely.", on: suggest, set: setSuggest },
          { t: "Auto-create ticket for private feedback", d: "Assign to the location manager with a 2h SLA. Arrives with Tickets (Phase 7).", on: false, locked: true, soon: true },
          { t: "AI reply drafts for Google reviews", d: "Needs Google Business Profile connected. You would approve every reply.", on: false, locked: true, soon: true },
        ].map((o) => (
          <div key={o.t} className="flex items-center justify-between gap-3 border border-line-soft px-3.5 py-3">
            <div>
              <div className="text-[13.5px] font-semibold">
                {o.t} {o.soon ? <span className="tabular ml-1 text-[10px] font-normal text-muted">SOON</span> : null}
              </div>
              <div className="text-xs text-muted">{o.d}</div>
            </div>
            <Toggle aria-label={o.t} checked={o.on} disabled={o.locked} onCheckedChange={o.set} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
        <Link href="/r/preview" target="_blank" className={buttonClasses()}>
          Open preview
        </Link>
        {status ? (
          <p role={status.tone === "error" ? "alert" : "status"} className={status.tone === "error" ? "m-0 text-sm text-danger-fg" : "m-0 text-sm text-success-fg"}>
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
