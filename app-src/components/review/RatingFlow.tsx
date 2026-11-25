"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_CHIPS, ISSUE_KEYS, LANGS, T, chipLabel, questionFor, suggestReview, type IssueKey, type Lang } from "@/lib/review-i18n";

export type RatingFlowProps = {
  code: string;
  business: string;
  location: string;
  source: string;
  staff: string;
  googleUrl: string;
  question: string;
  chips: string[];
  languages: Lang[];
  suggestText: boolean;
  links: { label: string; url: string }[];
  initialLang: Lang;
  /** Preview and demo pages: nothing is saved or sent and the Google link is not followed. */
  demo?: boolean;
};

type Stage = "rate" | "high" | "low" | "thanks";

const STAR = "M12 2.8l2.8 5.8 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z";

const chipCls = (on: boolean) =>
  cn(
    "min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
    on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-paper",
  );
const primary =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-0 bg-ink px-4 text-center text-[15px] font-semibold text-white no-underline transition-colors hover:bg-ink-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const outline =
  "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-track bg-white px-4 text-center text-[15px] font-semibold text-ink no-underline transition-colors hover:bg-mist hover:text-ink";
const field = "min-h-[46px] w-full rounded-[14px] border border-line bg-white px-3.5 text-sm text-ink placeholder:text-faint";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

const initials = (name: string) =>
  (name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "S").toUpperCase();

