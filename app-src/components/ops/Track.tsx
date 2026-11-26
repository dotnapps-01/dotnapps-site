"use client";

import { useCallback, useEffect, useState } from "react";
import { QRMark } from "@/components/qr/QRMark";
import { Pill } from "@/components/ui/Pill";
import { ErrorText, Shell, displayH, outlineBtn, postJson, primaryBtn } from "@/components/engage/chrome";
import { cn } from "@/lib/cn";
import { O, fmtDay, fmtDayTime, fmtTime } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { Hero } from "./parts";

type TicketData = { seq: number; title: string; status: "open" | "in_progress" | "resolved"; place: string; createdAt: string; business: string; events: { kind: string; text: string; at: string }[] };
type VisitorData = { name: string; purpose: string; host: string; status: "awaiting" | "approved" | "declined" | "on_site" | "checked_out"; validUntil: string | null; expired: boolean; business: string; place: string | null };
type BookingData = { itemName: string; kind: "service" | "event"; name: string; staff: string; startsAt: string; qty: number; status: "pending" | "confirmed" | "completed" | "no_show" | "cancelled"; code: string; business: string; venue: string; canCancel: boolean; price: number | null };
export type TrackProps = { token: string; initialLang: Lang } & ({ kind: "t"; data: TicketData } | { kind: "v"; data: VisitorData } | { kind: "b"; data: BookingData });

/** Re-reads the customer's own link now and then so the page reflects the business's decisions. */
function useLive<T>(token: string, initial: T, everyMs: number | null): [T, () => Promise<void>, boolean] {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/o/${token}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()).data as T);
    } catch {}
    setBusy(false);
  }, [token]);
  useEffect(() => {
    if (!everyMs) return;
    const id = window.setInterval(() => void refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs, refresh]);
  return [data, refresh, busy];
}

const TICKET_TONE = { open: "warning", in_progress: "info", resolved: "success" } as const;
const BOOKING_TONE = { pending: "warning", confirmed: "success", completed: "neutral", no_show: "danger", cancelled: "neutral" } as const;

function TicketTrack({ token, lang, initial }: { token: string; lang: Lang; initial: TicketData }) {
  const t = O[lang].track;
  const [d, refresh, busy] = useLive(token, initial, initial.status !== "resolved" ? 20_000 : null);
  const evText = (e: { kind: string; text: string }) => (e.kind === "created" ? t.ev.created : e.kind === "status" ? (e.text.includes("resolved") ? t.ev.resolved : e.text.includes("started") ? t.ev.started : t.ev.reopened) : e.text);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[22px] bg-marble p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="tabular text-xs text-graphite">{t.ticket(d.seq)}</span>
          <Pill tone={TICKET_TONE[d.status]}>{t.status[d.status].toUpperCase()}</Pill>
        </div>
        <h1 className={cn(displayH(lang), "mt-2 text-[24px]")}>{d.title}</h1>
        <p className="mx-0 mb-0 mt-1.5 text-xs text-graphite">{[d.place, t.raised(fmtDay(lang, d.createdAt))].filter(Boolean).join(" · ")}</p>
      </div>
      <section aria-labelledby="tr-up" className="rounded-[18px] border border-line bg-white p-4">
        <h2 id="tr-up" className="m-0 mb-3 font-sans text-sm font-semibold">
          {t.updates}
        </h2>
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
          {d.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-[5px] h-2.5 w-2.5 flex-none rounded-full bg-ink" />
              <div>
                <div className="text-sm">{evText(e)}</div>
                <div className="tabular mt-0.5 text-[11px] text-muted">{fmtDayTime(lang, e.at)}</div>
              </div>
            </li>
          ))}
        </ol>
        {d.events.length <= 1 && d.status !== "resolved" ? <p className="mb-0 mt-3 text-xs text-muted">{t.noUpdates}</p> : null}
      </section>
      {d.status === "resolved" ? <p role="status" className="m-0 text-sm text-graphite">{t.resolvedNote}</p> : null}
      <button type="button" onClick={() => void refresh()} disabled={busy} className={outlineBtn}>
        {t.refresh}
      </button>
    </div>
  );
}

