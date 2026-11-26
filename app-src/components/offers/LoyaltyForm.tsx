"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import type { ProgramRecord } from "@/lib/engage";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

/** Loyalty programme settings with a live preview of the stamp card. */
export function LoyaltyForm({ program, business }: { program: ProgramRecord | null; business: string }) {
  const router = useRouter();
  const [name, setName] = useState(program?.name ?? "Loyalty card");
  const [needed, setNeeded] = useState(String(program?.stampsNeeded ?? 10));
  const [reward, setReward] = useState(program?.reward ?? "");
  const [pin, setPin] = useState("");
  const [expires, setExpires] = useState(program?.expiresMonths ? String(program.expiresMonths) : "");
  const [active, setActive] = useState(program?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Math.min(30, Math.max(2, Number(needed) || 10));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/loyalty", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, stampsNeeded: needed, reward, pin, expiresMonths: expires || null, active }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setErrors({});
      setPin("");
      setMsg({ tone: "ok", text: "Saved. Your loyalty QR codes use these settings now." });
      router.refresh();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg({ tone: "error", text: "Please fix the highlighted fields." });
    } else setMsg({ tone: "error", text: "We couldn't save that. Please try again." });
  }

  return (
    <form onSubmit={save} noValidate aria-label="Loyalty programme settings" className="flex flex-wrap gap-6 p-5">
      <div aria-hidden="true" className="flex max-w-full flex-[0_0_280px] flex-col gap-4 bg-ink p-5 text-white">
        <div className="flex justify-between gap-2">
          <span className="disp text-lg">{name || "Loyalty card"}</span>
          <span className="tabular truncate text-[10px] text-lilac">{business.toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className={`flex aspect-square items-center justify-center rounded-full border-[1.5px] ${i < Math.ceil(n * 0.7) ? "border-lilac bg-lilac" : "border-[#4A4A52]"}`}>
              {i < Math.ceil(n * 0.7) ? <Check size={14} strokeWidth={3} className="text-ink" /> : null}
            </div>
          ))}
        </div>
        <div className="tabular text-[11px] text-[#B8B8C0]">
          PREVIEW · {reward ? reward.toUpperCase() : "YOUR REWARD"} AT {n}
        </div>
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3.5">
          <Input label="Programme name" value={name} onChange={(e) => setName(e.target.value)} labelClassName={label} className={control} />
          <Input label="Stamps needed" inputMode="numeric" value={needed} onChange={(e) => setNeeded(e.target.value)} error={errors.stampsNeeded} labelClassName={label} className={control} />
          <Input label="Reward" value={reward} onChange={(e) => setReward(e.target.value)} error={errors.reward} placeholder="1 free filter coffee" labelClassName={label} className={control} />
          <Select label="Stamp rule" disabled labelClassName={label} className={control} hint="1 per ₹ spent arrives with Digital bills.">
            <option>1 per visit, max 1 per day</option>
          </Select>
          <Input
            label="Staff PIN (4 digits)"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            error={errors.pin}
            hint={program?.hasPin ? "A PIN is set. Leave blank to keep it." : "Required. Only your team should know it."}
            labelClassName={label}
            className={control}
          />
          <Select label="Card expires" value={expires} onChange={(e) => setExpires(e.target.value)} labelClassName={label} className={control}>
            <option value="">Never</option>
            <option value="6">6 months without a stamp</option>
            <option value="12">12 months without a stamp</option>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 border border-line-soft px-3.5 py-3">
          <div>
            <div className="text-[13.5px] font-semibold">Programme is live</div>
            <div className="text-xs text-muted">Turn off to stop new stamps. Existing cards keep their stamps.</div>
          </div>
          <Toggle aria-label="Programme is live" checked={active} onCheckedChange={setActive} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : program ? "Save programme" : "Create programme"}
          </Button>
          {msg ? (
            <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "m-0 text-sm text-danger-fg" : "m-0 text-sm text-success-fg"}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
