"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";

/** A platform switch. Flipping it takes effect for everyone at once. */
export function FlagToggle({ flagKey, label, enabled }: { flagKey: string; label: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [err, setErr] = useState("");
  async function change(next: boolean) {
    setErr("");
    setOn(next);
    const res = await fetch("/api/admin/flags", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: flagKey, enabled: next }) }).catch(() => null);
    if (res?.ok) router.refresh();
    else {
      setOn(!next);
      setErr("Couldn't change that.");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Toggle aria-label={label} checked={on} onCheckedChange={change} />
      {err ? (
        <span role="alert" className="text-xs text-danger-fg">
          {err}
        </span>
      ) : null}
    </div>
  );
}
