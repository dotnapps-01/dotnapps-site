"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";

/** Attendance rules. The late grace period is live; the others show what is on, or what needs Integrations. */
export function RulesForm({ lateAfterMin }: { lateAfterMin: number }) {
  const router = useRouter();
  const [v, setV] = useState(String(lateAfterMin));
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/attendance/rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ lateAfterMin: v }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      setMsg("Saved.");
      router.refresh();
    } else setError(j.fields?.lateAfterMin ?? "We couldn't save that. Please try again.");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules</CardTitle>
      </CardHeader>
      <form onSubmit={save} noValidate aria-label="Attendance rules" className="flex flex-col gap-3.5 px-[18px] pb-4 pt-3">
        <Input label="Late after (minutes past shift start)" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} error={error} labelClassName="text-[11px] font-medium uppercase tracking-[0.05em] text-graphite" className="min-h-10 text-sm" />
        <div className="flex items-center gap-2.5">
          <Button size="sm" type="submit" variant="primary">
            Save
          </Button>
          {msg ? (
            <span role="status" className="text-sm text-graphite">
              {msg}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-line-soft pt-3 text-[13px]">
          <Toggle label="Location must be inside the geofence (set per check-in point)" checked disabled />
          <Toggle label="Selfie at check-in (needs photo storage)" checked={false} disabled />
          <Toggle label="Daily summary to owner on WhatsApp (needs Integrations)" checked={false} disabled />
        </div>
      </form>
    </Card>
  );
}
