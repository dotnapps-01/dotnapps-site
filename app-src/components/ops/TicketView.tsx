"use client";

import { useState, type FormEvent } from "react";
import { ASSET_PROBLEMS, PROBLEM_CHIPS } from "@/lib/ops-input";
import { O, fmtDay } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, chip, fieldCls, outlineBtn, postJson, primaryBtn } from "@/components/engage/chrome";
import { cn } from "@/lib/cn";
import { Hero, Honeypot, Row, Success, input } from "./parts";

type Asset = { code: string; name: string; place: string; lastService: string | null };

/** A customer reports a problem from a Feedback → ticket code or an Asset service code. */
export function TicketView({ code, business, location, initialLang, place, asset }: { code: string; business: string; location: string; initialLang: Lang; place: string; asset: Asset | null }) {
  const [lang, setLang] = useState(initialLang);
  const [problem, setProblem] = useState("");
  const [v, setV] = useState({ details: "", name: "", phone: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ seq: number; token: string } | null>(null);
  const t = O[lang];
  const chips = asset ? ASSET_PROBLEMS : PROBLEM_CHIPS;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/s/ticket", { code, problem, ...v });
    setBusy(false);
    if (r.ok && r.data.token) return setDone({ seq: r.data.seq, token: r.data.token });
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.status === 429 ? t.tooMany : t.error);
  }

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      {done ? (
        <Success lang={lang} title={t.ticket.doneTitle(done.seq)} body={t.ticket.doneBody}>
          <a href={`/o/${done.token}?lang=${lang}`} className={cn(outlineBtn, "max-w-xs")}>
            {t.ticket.view}
          </a>
        </Success>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <Hero lang={lang} title={asset ? asset.name : t.ticket.title} sub={asset ? [asset.code, asset.place].filter(Boolean).join(" · ") : place ? t.ticket.place(place) : undefined} />
          {asset?.lastService ? <p className="m-0 text-xs text-muted">{t.ticket.lastServiced(fmtDay(lang, `${asset.lastService}T06:00:00Z`))}</p> : null}
          <div className="flex flex-col gap-1.5">
            <span id="tk-what" className="text-[13px] font-semibold">
              {t.ticket.what}
            </span>
            <div role="group" aria-labelledby="tk-what" className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} type="button" aria-pressed={problem === c} onClick={() => setProblem(problem === c ? "" : c)} className={chip(problem === c)}>
                  {t.ticket.problems[c] ?? c}
                </button>
              ))}
            </div>
            <ErrorText>{errors.problem}</ErrorText>
          </div>
          <Row id="tk-details" label={t.ticket.details} hint={t.ticket.detailsHint} error={errors.details}>
            <textarea id="tk-details" rows={3} maxLength={600} value={v.details} onChange={set("details")} aria-invalid={errors.details ? true : undefined} className={cn(input(errors.details), "min-h-[84px] py-3")} />
          </Row>
          <Row id="tk-name" label={t.ticket.name}>
            <input id="tk-name" autoComplete="name" value={v.name} onChange={set("name")} className={fieldCls} />
          </Row>
          <Row id="tk-phone" label={t.ticket.phone} hint={t.ticket.phoneHint} error={errors.phone}>
            <input id="tk-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
          </Row>
          <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? t.ticket.sending : t.ticket.submit}
          </button>
          <ErrorText>{error}</ErrorText>
        </form>
      )}
    </Shell>
  );
}
