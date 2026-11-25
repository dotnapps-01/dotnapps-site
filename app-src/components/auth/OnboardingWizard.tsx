"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PathIcon } from "@/components/marketing/parts";
import { QRMark } from "@/components/qr/QRMark";
import { LogoMark } from "@/components/site/Logo";
import { Button, buttonClasses } from "@/components/ui/Button";
import { bigControl, captionLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  goalOptions,
  industryOptions,
  onboardingSteps,
  recommendedGoals,
  type GoalKey,
  type IndustryKey,
} from "@/lib/content/onboarding";
import { DEV_OTP_KEY } from "./AuthForm";
import { OtpInput } from "./OtpInput";

export type WizardInitial = {
  step: number;
  verified: boolean;
  mode: "signup" | "login";
  phoneMasked: string;
  industry: IndustryKey | "";
  goals: GoalKey[];
  locationName: string;
  address: string;
  scanUrl: string;
};

// Re-reads the dev code when "Resend" stores a new one (same-tab `storage` events are dispatched manually).
const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const readDevCode = () => {
  try {
    return sessionStorage.getItem(DEV_OTP_KEY) ?? "";
  } catch {
    return "";
  }
};

const eyebrow = "tabular text-xs text-ink";
const h1 = "m-0 font-display text-[clamp(32px,6vw,44px)] font-semibold leading-[1.05] tracking-display";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const mmss = (s: number) => `00:${String(s).padStart(2, "0")}`;

