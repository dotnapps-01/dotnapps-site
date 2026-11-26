"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AlertStatus } from "@/lib/products";

/** A small button that PATCHes something and refreshes the list. */
function useAct(url: string) {
  const router = useRouter();
  const [err, setErr] = useState("");
  return {
    err,
    run: async (body?: unknown) => {
      setErr("");
      const res = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }).catch(() => null);
      if (res?.ok) router.refresh();
      else setErr("Couldn't update that.");
    },
  };
}

export function MarkInMarket({ id, label }: { id: string; label: string }) {
  const a = useAct(`/api/products/batches/${id}`);
  return (
    <>
      <Button size="sm" aria-label={`Mark ${label} as in market`} onClick={() => a.run()}>
        Mark in market
      </Button>
      {a.err ? <span role="alert" className="text-xs text-danger-fg">{a.err}</span> : null}
    </>
  );
}

export function WarrantyActions({ id, who }: { id: string; who: string }) {
  const a = useAct(`/api/products/warranty/${id}`);
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="primary" aria-label={`Verify warranty for ${who}`} onClick={() => a.run({ status: "verified" })}>
        Verify
      </Button>
      <Button size="sm" aria-label={`Reject warranty for ${who}`} onClick={() => a.run({ status: "rejected" })}>
        Reject
      </Button>
      {a.err ? <span role="alert" className="text-xs text-danger-fg">{a.err}</span> : null}
    </div>
  );
}

export function AlertActions({ id, serial, status }: { id: string; serial: string; status: AlertStatus }) {
  const a = useAct(`/api/products/alerts/${id}`);
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "new" ? (
        <Button size="sm" aria-label={`Investigate ${serial}`} onClick={() => a.run({ status: "investigating" })}>
          Investigate
        </Button>
      ) : null}
      {status === "new" || status === "investigating" ? (
        <>
          <Button size="sm" aria-label={`Confirm ${serial} as a fake`} onClick={() => a.run({ status: "confirmed" })}>
            Confirm fake
          </Button>
          <Button size="sm" aria-label={`Dismiss alert for ${serial}`} onClick={() => a.run({ status: "dismissed" })}>
            Dismiss
          </Button>
        </>
      ) : null}
      {a.err ? <span role="alert" className="text-xs text-danger-fg">{a.err}</span> : null}
    </div>
  );
}
