"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { demoInterests } from "@/lib/content/contact";
import {
  businessTypes,
  locationCounts,
  validateDemoRequest,
  type DemoRequest,
  type DemoRequestErrors,
} from "@/lib/demo-request";
import { Mono } from "./parts";

type Status = "idle" | "sending" | "sent" | "failed" | "unavailable";

// The design's contact fields: 12px caps labels, 46px controls, slightly darker border.
const label = "text-xs font-medium uppercase tracking-[0.04em] text-graphite";
const control = "min-h-[46px] border-track text-[15px]";

export function DemoForm() {
  const [errors, setErrors] = useState<DemoRequestErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const statusId = useId();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: DemoRequest = {
      name: String(fd.get("name") ?? ""),
      whatsapp: String(fd.get("whatsapp") ?? ""),
      email: String(fd.get("email") ?? ""),
      businessType: String(fd.get("businessType") ?? ""),
      locations: String(fd.get("locations") ?? ""),
      interests: fd.getAll("interests").map(String),
      notes: String(fd.get("notes") ?? ""),
    };
    const found = validateDemoRequest(data);
    setErrors(found);
    if (Object.keys(found).length) {
      // move focus to the first invalid field
      const first = (["name", "whatsapp", "email"] as const).find((k) => found[k]);
      if (first) e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, website: String(fd.get("website") ?? "") }),
      });
      setStatus(res.ok ? "sent" : res.status === 503 ? "unavailable" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-3 bg-white p-[clamp(32px,5vw,64px)]">
        <h2 className="m-0 font-display text-[28px] font-semibold tracking-display">Thanks, we have your request.</h2>
        <p className="m-0 text-[15px] leading-[1.6] text-graphite">We reply on WhatsApp within one working day.</p>
      </div>
    );
  }

  return (
    <form
      aria-label="Book a demo"
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-[18px] bg-white p-[clamp(32px,5vw,64px)]"
    >
      <h2 className="mb-1 mt-0 font-display text-[28px] font-semibold tracking-display">Book a demo</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
        <Input label="Full name" name="name" type="text" autoComplete="name" error={errors.name} labelClassName={label} className={control} />
        <Input
          label="WhatsApp number"
          name="whatsapp"
          type="tel"
          autoComplete="tel"
          placeholder="+91"
          error={errors.whatsapp}
          labelClassName={label}
          className={control}
        />
      </div>
      <Input label="Work email" name="email" type="email" autoComplete="email" error={errors.email} labelClassName={label} className={control} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
        <Select label="Business type" name="businessType" labelClassName={label} className={control}>
          {businessTypes.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
        <Select label="Number of locations" name="locations" labelClassName={label} className={control}>
          {locationCounts.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <legend className={`${label} mb-2.5 p-0`}>Interested in</legend>
        <div className="flex flex-wrap gap-2">
          {demoInterests.map((i) => (
            <label
              key={i}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-line px-3 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-mist"
            >
              <input type="checkbox" name="interests" value={i} className="h-4 w-4 accent-ink" />
              {i}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea label="Anything we should know?" name="notes" rows={4} labelClassName={label} className="border-track text-[15px]" />
      {/* honeypot: hidden from people and screen readers, bots fill it */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Request demo"}
      </Button>
      <p id={statusId} role="status" className="m-0 text-xs text-danger-fg empty:hidden">
        {status === "failed" ? "Something went wrong sending your request. Please try again." : null}
        {status === "unavailable" ? "Demo requests aren't connected yet. Please contact us directly using the details on this page." : null}
      </p>
      <Mono className="text-[11px] text-muted">We reply on WhatsApp within one working day.</Mono>
    </form>
  );
}
