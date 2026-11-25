"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { bigControl, captionLabel } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { PhoneField } from "./PhoneField";

export const DEV_OTP_KEY = "skn_dev_otp";

type Mode = "signup" | "login";

const copy = {
  signup: { title: "Create your free account", sub: "Your first QR is 2 minutes away." },
  login: { title: "Welcome back", sub: "Log in with the mobile number you signed up with." },
} as const;

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 000 9.2z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 003.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" fill="#EA4335" />
    </svg>
  );
}

/** Sign-up / log-in form (design/SignUp.dc.html). Sends a WhatsApp OTP, then continues in /onboarding. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ businessName?: string; phone?: string }>({});
  const [formError, setFormError] = useState("");
  const [googleNote, setGoogleNote] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const found: typeof errors = {};
    if (mode === "signup" && businessName.trim().length < 2) found.businessName = "Enter your business name.";
    if (phone.replace(/\D/g, "").length < 10) found.phone = "Enter a valid 10-digit Indian mobile number.";
    setErrors(found);
    if (found.businessName || found.phone) {
      (e.currentTarget as HTMLFormElement).querySelector<HTMLElement>(found.businessName ? "[name=businessName]" : "[name=phone]")?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, phone, businessName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          if (data.devCode) sessionStorage.setItem(DEV_OTP_KEY, data.devCode);
          else sessionStorage.removeItem(DEV_OTP_KEY);
        } catch {}
        router.push("/onboarding");
        return;
      }
      if (res.status === 422 && data.fields) setErrors({ businessName: data.fields.businessName, phone: data.fields.phone });
      else if (res.status === 429) setFormError(`Please wait ${data.retryAfter ?? 30} seconds before asking for another code.`);
      else if (res.status === 503) setFormError("WhatsApp codes aren't set up on this server yet. Please try again later.");
      else setFormError("We couldn't send the code. Please try again.");
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    }
    setSending(false);
  }

  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "tabular flex min-h-11 items-center justify-center text-xs no-underline transition-colors",
        on ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mist",
      )}
    >
      {label}
    </Link>
  );

  return (
    <form aria-label={mode === "signup" ? "Create account" : "Log in"} noValidate onSubmit={onSubmit} className="flex w-full max-w-[420px] flex-col gap-[18px]">
      <nav aria-label="Account" className="grid grid-cols-2 border border-ink">
        {tab("/signup", "SIGN UP", mode === "signup")}
        {tab("/login", "LOG IN", mode === "login")}
      </nav>
      <div>
        <h1 className="m-0 font-display text-[clamp(32px,8vw,40px)] font-semibold leading-[1.05] tracking-display">{copy[mode].title}</h1>
        <p className="mb-0 mt-2 text-[15px] text-graphite">{copy[mode].sub}</p>
      </div>

      <Button type="button" className="w-full" onClick={() => setGoogleNote(true)}>
        <GoogleMark />
        Continue with Google
      </Button>
      {googleNote ? (
        <p role="status" className="m-0 -mt-2 text-xs text-muted">
          Google sign-in isn&rsquo;t set up yet. Please use your mobile number.
        </p>
      ) : null}

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="tabular text-[11px] text-muted">OR WITH MOBILE</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {mode === "signup" ? (
        <Input
          label="Business name"
          name="businessName"
          type="text"
          autoComplete="organization"
          placeholder="e.g. Saravana Cafe"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          error={errors.businessName}
          labelClassName={captionLabel}
          className={bigControl}
        />
      ) : null}
      <PhoneField value={phone} onChange={setPhone} error={errors.phone} />

      <Button type="submit" variant="primary" className="w-full" disabled={sending}>
        {sending ? "Sending…" : "Send OTP on WhatsApp"}
      </Button>
      {formError ? (
        <p role="alert" className="m-0 text-xs text-danger-fg">
          {formError}
        </p>
      ) : null}
      <p className="m-0 text-xs leading-[1.5] text-muted">By continuing you agree to the Terms and Privacy Policy.</p>
    </form>
  );
}
