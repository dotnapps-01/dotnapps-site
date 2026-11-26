"use client";

import { useState, type FormEvent } from "react";
import { E, fmtDate } from "@/lib/engage-i18n";
import { cn } from "@/lib/cn";
import type { Claim, CouponRecord } from "@/lib/engage";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, displayH, fieldCls, outlineBtn, postJson, primaryBtn } from "./chrome";

/** A coupon: claim it with a phone number, get a one-use code to show at the counter. */
export function CouponView({ code, business, location, coupon, initialLang }: { code: string; business: string; location: string; coupon: Pick<CouponRecord, "title" | "headline" | "description" | "state">; initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(coupon.state);
  const t = E[lang].coupon;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPhoneError("");
    setBusy(true);
    const r = await postJson("/api/s/coupon", { code, phone, name, optIn });
    setBusy(false);
    if (r.data.claim) {
      setClaim(r.data.claim);
      setNote(r.status === 200 ? t.already : "");
      return;
    }
    if (r.status === 422 && r.data.fields?.phone) return setPhoneError(r.data.fields.phone);
    const map: Record<string, typeof state> = { paused: "paused", not_started: "scheduled", ended: "ended", sold_out: "ended" };
    if (map[r.data.error]) setState(map[r.data.error]);
    else setError(t.error);
  }

  const closed = state !== "live" && !claim;
  const closedText = state === "paused" ? t.paused : state === "scheduled" ? t.notStarted : t.ended;
  const shareText = claim ? `${business}: ${claim.headline}. ${claim.code}` : "";

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      <div className="mt-2 overflow-hidden rounded-3xl border border-line bg-white">
        <div className="bg-marble px-5 py-6 text-center">
          <div className="tabular text-xs text-graphite">{t.offer}</div>
          <h1 className={cn(displayH(lang), "mt-1.5 text-[40px]")}>{coupon.headline}</h1>
          <p className="mx-0 mb-0 mt-1 text-sm font-medium">{coupon.title}</p>
          {coupon.description ? <p className="mx-0 mb-0 mt-1 text-sm text-graphite">{coupon.description}</p> : null}
        </div>
        <div className="border-t border-dashed border-track p-[18px]">
          {claim ? (
            <div className="flex flex-col items-center gap-3 text-center" role="status">
              {note ? <p className="m-0 text-xs text-muted">{note}</p> : null}
              <div className="text-xs text-muted">{t.yourCode}</div>
              <div className="font-sans text-[26px] font-bold tracking-[0.14em]" aria-label={claim.code.split("").join(" ")}>
                {claim.code}
              </div>
              <div className="text-xs text-muted">{claim.redeemed ? t.used : t.oneUse(fmtDate(lang, claim.expiresAt))}</div>
              <p className="m-0 text-xs text-graphite">{t.redeemNote}</p>
            </div>
          ) : closed ? (
            <p role="status" className="m-0 text-center text-sm text-graphite">
              {closedText}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cp-phone" className="text-[13px] font-semibold">
                  {t.phone}
                </label>
                <input id="cp-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={phoneError ? true : undefined} className={cn(fieldCls, phoneError && "border-danger-fg")} />
                <ErrorText>{phoneError}</ErrorText>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cp-name" className="text-[13px] font-semibold">
                  {t.name}
                </label>
                <input id="cp-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
              </div>
              <label className="flex items-start gap-2.5 text-[13px] text-graphite">
                <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
                {t.optIn}
              </label>
              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy ? t.claiming : t.claim}
              </button>
              <ErrorText>{error}</ErrorText>
            </form>
          )}
        </div>
      </div>
      {claim && !claim.redeemed ? (
        <>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(claim.code).catch(() => {});
              setNote(t.copied);
            }}
            className={primaryBtn}
          >
            {t.copy}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
            {t.sendWa}
          </a>
        </>
      ) : null}
    </Shell>
  );
}
