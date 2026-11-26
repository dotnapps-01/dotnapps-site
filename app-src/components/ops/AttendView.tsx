"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { O, fmtMinutes, fmtTime } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, fieldCls, postJson, primaryBtn } from "@/components/engage/chrome";
import { cn } from "@/lib/cn";
import { Hero, Row, input } from "./parts";

const KEY = "skn_worker_id";
type Result = { action: "in" | "out"; at: string; name: string; distM: number | null; verified: boolean; lateMin: number; shiftStart: number; shiftEnd: number; inAt: string };

function position(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 12_000, maximumAge: 20_000 });
  });
}

/** A worker checks in on the first scan of the day and out on a later one. */
export function AttendView({ code, business, location, initialLang, point }: { code: string; business: string; location: string; initialLang: Lang; point: { name: string; requireGeo: boolean } }) {
  const [lang, setLang] = useState(initialLang);
  const [id, setId] = useState("");
  const [last4, setLast4] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"idle" | "locating" | "sending">("idle");
  const [message, setMessage] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const t = O[lang];

  // remember the worker's ID on this phone (never the 4 digits)
  useEffect(() => {
    (async () => {
      await Promise.resolve();
      try {
        const saved = localStorage.getItem(KEY);
        if (saved) setId(saved);
      } catch {}
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage("");
    let pos: { lat: number; lng: number } | null = null;
    if (point.requireGeo) {
      setPhase("locating");
      pos = await position();
      if (!pos) {
        setPhase("idle");
        return setMessage(t.attend.need_location);
      }
    }
    setPhase("sending");
    const r = await postJson("/api/s/attend", { code, workerCode: id, last4, lat: pos?.lat ?? null, lng: pos?.lng ?? null });
    setPhase("idle");
    if (r.ok) {
      try {
        localStorage.setItem(KEY, id.trim().toUpperCase());
      } catch {}
      return setRes(r.data as Result);
    }
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    const d = r.data as { error?: string; at?: string; distM?: number; radiusM?: number };
    const a = t.attend;
    setMessage(
      d.error === "no_match" ? a.no_match
      : d.error === "need_location" ? a.need_location
      : d.error === "outside" ? a.outside(d.distM ?? 0, d.radiusM ?? 0)
      : d.error === "too_soon" && d.at ? a.too_soon(fmtTime(lang, d.at))
      : d.error === "done" && d.at ? a.done(fmtTime(lang, d.at))
      : d.error === "rate_limited" ? t.tooMany
      : t.error,
    );
  }

  const hoursOnSite = (r: Result) => {
    const m = Math.max(0, Math.round((new Date(r.at).getTime() - new Date(r.inAt).getTime()) / 60_000));
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  };

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang}>
      {res ? (
        <div role="status" className="flex flex-col gap-3.5">
          <Hero lang={lang} title={res.action === "in" ? t.attend.inDone(fmtTime(lang, res.at)) : t.attend.outDone(fmtTime(lang, res.at))} sub={res.name} />
          <ul className="m-0 flex list-none flex-col gap-2 rounded-[18px] border border-line bg-white p-4 text-sm">
            {res.action === "in" ? <li className={cn("font-semibold", res.lateMin > 0 ? "text-warning-fg" : "text-success-fg")}>{res.lateMin > 0 ? t.attend.late(res.lateMin) : t.attend.onTime}</li> : <li>{t.attend.worked(hoursOnSite(res))}</li>}
            <li className="text-graphite">{t.attend.shift(fmtMinutes(lang, res.shiftStart), fmtMinutes(lang, res.shiftEnd))}</li>
            {res.verified ? (
              <li className="flex items-center gap-1.5 text-graphite">
                <MapPin size={14} aria-hidden="true" /> {t.attend.verified}
                {res.distM !== null ? ` · ${t.attend.away(res.distM)}` : ""}
              </li>
            ) : null}
          </ul>
          <button type="button" onClick={() => { setRes(null); setLast4(""); }} className={primaryBtn}>
            {t.attend.again}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <Hero lang={lang} title={t.attend.title} sub={t.attend.at(point.name)} />
          {point.requireGeo ? (
            <p className="m-0 flex items-start gap-2 rounded-2xl bg-paper p-3 text-[13px] text-graphite">
              <MapPin size={16} aria-hidden="true" className="mt-0.5 flex-none" /> {t.attend.needGeo}
            </p>
          ) : null}
          <Row id="at-id" label={t.attend.id} hint={t.attend.idHint} error={errors.workerCode}>
            <input id="at-id" autoCapitalize="characters" autoComplete="off" placeholder="ST-0007" value={id} onChange={(e) => setId(e.target.value)} aria-invalid={errors.workerCode ? true : undefined} className={input(errors.workerCode)} />
          </Row>
          <Row id="at-last4" label={t.attend.last4} error={errors.last4}>
            <input id="at-last4" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]*" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} aria-invalid={errors.last4 ? true : undefined} className={cn(input(errors.last4), fieldCls, "tracking-[0.3em]")} />
          </Row>
          <button type="submit" disabled={phase !== "idle"} className={primaryBtn}>
            {phase === "locating" ? t.attend.locating : phase === "sending" ? t.attend.checking : t.attend.button}
          </button>
          <ErrorText>{message}</ErrorText>
        </form>
      )}
    </Shell>
  );
}
