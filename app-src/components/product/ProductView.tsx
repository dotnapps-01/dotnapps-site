"use client";

import { Check, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Honeypot, Row, input } from "@/components/ops/parts";
import { ErrorText, Shell, displayH, outlineBtn, postJson, primaryBtn } from "@/components/engage/chrome";
import { LOCALE } from "@/lib/engage-i18n";
import { PT } from "@/lib/product-i18n";
import type { Lang } from "@/lib/review-i18n";
import { cn } from "@/lib/cn";
import { Pill } from "@/components/ui/Pill";

export type ProductViewProps = {
  token: string;
  business: string;
  serial: string;
  initialLang: Lang;
  today: string;
  madeOn: string;
  product: { name: string; model: string; madeIn: string; manualUrl: string; videosUrl: string; buyUrl: string; serviceEnabled: boolean; warrantyMonths: number };
  warranty: { validUntil: string; status: "verified" | "review" | "rejected" } | null;
  scan: { verdict: "first" | "again" | "scanned_before"; scanCount: number; firstScanAt: string | null; firstCity: string; thisCity: string };
};

type Mode = null | "warranty" | "service" | "report";
const dmy = (lang: Lang, iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** What a buyer sees after scanning a serialized product code: is it genuine, the product hub, warranty, service and a way to report a fake. */
export function ProductView(p: ProductViewProps) {
  const [lang, setLang] = useState(p.initialLang);
  const [mode, setMode] = useState<Mode>(null);
  const [warranty, setWarranty] = useState(p.warranty);
  const t = PT[lang];
  const { scan } = p;
  const warn = scan.verdict === "scanned_before";

  return (
    <Shell business={p.business} location={t.official} lang={lang} onLang={setLang}>
      <section data-verdict={scan.verdict} aria-label={warn ? t.verdict.warnTitle : t.verdict.firstTitle(p.product.name)} className={cn("flex flex-col gap-3 rounded-[22px] p-5", warn ? "bg-warning-bg" : "bg-marble")}>
        <div aria-hidden="true" className={cn("flex h-12 w-12 items-center justify-center rounded-full", warn ? "bg-white text-warning-fg" : "bg-white text-success-fg")}>
          {warn ? <ShieldAlert size={26} strokeWidth={1.8} /> : <Check size={26} strokeWidth={2} />}
        </div>
        <h1 className={cn(displayH(lang), "text-[26px]")}>{warn ? t.verdict.warnTitle : scan.verdict === "first" ? t.verdict.firstTitle(p.product.name) : t.verdict.againTitle(p.product.name)}</h1>
        <p className="m-0 text-sm text-graphite">{warn ? t.verdict.warnBody : scan.verdict === "first" ? t.verdict.firstBody : t.verdict.againBody}</p>
        {warn ? (
          <dl className="m-0 grid grid-cols-1 gap-2 rounded-2xl bg-white p-3.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t.verdict.times}</dt>
              <dd className="tabular m-0 font-semibold">{scan.scanCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t.verdict.firstScan}</dt>
              <dd className="m-0 text-right font-semibold">{[scan.firstCity || t.verdict.unknownPlace, scan.firstScanAt ? dmy(lang, scan.firstScanAt) : ""].filter(Boolean).join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t.verdict.thisScan}</dt>
              <dd className="m-0 text-right font-semibold">{`${scan.thisCity || t.verdict.unknownPlace}, ${t.verdict.today}`}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <dl className="m-0 grid grid-cols-2 gap-3 rounded-[18px] border border-line bg-white p-4">
        {[
          [t.details.model, p.product.model || p.product.name],
          [t.details.serial, p.serial],
          [t.details.made, [new Date(p.madeOn).toLocaleDateString(LOCALE[lang], { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }), p.product.madeIn].filter(Boolean).join(", ")],
        ].map(([k, v]) => (
          <div key={k} className={k === t.details.made ? "col-span-2" : ""}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="tabular m-0 mt-0.5 break-all text-[15px] font-semibold">{v}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-xs text-muted">{t.details.warranty}</dt>
          <dd className="m-0 mt-0.5 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {warranty ? (
              <>
                {t.details.until(dmy(lang, `${warranty.validUntil}T06:00:00Z`))}
                {warranty.status === "review" ? <Pill tone="warning">{t.details.checking}</Pill> : warranty.status === "rejected" ? <Pill tone="danger">{t.details.rejected}</Pill> : null}
              </>
            ) : (
              t.details.notRegistered
            )}
          </dd>
        </div>
      </dl>

      {mode === null ? (
        <div className="flex flex-col gap-2.5">
          {!warranty && p.product.warrantyMonths > 0 ? (
            <button type="button" onClick={() => setMode("warranty")} className={primaryBtn}>
              {t.actions.register}
            </button>
          ) : null}
          {p.product.serviceEnabled ? (
            <button type="button" onClick={() => setMode("service")} className={warranty || p.product.warrantyMonths === 0 ? primaryBtn : outlineBtn}>
              {warn ? t.actions.contact : t.actions.service}
            </button>
          ) : null}
          {warn ? (
            <button type="button" onClick={() => setMode("report")} className={outlineBtn}>
              {t.actions.report}
            </button>
          ) : null}
          {p.product.videosUrl ? (
            <a href={p.product.videosUrl} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
              {t.actions.videos}
            </a>
          ) : null}
          {p.product.buyUrl ? (
            <a href={p.product.buyUrl} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
              {t.actions.buy}
            </a>
          ) : null}
          {p.product.manualUrl ? (
            <a href={p.product.manualUrl} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
              {t.actions.manual}
            </a>
          ) : null}
          {!warn ? (
            <button type="button" onClick={() => setMode("report")} className="mx-auto min-h-11 bg-transparent px-3 text-[13px] text-muted underline underline-offset-2">
              {t.actions.report}
            </button>
          ) : null}
        </div>
      ) : mode === "warranty" ? (
        <WarrantyForm {...p} lang={lang} onDone={(w) => { setWarranty(w); setMode(null); }} onClose={() => setMode(null)} />
      ) : mode === "service" ? (
        <ServiceForm token={p.token} lang={lang} onClose={() => setMode(null)} />
      ) : (
        <ReportForm token={p.token} lang={lang} onClose={() => setMode(null)} />
      )}
    </Shell>
  );
}

function WarrantyForm({ token, serial, today, product, lang, onDone, onClose }: ProductViewProps & { lang: Lang; onDone: (w: NonNullable<ProductViewProps["warranty"]>) => void; onClose: () => void }) {
  const t = PT[lang].warranty;
  const [v, setV] = useState({ name: "", phone: "", purchasedOn: today, boughtFrom: "", invoiceNo: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/p/warranty", { token, ...v });
    setBusy(false);
    if (r.ok) {
      onDone({ validUntil: r.data.validUntil, status: r.data.status });
      return;
    }
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.data.error === "already_registered" ? t.already : r.status === 429 ? PT[lang].tooMany : PT[lang].error);
  }

  return (
    <form onSubmit={submit} noValidate aria-label={t.title} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-4">
      <div>
        <h2 className="m-0 font-sans text-base font-semibold">{t.title}</h2>
        <p className="mx-0 mb-0 mt-1 text-[13px] text-graphite">{t.sub}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{t.serial}</span>
        <div className="tabular rounded-[14px] bg-paper px-3.5 py-3 text-sm">{`${serial} (${t.fromQr})`}</div>
      </div>
      <Row id="wr-name" label={t.name} error={errors.name}>
        <input id="wr-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={input(errors.name)} />
      </Row>
      <Row id="wr-phone" label={t.phone} error={errors.phone}>
        <input id="wr-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
      </Row>
      <Row id="wr-date" label={t.date} error={errors.purchasedOn}>
        <input id="wr-date" type="date" max={today} value={v.purchasedOn} onChange={set("purchasedOn")} aria-invalid={errors.purchasedOn ? true : undefined} className={input(errors.purchasedOn)} />
      </Row>
      <Row id="wr-from" label={t.from}>
        <input id="wr-from" value={v.boughtFrom} onChange={set("boughtFrom")} className={input()} />
      </Row>
      <Row id="wr-inv" label={t.invoice}>
        <input id="wr-inv" value={v.invoiceNo} onChange={set("invoiceNo")} className={input()} />
      </Row>
      <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? t.sending : t.submit(product.warrantyMonths)}
      </button>
      <button type="button" onClick={onClose} className={outlineBtn}>
        {t.close}
      </button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function ServiceForm({ token, lang, onClose }: { token: string; lang: Lang; onClose: () => void }) {
  const t = PT[lang].service;
  const [v, setV] = useState({ name: "", phone: "", problem: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ seq: number; token: string } | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/p/service", { token, ...v });
    setBusy(false);
    if (r.ok && r.data.token) return setDone({ seq: r.data.seq, token: r.data.token });
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.status === 429 ? PT[lang].tooMany : PT[lang].error);
  }
  if (done)
    return (
      <section role="status" aria-label={t.done(done.seq)} className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-4 text-center">
        <h2 className="m-0 font-sans text-base font-semibold">{t.done(done.seq)}</h2>
        <p className="m-0 text-sm text-graphite">{t.doneBody}</p>
        <a href={`/o/${done.token}?lang=${lang}`} className={outlineBtn}>
          {t.view}
        </a>
      </section>
    );
  return (
    <form onSubmit={submit} noValidate aria-label={t.title} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-4">
      <h2 className="m-0 font-sans text-base font-semibold">{t.title}</h2>
      <Row id="sv-problem" label={t.problem} error={errors.problem}>
        <textarea id="sv-problem" rows={3} maxLength={600} value={v.problem} onChange={set("problem")} aria-invalid={errors.problem ? true : undefined} className={cn(input(errors.problem), "min-h-[84px] py-3")} />
      </Row>
      <Row id="sv-name" label={t.name} error={errors.name}>
        <input id="sv-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={input(errors.name)} />
      </Row>
      <Row id="sv-phone" label={t.phone} error={errors.phone}>
        <input id="sv-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
      </Row>
      <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? t.sending : t.submit}
      </button>
      <button type="button" onClick={onClose} className={outlineBtn}>
        {PT[lang].warranty.close}
      </button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function ReportForm({ token, lang, onClose }: { token: string; lang: Lang; onClose: () => void }) {
  const t = PT[lang].report;
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/p/report", { token, note, website });
    setBusy(false);
    if (r.ok) return setDone(true);
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.status === 429 ? PT[lang].tooMany : PT[lang].error);
  }
  if (done)
    return (
      <p role="status" className="m-0 rounded-[18px] border border-line bg-white p-4 text-center text-sm">
        {t.done}
      </p>
    );
  return (
    <form onSubmit={submit} noValidate aria-label={t.title} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-4">
      <div>
        <h2 className="m-0 font-sans text-base font-semibold">{t.title}</h2>
        <p className="mx-0 mb-0 mt-1 text-[13px] text-graphite">{t.body}</p>
      </div>
      <Row id="rp-note" label={t.note} error={errors.note}>
        <textarea id="rp-note" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={errors.note ? true : undefined} className={cn(input(errors.note), "min-h-[84px] py-3")} />
      </Row>
      <Honeypot value={website} onChange={setWebsite} />
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? t.sending : t.submit}
      </button>
      <button type="button" onClick={onClose} className={outlineBtn}>
        {PT[lang].warranty.close}
      </button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