export function OnboardingWizard({ initial }: { initial: WizardInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(initial.step);
  const [verified, setVerified] = useState(initial.verified);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(30);
  const [industry, setIndustry] = useState<IndustryKey | "">(initial.industry);
  const [goals, setGoals] = useState<GoalKey[]>(initial.goals);
  const [locationName, setLocationName] = useState(initial.locationName);
  const [address, setAddress] = useState(initial.address);
  const [error, setError] = useState("");
  const [fieldNote, setFieldNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectNote, setConnectNote] = useState("");
  const devCode = useSyncExternalStore(subscribeStorage, readDevCode, () => "");

  // resend countdown
  useEffect(() => {
    if (step !== 0 || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  // move focus to the new step heading for keyboard / screen-reader users
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const industryLabel = industryOptions.find((i) => i.key === industry)?.label.toLowerCase() ?? "business";

  async function verify(code = otp) {
    if (busy) return;
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    const { res, data } = await postJson("/api/auth/otp/verify", { code }).catch(() => ({ res: null, data: {} }));
    setBusy(false);
    if (res?.ok) {
      try {
        sessionStorage.removeItem(DEV_OTP_KEY);
      } catch {}
      if (data.next) {
        router.push(data.next);
        return;
      }
      setVerified(true);
      setStep(1);
      return;
    }
    setOtp("");
    if (!res) setError("We couldn't reach the server. Please try again.");
    else if (data.error === "wrong") setError(`That code isn't right. ${data.attemptsLeft} ${data.attemptsLeft === 1 ? "try" : "tries"} left.`);
    else if (data.error === "locked") setError("Too many wrong codes. Go back and ask for a new code.");
    else setError("This code has expired. Resend a new one.");
  }

  async function resend() {
    setError("");
    const { res, data } = await postJson("/api/auth/otp/send", { resend: true }).catch(() => ({ res: null, data: {} }));
    if (res?.ok) {
      setResendIn(data.resendIn ?? 30);
      setOtp("");
      try {
        if (data.devCode) sessionStorage.setItem(DEV_OTP_KEY, data.devCode);
      } catch {}
      // force re-read of the dev code banner
      window.dispatchEvent(new Event("storage"));
      return;
    }
    if (res?.status === 429) setResendIn(data.retryAfter ?? 30);
    else if (res?.status === 400) setError("This code request has expired. Go back and start again.");
    else setError("We couldn't resend the code. Please try again.");
  }

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    const { res, data } = await postJson("/api/onboarding", body).catch(() => ({ res: null, data: {} }));
    setBusy(false);
    if (res?.status === 401) {
      router.push("/login");
      return false;
    }
    if (!res?.ok) {
      setError(data?.fields ? Object.values(data.fields as Record<string, string>)[0] : "We couldn't save that. Please try again.");
      return false;
    }
    return true;
  }

  async function next() {
    setError("");
    setFieldNote("");
    if (step === 0) return verify();
    if (step === 1) {
      if (!industry) return setFieldNote("Pick the closest match to continue.");
      const g = goals.length ? goals : recommendedGoals[industry];
      if (await save({ step: 2, industry })) {
        setGoals(g);
        setStep(2);
      }
    } else if (step === 2) {
      if (goals.length === 0) return setFieldNote("Pick at least one goal to continue.");
      if (await save({ step: 3, goals })) setStep(3);
    } else if (step === 3) {
      if (locationName.trim().length < 2) return setFieldNote("Enter a location name to continue.");
      if (await save({ industry, goals, locationName, address, complete: true })) setStep(4);
    }
  }

  const backFloor = verified ? 1 : 0;
  const nextLabel = step === 3 ? "Create my workspace" : step === 0 ? "Verify" : "Continue";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-frame flex-wrap items-center justify-between gap-4 px-[clamp(20px,4vw,40px)] py-4">
          <span className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <span className="font-display text-xl font-semibold leading-none tracking-heading">skanor</span>
          </span>
          <ol aria-label="Progress" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {onboardingSteps.map((t, i) => (
              <li
                key={t}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "tabular border px-2.5 py-2 text-[11px]",
                  i === step && "border-ink bg-ink text-white",
                  i < step && "border-ink bg-white text-ink",
                  i > step && "border-line bg-transparent text-muted",
                )}
              >
                0{i + 1} {t}
              </li>
            ))}
          </ol>
          {verified ? (
            <Link href="/app/dashboard" className="tabular py-3 text-xs text-graphite no-underline hover:text-ink">
              SKIP SETUP
            </Link>
          ) : (
            <span className="hidden w-[84px] sm:block" aria-hidden="true" />
          )}
        </div>
      </header>

      <main id="main" className="flex flex-1 justify-center px-5 py-[clamp(32px,6vw,72px)]">
        <div className="flex w-full max-w-[760px] flex-col gap-7">
          {step === 0 && (
            <div className="flex max-w-[440px] flex-col gap-[22px]">
              <span className={eyebrow}>STEP 1 OF 5</span>
              <h1 ref={heading} tabIndex={-1} className={cn(h1, "outline-none")}>
                Enter the code we sent on WhatsApp
              </h1>
              <p className="m-0 text-graphite">
                Sent to {initial.phoneMasked} ·{" "}
                <Link href={initial.mode === "login" ? "/login" : "/signup"} className="underline underline-offset-2">
                  Change
                </Link>
              </p>
              {devCode ? (
                <p role="note" className="m-0 border border-dashed border-track bg-white px-3 py-2 text-xs text-graphite">
                  Development mode: your code is <strong className="tabular text-ink">{devCode}</strong>. This box never appears in production.
                </p>
              ) : null}
              <OtpInput value={otp} onChange={setOtp} onComplete={(c) => verify(c)} disabled={busy} invalid={Boolean(error)} />
              {resendIn > 0 ? (
                <span className="tabular text-xs text-muted" aria-live="off">
                  Resend in {mmss(resendIn)}
                </span>
              ) : (
                <button type="button" onClick={resend} className="tabular self-start py-2 text-xs text-ink underline underline-offset-2">
                  Resend code
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <span className={eyebrow}>STEP 2 OF 5</span>
              <h1 ref={heading} tabIndex={-1} className={cn(h1, "outline-none")}>
                What kind of business do you run?
              </h1>
              <p className="m-0 text-graphite">We&rsquo;ll switch on the right modules and templates for you.</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2.5">
                {industryOptions.map((i) => {
                  const on = industry === i.key;
                  return (
                    <button
                      key={i.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setIndustry(i.key)}
                      className={cn(
                        "box-border flex min-h-24 flex-col items-start gap-2.5 p-4 text-left text-ink transition-colors",
                        on ? "border-2 border-ink bg-info-bg" : "border border-line bg-white hover:bg-paper",
                      )}
                    >
                      <PathIcon d={i.icon} size={22} />
                      <span className="text-sm font-semibold">{i.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <span className={eyebrow}>STEP 3 OF 5</span>
              <h1 ref={heading} tabIndex={-1} className={cn(h1, "outline-none")}>
                What should your QR codes do first?
              </h1>
              <p className="m-0 text-graphite">
                Recommended for {industryLabel}. Pick as many as you like — you can add more later.
              </p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">
                {goalOptions.map((g) => {
                  const on = goals.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setGoals((cur) => (on ? cur.filter((k) => k !== g.key) : [...cur, g.key]))}
                      className={cn(
                        "box-border flex min-h-16 items-center gap-2.5 p-4 text-left text-ink transition-colors",
                        on ? "border-2 border-ink bg-info-bg" : "border border-line bg-white hover:bg-paper",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("box-border flex h-5 w-5 flex-none items-center justify-center border-2 border-ink", on ? "bg-ink" : "bg-white")}
                      >
                        {on ? <PathIcon d="M5 12l5 5 9-10" size={12} strokeWidth={3} className="text-white" /> : null}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{g.label}</span>
                        <span className="tabular text-[10px] text-muted">{g.level}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex max-w-[560px] flex-col gap-5">
              <span className={eyebrow}>STEP 4 OF 5</span>
              <h1 ref={heading} tabIndex={-1} className={cn(h1, "outline-none")}>
                Add your first location
              </h1>
              <Input
                label="Location name"
                name="locationName"
                placeholder="e.g. Anna Nagar, Chennai"
                autoComplete="off"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                labelClassName={captionLabel}
                className={bigControl}
              />
              <Input
                label="Address"
                name="address"
                placeholder="Street, area, city"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                labelClassName={captionLabel}
                className={bigControl}
              />
              {[
                { t: "Connect Google Business Profile", d: "Needed for the review link and review inbox.", b: "Connect" },
                { t: "Upload your logo", d: "We'll use it on QR codes and scan pages.", b: "Upload" },
              ].map((c) => (
                <div key={c.t} className="flex flex-wrap items-center justify-between gap-3.5 border border-line bg-white p-[18px]">
                  <div>
                    <div className="text-[15px] font-semibold">{c.t}</div>
                    <div className="mt-[3px] text-[13px] text-graphite">{c.d}</div>
                  </div>
                  <Button onClick={() => setConnectNote("You can do this after setup, from Integrations and Settings.")}>{c.b}</Button>
                </div>
              ))}
              {connectNote ? (
                <p role="status" className="m-0 text-xs text-muted">
                  {connectNote}
                </p>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-wrap items-center gap-10">
              <div className="flex flex-col items-center gap-3 border border-line bg-white p-5">
                <QRMark value={initial.scanUrl} variant="dot" size={200} quiet={false} label="Your test QR code" />
                <span className="tabular bg-ink px-3 py-1.5 text-[11px] text-white">SCAN TO REVIEW US</span>
              </div>
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                <span className={eyebrow}>STEP 5 OF 5 · YOU&rsquo;RE LIVE</span>
                <h1 ref={heading} tabIndex={-1} className={cn(h1, "outline-none")}>
                  Your first QR is ready.
                </h1>
                <p className="m-0 leading-[1.55] text-graphite">
                  We&rsquo;ve lined up {goals.length} {goals.length === 1 ? "flow" : "flows"} for your {industryLabel} workspace. Scan this with
                  your phone to test it.
                </p>
                <p className="m-0 text-xs text-muted">This test code opens a sample page. Your real short links start in QR Studio.</p>
                <div className="flex flex-wrap gap-2.5">
                  <Link href="/app/dashboard" className={buttonClasses({ variant: "primary" })}>
                    Go to dashboard
                  </Link>
                  <Link href="/app/library" className={buttonClasses()}>
                    Download &amp; print
                  </Link>
                </div>
              </div>
            </div>
          )}

          {fieldNote ? (
            <p role="alert" className="m-0 text-sm text-danger-fg">
              {fieldNote}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="m-0 text-sm text-danger-fg">
              {error}
            </p>
          ) : null}

          <div className="flex justify-between gap-3 border-t border-line pt-5">
            <Button
              onClick={() => {
                setError("");
                setFieldNote("");
                setStep((s) => Math.max(backFloor, s - 1));
              }}
              className={step <= backFloor ? "invisible" : undefined}
              aria-hidden={step <= backFloor || undefined}
              tabIndex={step <= backFloor ? -1 : undefined}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button variant="primary" onClick={next} disabled={busy}>
                {busy ? "Please wait…" : nextLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