function VisitorTrack({ token, lang, initial }: { token: string; lang: Lang; initial: VisitorData }) {
  const t = O[lang].visitor;
  const [d, refresh, busy] = useLive(token, initial, initial.status === "awaiting" || initial.status === "approved" ? 8_000 : null);
  const state = d.expired ? "expired" : d.status;
  const copy = {
    awaiting: [t.awaitingTitle, t.awaitingBody],
    approved: [t.approvedTitle, t.gate],
    on_site: [t.onSiteTitle, t.gate],
    checked_out: [t.outTitle, t.outBody],
    declined: [t.declinedTitle, t.declinedBody],
    expired: [t.expiredTitle, t.expiredBody],
  }[state];
  const good = state === "approved" || state === "on_site";
  return (
    <div className="flex flex-col gap-3.5" role="status" aria-live="polite">
      <div className={cn("rounded-[22px] p-5", good ? "bg-marble" : "bg-paper")}>
        <h1 className={cn(displayH(lang), "text-[26px]")}>{copy[0]}</h1>
        <p className="mx-0 mb-0 mt-1.5 text-sm text-graphite">{copy[1]}</p>
      </div>
      <div className={cn("rounded-[18px] border bg-white p-4", good ? "border-ink" : "border-line")}>
        <div className="text-lg font-semibold">{d.name}</div>
        <div className="mt-0.5 text-sm text-graphite">{t.meeting(d.host)}</div>
        <div className="mt-0.5 text-sm text-graphite">{d.purpose}</div>
        {good && d.validUntil ? (
          <div className="mt-3 border-t border-line-soft pt-3 text-sm">
            <span className="text-muted">{t.validTill}</span> <strong>{fmtDayTime(lang, d.validUntil)}</strong>
          </div>
        ) : null}
      </div>
      {state === "awaiting" ? (
        <button type="button" onClick={() => void refresh()} disabled={busy} className={outlineBtn}>
          {t.refresh}
        </button>
      ) : null}
    </div>
  );
}

function BookingTrack({ token, lang, initial }: { token: string; lang: Lang; initial: BookingData }) {
  const t = O[lang].book;
  const [d, refresh] = useLive(token, initial, null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const isEvent = d.kind === "event";
  const title = d.status === "pending" ? t.requestedTitle : d.status === "cancelled" ? t.cancelled : isEvent ? t.ticketTitle : t.bookedTitle;
  async function cancel() {
    setError("");
    const r = await postJson(`/api/o/${token}/cancel`, {});
    if (r.ok) {
      setConfirm(false);
      await refresh();
    } else setError(O[lang].error);
  }
  return (
    <div className="flex flex-col gap-3.5">
      <Hero lang={lang} title={title} sub={d.status === "pending" ? t.requestedBody : undefined} />
      <div className="rounded-[18px] border border-line bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold">{d.itemName}</div>
          <Pill tone={BOOKING_TONE[d.status]}>{t.status[d.status].toUpperCase()}</Pill>
        </div>
        <div className="mt-1 text-sm text-graphite">
          {fmtDayTime(lang, d.startsAt)}
          {d.staff ? ` · ${t.withStaff(d.staff)}` : ""}
        </div>
        {d.venue ? <div className="mt-0.5 text-sm text-graphite">{d.venue}</div> : null}
        <div className="mt-0.5 text-sm text-graphite">{[d.name, isEvent ? t.seats(d.qty) : null].filter(Boolean).join(" · ")}</div>
        {d.status !== "cancelled" ? (
          <div className="mt-3 flex items-center gap-4 border-t border-line-soft pt-3">
            {isEvent ? <QRMark value={d.code} size={96} variant="square" label={`${t.code} ${d.code}`} /> : null}
            <div>
              <div className="text-xs text-muted">{t.code}</div>
              <div className="tabular text-xl font-semibold tracking-wider">{d.code}</div>
              <div className="mt-1 text-xs text-muted">{t.show}</div>
            </div>
          </div>
        ) : null}
      </div>
      {d.canCancel ? (
        confirm ? (
          <div role="alertdialog" aria-label={t.cancelAsk} className="flex flex-col gap-2 rounded-2xl bg-paper p-4">
            <p className="m-0 text-sm font-semibold">{t.cancelAsk}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void cancel()} className={primaryBtn}>
                {t.cancel}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={outlineBtn}>
                ×
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={outlineBtn}>
            {t.cancel}
          </button>
        )
      ) : null}
      <ErrorText>{error}</ErrorText>
      <span className="sr-only" aria-live="polite">
        {fmtTime(lang, d.startsAt)}
      </span>
    </div>
  );
}

export function Track(p: TrackProps) {
  const [lang, setLang] = useState(p.initialLang);
  const business = p.data.business;
  return (
    <Shell business={business} location="" lang={lang} onLang={setLang}>
      {p.kind === "t" ? <TicketTrack token={p.token} lang={lang} initial={p.data} /> : p.kind === "v" ? <VisitorTrack token={p.token} lang={lang} initial={p.data} /> : <BookingTrack token={p.token} lang={lang} initial={p.data} />}
    </Shell>
  );
}
