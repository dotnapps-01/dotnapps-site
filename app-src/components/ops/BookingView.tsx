"use client";

import { Calendar, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { PublicBookable } from "@/lib/engage-public";
import { addDays } from "@/lib/ops-input";
import { O, fmtDay, fmtDayTime, fmtMinutes } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, chip, postJson, primaryBtn } from "@/components/engage/chrome";
import { cn } from "@/lib/cn";
import { Hero, Honeypot, Row, input } from "./parts";

type Slot = { start: number; free: string[] };
const DAYS = 7;
const money = (n: number | null, free: string) => (n === null || n === 0 ? free : `₹${n.toLocaleString("en-IN")}`);

/** Book a service slot, or register for an event. After booking, the customer is sent to their own booking page. */
export function BookingView({ code, business, location, initialLang, item, today, ended }: { code: string; business: string; location: string; initialLang: Lang; item: PublicBookable; today: string; ended: boolean }) {
  const router = useRouter();
  const [lang, setLang] = useState(initialLang);
  const t = O[lang].book;
  const isEvent = item.kind === "event";

  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [v, setV] = useState({ name: "", phone: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(item.seatsLeft);

  const fetchSlots = useCallback(
    async (day: string): Promise<Slot[]> => {
      try {
        const res = await fetch(`/api/s/booking/slots?code=${encodeURIComponent(code)}&date=${day}`, { cache: "no-store" });
        const j = await res.json();
        return res.ok ? j.slots : [];
      } catch {
        return [];
      }
    },
    [code],
  );
  // the free times for the chosen day (re-read whenever the day changes)
  useEffect(() => {
    if (isEvent) return;
    let live = true;
    (async () => {
      await Promise.resolve();
      setSlots(null);
      setStart(null);
      const s = await fetchSlots(date);
      if (live) setSlots(s);
    })();
    return () => {
      live = false;
    };
  }, [date, isEvent, fetchSlots]);

  // changing staff keeps the chosen time when that person is free then
  const pickStaff = (s: string) => {
    setStaff(s);
    setStart((cur) => (cur !== null && slots?.some((x) => x.start === cur && (!s || x.free.includes(s))) ? cur : null));
  };
  const visible = (slots ?? []).filter((s) => !staff || s.free.includes(staff));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const dayIso = (d: string) => `${d}T06:30:00Z`; // midday in India, so the weekday/date never shift
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    if (!isEvent && start === null) return setError(t.closedPick);
    setBusy(true);
    const r = await postJson("/api/s/booking", { code, ...v, date, start, staff, qty });
    if (r.ok && r.data.token) return router.push(`/o/${r.data.token}?lang=${lang}`);
    setBusy(false);
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    const d = r.data as { error?: string; left?: number };
    if (d.error === "taken") {
      setError(t.taken);
      setStart(null);
      setSlots(await fetchSlots(date));
    } else if (d.error === "sold_out") {
      setLeft(d.left ?? 0);
      setError(t.soldOut);
    } else setError(d.error === "past" ? t.past : r.status === 429 ? O[lang].tooMany : O[lang].error);
  }

  const soldOut = isEvent && left !== null && left <= 0;
  const maxQty = Math.max(1, Math.min(5, left ?? 5));

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <Hero lang={lang} title={item.name} sub={item.description || (isEvent ? t.eventTitle : t.title)} />
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 text-sm text-graphite">
          {isEvent && item.startsAt ? (
            <li className="flex items-center gap-1.5">
              <Calendar size={14} aria-hidden="true" /> {fmtDayTime(lang, item.startsAt)}
            </li>
          ) : null}
          {isEvent && item.venue ? (
            <li className="flex items-center gap-1.5">
              <MapPin size={14} aria-hidden="true" /> {item.venue}
            </li>
          ) : null}
          {!isEvent && item.durationMin ? <li>{t.mins(item.durationMin)}</li> : null}
          <li className="font-semibold text-ink">{money(item.price, t.free)}</li>
          {isEvent && left !== null ? <li>{left > 0 ? t.left(left) : t.soldOut}</li> : null}
        </ul>

        {ended ? (
          <p role="status" className="m-0 rounded-2xl bg-paper p-4 text-sm text-graphite">
            {t.ended}
          </p>
        ) : soldOut ? (
          <p role="status" className="m-0 rounded-2xl bg-paper p-4 text-sm text-graphite">
            {t.soldOut}
          </p>
        ) : (
          <>
            {!isEvent ? (
              <>
                {item.staff.length > 1 ? (
                  <div className="flex flex-col gap-1.5">
                    <span id="bk-staff" className="text-[13px] font-semibold">
                      {t.staff}
                    </span>
                    <div role="group" aria-labelledby="bk-staff" className="flex flex-wrap gap-2">
                      {["", ...item.staff].map((s) => (
                        <button key={s || "any"} type="button" aria-pressed={staff === s} onClick={() => pickStaff(s)} className={chip(staff === s)}>
                          {s || t.anyone}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <span id="bk-date" className="text-[13px] font-semibold">
                    {t.date}
                  </span>
                  <div role="group" aria-labelledby="bk-date" className="flex gap-2 overflow-x-auto pb-1">
                    {days.map((d) => (
                      <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={cn(chip(date === d), "flex-none")}>
                        {fmtDay(lang, dayIso(d))}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span id="bk-time" className="text-[13px] font-semibold">
                    {t.time}
                  </span>
                  {slots === null ? (
                    <p className="m-0 text-sm text-muted">{O[lang].loading}</p>
                  ) : visible.length === 0 ? (
                    <p role="status" className="m-0 text-sm text-graphite">
                      {t.noSlots}
                    </p>
                  ) : (
                    <div role="group" aria-labelledby="bk-time" className="flex flex-wrap gap-2">
                      {visible.map((s) => (
                        <button key={s.start} type="button" aria-pressed={start === s.start} onClick={() => setStart(s.start)} className={chip(start === s.start)}>
                          {fmtMinutes(lang, s.start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Row id="bk-qty" label={t.qty} error={errors.qty}>
                <div role="group" aria-label={t.qty} className="flex gap-2">
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={qty === n} onClick={() => setQty(n)} className={chip(qty === n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            <Row id="bk-name" label={t.name} error={errors.name}>
              <input id="bk-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={input(errors.name)} />
            </Row>
            <Row id="bk-phone" label={t.phone} error={errors.phone}>
              <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
            </Row>
            <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? t.sending : isEvent ? t.confirmEvent : start !== null ? t.confirm(`${fmtDay(lang, dayIso(date))}, ${fmtMinutes(lang, start)}`) : t.title}
            </button>
            <ErrorText>{error}</ErrorText>
          </>
        )}
      </form>
    </Shell>
  );
}
