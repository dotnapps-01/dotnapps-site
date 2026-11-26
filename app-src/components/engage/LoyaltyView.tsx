"use client";

import { Check } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { E } from "@/lib/engage-i18n";
import { cn } from "@/lib/cn";
import type { CardState } from "@/lib/engage";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, displayH, fieldCls, postJson, primaryBtn } from "./chrome";

/** A loyalty stamp card. The customer's number is kept on their phone so the card reopens; staff add stamps with the PIN. */
export function LoyaltyView({ code, business, location, programName, initialLang }: { code: string; business: string; location: string; programName: string; initialLang: Lang }) {
  const key = `skn-loyalty:${code}`;
  const [lang, setLang] = useState(initialLang);
  const [ready, setReady] = useState(false);
  const [card, setCard] = useState<CardState | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [msg, setMsg] = useState("");
  const t = E[lang].loyalty;

  // reopen the card saved on this phone
  useEffect(() => {
    (async () => {
      await Promise.resolve();
      let saved: { phone?: string; name?: string } | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {}
      if (saved?.phone) {
        setPhone(saved.phone);
        setName(saved.name ?? "");
        const r = await postJson("/api/s/loyalty", { code, action: "view", phone: saved.phone });
        if (r.ok) setCard(r.data.card);
      }
      setReady(true);
    })();
  }, [code, key]);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPhoneError("");
    setBusy(true);
    const r = await postJson("/api/s/loyalty", { code, action: "join", phone, name, optIn });
    setBusy(false);
    if (r.ok) {
      setCard(r.data.card);
      try {
        localStorage.setItem(key, JSON.stringify({ phone, name }));
      } catch {}
    } else if (r.status === 422 && r.data.fields?.phone) setPhoneError(r.data.fields.phone);
    else setError(t.error);
  }

  async function stamp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    const r = await postJson("/api/s/loyalty", { code, action: "stamp", phone, pin });
    setBusy(false);
    setPin("");
    if (r.ok) {
      setCard(r.data.card);
      setMsg(r.data.rewardEarned ? t.rewardNow : t.added);
    } else if (r.data.error === "bad_pin") setError(t.badPin(r.data.attemptsLeft ?? 0));
    else if (r.data.error === "locked") setError(t.locked);
    else if (r.data.error === "already_today") {
      if (r.data.card) setCard(r.data.card);
      setMsg(t.today);
    } else setError(t.error);
  }

  function reset() {
    try {
      localStorage.removeItem(key);
    } catch {}
    setCard(null);
    setPhone("");
    setMsg("");
    setError("");
  }

  const left = card ? card.needed - card.stamps : 0;

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      {!ready ? (
        <div className="h-64" aria-hidden="true" />
      ) : !card ? (
        <form onSubmit={join} noValidate className="flex flex-col gap-3.5">
          <div className="rounded-[22px] bg-marble p-5">
            <h1 className={cn(displayH(lang), "text-[26px]")}>{t.joinTitle}</h1>
            <p className="mx-0 mb-0 mt-1.5 text-sm text-graphite">
              {programName} · {t.joinSub}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ly-phone" className="text-[13px] font-semibold">
              {t.phone}
            </label>
            <input id="ly-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={phoneError ? true : undefined} className={cn(fieldCls, phoneError && "border-danger-fg")} />
            <ErrorText>{phoneError}</ErrorText>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ly-name" className="text-[13px] font-semibold">
              {t.name}
            </label>
            <input id="ly-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
          </div>
          <label className="flex items-start gap-2.5 text-[13px] text-graphite">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
            {t.optIn}
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? t.joining : t.join}
          </button>
          <ErrorText>{error}</ErrorText>
        </form>
      ) : (
        <>
          <h1 className="sr-only">{card.programName}</h1>
          <div className="flex flex-col gap-4 rounded-[22px] bg-ink p-5 text-white">
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn(displayH(lang), "text-lg")}>{card.programName}</span>
              <span className="tabular truncate text-[11px] text-lilac">{name ? `${name.split(" ")[0]} · ` : ""}{card.phone}</span>
            </div>
            <div role="img" aria-label={t.of(card.stamps, card.needed)} className="grid grid-cols-5 gap-2">
              {Array.from({ length: card.needed }, (_, i) => (
                <div key={i} className={cn("flex aspect-square items-center justify-center rounded-full border-[1.5px]", i < card.stamps ? "border-lilac bg-lilac" : "border-dashed border-[#4A4A52]")}>
                  {i < card.stamps ? <Check size={14} strokeWidth={3} className="text-ink" aria-hidden="true" /> : null}
                </div>
              ))}
            </div>
            <div className="tabular text-[11px] text-[#B8B8C0]">
              {t.of(card.stamps, card.needed)} · {t.more(left, card.reward)}
            </div>
          </div>

          {card.rewards.length ? (
            <div role="status" className="rounded-[18px] border border-ink bg-white p-4 text-center">
              <div className="text-[13px] font-semibold">{t.ready}: {card.reward}</div>
              {card.rewards.map((r) => (
                <div key={r.code} className="mt-2 text-[22px] font-bold tracking-[0.12em]">
                  {r.code}
                </div>
              ))}
              <p className="mx-0 mb-0 mt-1.5 text-xs text-muted">{t.rewardsReady}</p>
            </div>
          ) : null}

          <div className="rounded-[18px] bg-thead p-3.5">
            <div className="text-sm font-semibold">{t.howTitle}</div>
            <p className="mx-0 mb-0 mt-1 text-sm text-graphite">{t.howBody}</p>
          </div>

          <details className="rounded-[18px] border border-line bg-white p-3.5">
            <summary className="cursor-pointer text-sm font-semibold">{t.staffTitle}</summary>
            <form onSubmit={stamp} className="mt-3 flex flex-col gap-2.5">
              <p className="m-0 text-xs text-muted">{t.staffBody}</p>
              <label htmlFor="ly-pin" className="text-[13px] font-semibold">
                {t.pin}
              </label>
              <input id="ly-pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={fieldCls} />
              <button type="submit" disabled={busy || pin.length !== 4} className={primaryBtn}>
                {busy ? t.adding : t.addStamp}
              </button>
              <ErrorText>{error}</ErrorText>
            </form>
          </details>
          {msg ? (
            <p role="status" className="m-0 text-center text-sm font-semibold">
              {msg}
            </p>
          ) : null}
          <button type="button" onClick={reset} className="mx-auto py-2 text-xs text-muted underline underline-offset-2">
            {t.change}
          </button>
        </>
      )}
    </Shell>
  );
}
