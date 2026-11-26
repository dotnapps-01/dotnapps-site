"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { TableRow, Td } from "@/components/ui/Table";
import type { BookingRecord } from "@/lib/bookings";
import { maskPhone, type BookingStatus } from "@/lib/ops-input";

export const BOOKING_PILL: Record<BookingStatus, { tone: PillTone; text: string }> = {
  pending: { tone: "warning", text: "PENDING" },
  confirmed: { tone: "success", text: "CONFIRMED" },
  completed: { tone: "neutral", text: "COMPLETED" },
  no_show: { tone: "danger", text: "NO-SHOW" },
  cancelled: { tone: "neutral", text: "CANCELLED" },
};
const NEXT: Record<BookingStatus, { to: BookingStatus; label: string }[]> = {
  pending: [{ to: "confirmed", label: "Confirm" }, { to: "cancelled", label: "Cancel" }],
  confirmed: [{ to: "completed", label: "Complete" }, { to: "no_show", label: "No-show" }, { to: "cancelled", label: "Cancel" }],
  completed: [],
  no_show: [{ to: "confirmed", label: "Reinstate" }],
  cancelled: [],
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** One row in the bookings table, with the moves that make sense from its current status. */
export function BookingRow({ b }: { b: BookingRecord }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  async function move(status: BookingStatus) {
    setErr("");
    const res = await fetch(`/api/bookings/${b.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (res?.ok) router.refresh();
    else {
      setErr("Couldn't change that. It may already have changed.");
      router.refresh();
    }
  }
  return (
    <TableRow data-booking={b.id} data-name={b.name}>
      <Td className="tabular">{when(b.startsAt)}</Td>
      <Td>
        <div className="font-semibold">{b.name}</div>
        <div className="tabular text-[11px] text-muted">{maskPhone(b.phone)}</div>
      </Td>
      <Td>
        {b.itemName}
        {b.kind === "event" ? <span className="text-muted">{` · ${b.qty} ticket${b.qty === 1 ? "" : "s"}`}</span> : null}
      </Td>
      <Td>{b.staff || "—"}</Td>
      <Td>
        <Pill tone={BOOKING_PILL[b.status].tone}>{BOOKING_PILL[b.status].text}</Pill>
        {b.checkedInAt ? <span className="ml-1.5 text-[11px] text-success-fg">checked in</span> : null}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1.5">
          {NEXT[b.status].map((n) => (
            <Button key={n.to} size="sm" aria-label={`${n.label} booking for ${b.name}`} onClick={() => move(n.to)}>
              {n.label}
            </Button>
          ))}
        </div>
        {err ? (
          <p role="alert" className="m-0 mt-1 text-xs text-danger-fg">
            {err}
          </p>
        ) : null}
      </Td>
    </TableRow>
  );
}