export function RatingFlow(p: RatingFlowProps) {
  const [lang, setLang] = useState<Lang>(p.initialLang);
  const [stage, setStage] = useState<Stage>("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [seed, setSeed] = useState(0);
  const [issues, setIssues] = useState<IssueKey[]>([]);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ message?: string; phone?: string }>({});
  const [note, setNote] = useState("");
  const t = T[lang];
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const chipList = p.chips.length ? p.chips : DEFAULT_CHIPS;
  const suggestion = useMemo(
    () => suggestReview({ lang, rating, chips, business: p.business, staff: p.staff, seed }),
    [lang, rating, chips, p.business, p.staff, seed],
  );
  // keep the draft in step with the chips and language until the customer edits it
  const shownText = edited ? text : suggestion;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [stage]);

  async function choose(n: number) {
    setRating(n);
    setError("");
    setNote("");
    setStage(n >= 4 ? "high" : "low");
    if (p.demo) return;
    if (responseId) {
      post("/api/review/event", { id: responseId, type: "rating", rating: n });
      return;
    }
    const r = await post("/api/review/response", { code: p.code, rating: n, lang });
    if (r.ok && r.data.id) setResponseId(r.data.id);
  }

  function toggleChip(c: string) {
    const next = chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c];
    setChips(next);
    if (responseId && !p.demo) post("/api/review/event", { id: responseId, type: "chips", chips: next });
  }

  function onGoogle() {
    if (p.demo) return;
    if (p.suggestText && stage === "high") {
      navigator.clipboard?.writeText(shownText).catch(() => {});
      setNote(t.copied);
    }
    if (responseId) post("/api/review/event", { id: responseId, type: "google" });
    setStage("thanks");
  }

  async function sendFeedback() {
    setError("");
    setFieldErrors({});
    if (message.trim().length < 3) {
      setFieldErrors({ message: t.whatWrong });
      return;
    }
    if (p.demo) {
      setStage("thanks");
      return;
    }
    if (!responseId) {
      setError(t.error);
      return;
    }
    setBusy(true);
    const r = await post("/api/review/feedback", { id: responseId, message, phone, chips: issues });
    setBusy(false);
    if (r.ok) setStage("thanks");
    else if (r.status === 422 && r.data.fields) setFieldErrors(r.data.fields);
    else setError(t.error);
  }

  const googleAnchor = (label: string, cls: string) =>
    p.googleUrl || p.demo ? (
      <a
        href={p.demo ? "#" : p.googleUrl}
        target={p.demo ? undefined : "_blank"}
        rel="noopener noreferrer"
        onClick={(e) => {
          if (p.demo) {
            e.preventDefault();
            setNote(t.demoNote);
            return;
          }
          onGoogle();
        }}
        className={cls}
      >
        {label}
      </a>
    ) : null;

  const stars = (size: number) => (
    <div role="group" aria-label={questionFor(lang, p.question)} className="flex justify-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= (hover || rating);
        return (
          <button
            key={n}
            type="button"
            aria-label={t.stars(n)}
            aria-pressed={rating === n}
            onClick={() => choose(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className="flex h-11 min-w-9 items-center justify-center rounded-lg p-0"
          >
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR} fill={filled ? "#0E0E10" : "none"} stroke="#0E0E10" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );

  const h = cn("m-0 font-display text-[26px] font-semibold leading-[1.15] outline-none", lang === "en" ? "tracking-heading" : "tracking-normal");
  const sub = "m-0 text-sm leading-[1.5] text-graphite";

  return (
    <div lang={lang} className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-3.5 px-[22px] pb-[22px] pt-6">
      {p.demo ? (
        <p role="note" className="m-0 border border-dashed border-track bg-white px-3 py-2 text-xs text-graphite">
          {T[lang].demoNote}
        </p>
      ) : null}

      <header className="flex items-center gap-2.5">
        <div aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
          {initials(p.business)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{p.business}</div>
          <div className="truncate text-xs text-muted">{[p.location, p.source].filter(Boolean).join(" · ")}</div>
        </div>
      </header>

      {stage === "rate" && (
        <div className="mt-5 flex flex-col gap-[18px] rounded-hero bg-marble px-5 py-7 text-center">
          <h1 ref={heading} tabIndex={-1} className={h}>
            {questionFor(lang, p.question)}
          </h1>
          <p className={sub}>{t.tapStar}</p>
          {stars(42)}
        </div>
      )}

      {stage === "high" && (
        <>
          {stars(30)}
          <h1 ref={heading} tabIndex={-1} className={h}>
            {t.lovedTitle}
          </h1>
          <p className={sub}>{t.lovedSub}</p>
          <div role="group" aria-label={t.lovedSub} className="flex flex-wrap gap-2">
            {chipList.map((c) => (
              <button key={c} type="button" aria-pressed={chips.includes(c)} onClick={() => toggleChip(c)} className={chipCls(chips.includes(c))}>
                {chipLabel(lang, c)}
              </button>
            ))}
          </div>
          {p.suggestText ? (
            <div className="rounded-[18px] border border-line bg-white p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2.5 text-xs">
                <span className="inline-flex items-center rounded-full bg-marble px-2.5 py-1 text-xs font-semibold">{t.suggested}</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setSeed((s) => s + 1)} disabled={edited} className="py-1 font-semibold underline-offset-2 hover:underline disabled:opacity-40">
                    {t.another}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing) {
                        setText(shownText);
                        setEdited(true);
                      }
                      setEditing((v) => !v);
                    }}
                    className="py-1 font-semibold underline-offset-2 hover:underline"
                  >
                    {editing ? t.done : t.edit}
                  </button>
                </span>
              </div>
              {editing ? (
                <>
                  <label htmlFor="review-text" className="sr-only">
                    {t.suggested}
                  </label>
                  <textarea id="review-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={600} className="w-full rounded-input border border-line p-2.5 text-sm leading-[1.5] text-ink" />
                </>
              ) : (
                <p className="m-0 text-sm leading-[1.5] text-ink">{shownText}</p>
              )}
            </div>
          ) : null}
          {googleAnchor(p.suggestText ? t.copyPost : t.postGoogle, primary)}
          {p.suggestText ? <p className="m-0 text-center text-xs text-muted">{t.copyNote}</p> : null}
        </>
      )}

      {stage === "low" && (
        <>
          {stars(30)}
          <h1 ref={heading} tabIndex={-1} className={h}>
            {t.sorryTitle}
          </h1>
          <p className={sub}>{t.sorrySub}</p>
          <div role="group" aria-label={t.sorrySub} className="flex flex-wrap gap-2">
            {ISSUE_KEYS.map((k) => {
              const on = issues.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setIssues((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))} className={chipCls(on)}>
                  {t.issues[k]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fb-message" className="text-[13px] font-semibold">
              {t.whatWrong}
            </label>
            <textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              aria-invalid={fieldErrors.message ? true : undefined}
              className={cn(field, "min-h-[84px] py-3", fieldErrors.message && "border-danger-fg")}
            />
            {fieldErrors.message ? (
              <p role="alert" className="m-0 text-xs text-danger-fg">
                {fieldErrors.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fb-phone" className="text-[13px] font-semibold">
              {t.phone}
            </label>
            <input
              id="fb-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={fieldErrors.phone ? true : undefined}
              aria-describedby="fb-phone-note"
              className={cn(field, fieldErrors.phone && "border-danger-fg")}
            />
            <p id="fb-phone-note" className="m-0 text-xs text-muted">
              {fieldErrors.phone ?? t.phoneNote}
            </p>
          </div>
          <button type="button" onClick={sendFeedback} disabled={busy} className={primary}>
            {busy ? t.sending : t.sendManager}
          </button>
          {googleAnchor(t.postGoogle, outline)}
          <p className="m-0 text-center text-xs text-muted">{t.bothAvailable}</p>
        </>
      )}

      {stage === "thanks" && (
        <>
          <div className="mt-[60px]">
            <div aria-hidden="true" className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-bg">
              <Check size={36} strokeWidth={1.8} className="text-success-fg" />
            </div>
          </div>
          <h1 ref={heading} tabIndex={-1} className={cn(h, "text-center")}>
            {t.thanksTitle}
          </h1>
          <p className={cn(sub, "text-center")}>{note || t.thanksSub}</p>
          {p.links.map((l) => (
            <a key={l.url} href={p.demo ? "#" : l.url} target={p.demo ? undefined : "_blank"} rel="noopener noreferrer" onClick={(e) => p.demo && e.preventDefault()} className={outline}>
              {l.label}
            </a>
          ))}
        </>
      )}

      {error ? (
        <p role="alert" className="m-0 text-center text-sm text-danger-fg">
          {error}
        </p>
      ) : null}
      {note && stage !== "thanks" ? (
        <p role="status" className="m-0 text-center text-xs text-muted">
          {note}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        {p.languages.length > 1 && stage !== "thanks" ? (
          <div role="group" aria-label={t.language} className="flex flex-wrap justify-center gap-2">
            {LANGS.filter((l) => p.languages.includes(l.key)).map((l) => (
              <button key={l.key} type="button" lang={l.key} aria-pressed={lang === l.key} onClick={() => setLang(l.key)} className={chipCls(lang === l.key)}>
                {l.native}
              </button>
            ))}
          </div>
        ) : null}
        <div className="text-[11.5px] text-muted">{t.powered}</div>
      </div>
    </div>
  );
}
