"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { industryOptions } from "@/lib/content/onboarding";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const LANGS = [
  { key: "en", label: "English" },
  { key: "ta", label: "தமிழ் (Tamil)" },
  { key: "hi", label: "हिन्दी (Hindi)" },
];

/** Business name, category, GSTIN and the language scan pages open in when a phone matches none. */
export function ProfileForm({ initial }: { initial: { name: string; industry: string; gstin: string; defaultLang: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErrors({});
    const res = await fetch("/api/settings/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg("Saved.");
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label="Business profile" className="flex flex-col gap-3.5 p-[18px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5">
        <Input label="Business name" value={v.name} onChange={set("name")} error={errors.name} labelClassName={label} className={control} />
        <Select label="Category" value={v.industry} onChange={set("industry")} error={errors.industry} labelClassName={label} className={control}>
          <option value="">Not set</option>
          {industryOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input label="GSTIN (optional)" value={v.gstin} onChange={(e) => setV((x) => ({ ...x, gstin: e.target.value.toUpperCase() }))} error={errors.gstin} placeholder="[GSTIN]" maxLength={15} labelClassName={label} className={control} />
        <Select label="Default language on scan pages" value={v.defaultLang} onChange={set("defaultLang")} error={errors.defaultLang} hint="Used when the customer's phone is set to none of English, Tamil or Hindi." labelClassName={label} className={control}>
          {LANGS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
        {msg ? (
          <p role="status" className="m-0 text-sm text-graphite">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}
