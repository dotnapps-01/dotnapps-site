"use client";

import { useState, type FormEvent } from "react";
import { ENQUIRY_ASKS, VISIT_SLOTS, addDays } from "@/lib/ops-input";
import { O, fmtDay } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, chip, displayH, outlineBtn, postJson, primaryBtn } from "@/components/engage/chrome";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { Honeypot, Row, Success, input } from "./parts";

export type PlotData = {
  number: number; sizeSqft: number | null; dims: string; facing: string; price: string; priceSet: boolean; approval: string; corner: boolean; status: "available" | "hold" | "booked" | "sold";
  project: string; brochureUrl: string; whatsapp: string;
};
const TONE = { available: "success", hold: "warning", booked: "info", sold: "neutral" } as const;

/** What a buyer sees after scanning a plot stone, with a form to ask about it. */
export function PlotView({ code, business, location, initialLang, plot, today }: { code: string; business: string; location: string; initialLang: Lang; plot: PlotData; today: string }) {
  const [lang, setLang] = useState(initialLang);
  const t = O[lang].plot;
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<string>(plot.status === "sold" ? "other" : "visit");
  const [slot, setSlot] = useState("");
  const [v, setV] = useState({ name: "", phone: "", visitOn: addDays(today, 1), website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/s/plot", { code, name: v.name, phone: v.phone, ask, visitOn: ask === "visit" ? v.visitOn : "", visitSlot: ask === "visit" ? slot : "", website: v.website });
    setBusy(false);
    if (r.ok) return setDone(true);
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.status === 429 ? O[lang].tooMany : O[lang].error);
  }

  const wa = plot.whatsapp ? `https://wa.me/${plot.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I scanned the QR for Plot ${plot.number} at ${plot.project}.`)}` : "";
  const facts: [string, string][] = [
    plot.sizeSqft ? [t.size, t.sqft(plot.sizeSqft)] : null,
    plot.dims ? [t.dims, plot.dims] : null,
    plot.facing ? [t.facing, plot.facing] : null,
    [t.price, plot.price],
    plot.approval ? [t.approval, plot.approval] : null,
    [t.corner, plot.corner ? t.yes : t.no],
  ].filter(Boolean) as [string, string][];

  return (
    <Shell business={plot.project || business} location={location} lang={lang} onLang={setLang}>
      {done ? (
        <Success lang={lang} title={t.thanks} />
      ) : (
        <>
          <div className="rounded-[22px] bg-marble p-5">
            <div className="flex items-center justify-between gap-2">
              <h1 className={cn(displayH(lang), "text-[26px]")}>{t.title(plot.number)}</h1>
              <Pill tone={TONE[plot.status]}>{t.status[plot.status].toUpperCase()}</Pill>
            </div>
            {plot.approval ? <p className="mx-0 mb-0 mt-1.5 text-sm text-graphite">{plot.approval}</p> : null}
          </div>
          {plot.status === "sold" ? (
            <p role="status" className="m-0 rounded-2xl bg-paper p-3.5 text-sm text-graphite">
              {t.noLonger}
            </p>
          ) : null}
          <dl className="m-0 grid grid-cols-2 gap-3 rounded-[18px] border border-line bg-white p-4">
            {facts.map(([k, val]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="m-0 mt-0.5 text-[15px] font-semibold">{val}</dd>
              </div>
            ))}
          </dl>
          {!open ? (
            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
                {t.visit}
              </button>
              {plot.brochureUrl ? (
                <a href={plot.brochureUrl} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
                  {t.brochure}
                </a>
              ) : null}
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
                  {t.whatsapp}
                </a>
              ) : null}
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-label={t.formTitle} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-4">
              <h2 className="m-0 font-sans text-base font-semibold">{t.formTitle}</h2>
              <div className="flex flex-col gap-1.5">
                <span id="pl-ask" className="text-[13px] font-semibold">
                  {t.ask}
                </span>
                <div role="group" aria-labelledby="pl-ask" className="flex flex-wrap gap-2">
                  {ENQUIRY_ASKS.map((a) => (
                    <button key={a.key} type="button" aria-pressed={ask === a.key} onClick={() => setAsk(a.key)} className={chip(ask === a.key)}>
                      {t.asks[a.key]}
                    </button>
                  ))}
                </div>
                <ErrorText>{errors.ask}</ErrorText>
              </div>
              {ask === "visit" ? (
                <>
                  <Row id="pl-date" label={t.visitDate} error={errors.visitOn}>
                    <select id="pl-date" value={v.visitOn} onChange={set("visitOn")} className={input(errors.visitOn)}>
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {fmtDay(lang, `${d}T06:30:00Z`)}
                        </option>
                      ))}
                    </select>
                  </Row>
                  <div role="group" aria-label={t.visitDate} className="flex flex-wrap gap-2">
                    {VISIT_SLOTS.map((s) => (
                      <button key={s.key} type="button" aria-pressed={slot === s.key} onClick={() => setSlot(slot === s.key ? "" : s.key)} className={chip(slot === s.key)}>
                        {t.slots[s.key]}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <Row id="pl-name" label={t.name} error={errors.name}>
                <input id="pl-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={input(errors.name)} />
              </Row>
              <Row id="pl-phone" label={t.phone} error={errors.phone}>
                <input id="pl-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
              </Row>
              <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy ? t.sending : t.send}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={outlineBtn}>
                {t.cancel}
              </button>
              <ErrorText>{error}</ErrorText>
            </form>
          )}
        </>
      )}
    </Shell>
  );
}
