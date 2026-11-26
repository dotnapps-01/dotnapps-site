"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { E } from "@/lib/engage-i18n";
import { cn } from "@/lib/cn";
import type { FormRecord } from "@/lib/engage";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, chip, displayH, fieldCls, postJson, primaryBtn } from "./chrome";

/** A lead form built in Leads. Submissions become leads and contacts. */
export function LeadFormView({ code, business, location, form, initialLang }: { code: string; business: string; location: string; form: Pick<FormRecord, "title" | "intro" | "fields" | "interests" | "submitLabel">; initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const [v, setV] = useState({ name: "", phone: "", email: "", interest: "", time: "", message: "", website: "" });
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const t = E[lang].lead;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await postJson("/api/s/lead", { code, ...v, optIn });
    setBusy(false);
    if (r.ok) return setDone(true);
    if (r.status === 422 && r.data.fields) {
      setErrors(r.data.fields);
      setError(t.required);
    } else setError(t.error);
  }

  const label = (id: string, text: string) => (
    <label htmlFor={id} className="text-[13px] font-semibold">
      {text}
    </label>
  );

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      {done ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center" role="status">
          <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-bg">
            <Check size={36} strokeWidth={1.8} className="text-success-fg" />
          </div>
          <h1 className={cn(displayH(lang), "text-[26px]")}>{t.thanksTitle}</h1>
          <p className="m-0 text-sm text-graphite">{t.thanksBody}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <div className="rounded-[22px] bg-marble p-5">
            <h1 className={cn(displayH(lang), "text-[26px]")}>{form.title}</h1>
            {form.intro ? <p className="mx-0 mb-0 mt-1.5 text-sm text-graphite">{form.intro}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            {label("lf-name", t.name)}
            <input id="lf-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={cn(fieldCls, errors.name && "border-danger-fg")} />
            <ErrorText>{errors.name}</ErrorText>
          </div>
          <div className="flex flex-col gap-1.5">
            {label("lf-phone", t.phone)}
            <input id="lf-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={cn(fieldCls, errors.phone && "border-danger-fg")} />
            <ErrorText>{errors.phone}</ErrorText>
          </div>
          {form.fields.includes("email") ? (
            <div className="flex flex-col gap-1.5">
              {label("lf-email", t.email)}
              <input id="lf-email" type="email" autoComplete="email" value={v.email} onChange={set("email")} aria-invalid={errors.email ? true : undefined} className={cn(fieldCls, errors.email && "border-danger-fg")} />
              <ErrorText>{errors.email}</ErrorText>
            </div>
          ) : null}
          {form.fields.includes("interest") && form.interests.length ? (
            <div className="flex flex-col gap-1.5">
              <span id="lf-int" className="text-[13px] font-semibold">
                {t.interest}
              </span>
              <div role="group" aria-labelledby="lf-int" className="flex flex-wrap gap-2">
                {form.interests.map((i) => (
                  <button key={i} type="button" aria-pressed={v.interest === i} onClick={() => setV((x) => ({ ...x, interest: x.interest === i ? "" : i }))} className={chip(v.interest === i)}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {form.fields.includes("time") ? (
            <div className="flex flex-col gap-1.5">
              {label("lf-time", t.time)}
              <input id="lf-time" value={v.time} onChange={set("time")} className={fieldCls} />
            </div>
          ) : null}
          {form.fields.includes("message") ? (
            <div className="flex flex-col gap-1.5">
              {label("lf-msg", t.message)}
              <textarea id="lf-msg" rows={3} maxLength={500} value={v.message} onChange={set("message")} className={cn(fieldCls, "min-h-[84px] py-3")} />
            </div>
          ) : null}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
            </label>
          </div>
          <label className="flex items-start gap-2.5 text-[13px] text-graphite">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
            {t.optIn}
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? t.sending : form.submitLabel}
          </button>
          <ErrorText>{error}</ErrorText>
          <p className="m-0 text-center text-xs text-muted">{t.consent}</p>
        </form>
      )}
    </Shell>
  );
}
