"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import type { VisitorRecord, VisitorStatus } from "@/lib/attendance";
import { maskPhone } from "@/lib/ops-input";

const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "—");
const STATUS: Record<VisitorStatus, { tone: PillTone; text: string }> = {
  awaiting: { tone: "warning", text: "AWAITING" },
  approved: { tone: "info", text: "APPROVED" },
  declined: { tone: "danger", text: "DECLINED" },
  on_site: { tone: "success", text: "ON SITE" },
  checked_out: { tone: "neutral", text: "CHECKED OUT" },
};

/** The visitor log: approve a pass request, then check the visitor in and out at the gate. */
export function VisitorLog({ visitors }: { visitors: VisitorRecord[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  async function act(id: string, action: "approve" | "decline" | "in" | "out") {
    setMsg("");
    const res = await fetch(`/api/visitors/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    if (res?.ok) router.refresh();
    else setMsg(res?.status === 409 ? "That visitor's status already changed or the pass expired. Refreshing." : "Couldn't update that visitor.");
    if (res?.status === 409) router.refresh();
  }
  return (
    <>
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pt-3 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      <Table caption="Visitor log">
        <TableHead>
          <TableRow>
            <Th>Visitor</Th>
            <Th>Purpose</Th>
            <Th>Host</Th>
            <Th>In</Th>
            <Th>Out</Th>
            <Th>Pass</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {visitors.length === 0 ? (
            <TableRow>
              <Td colSpan={7} className="text-muted">
                No visitors yet. They appear when someone scans your Visitor pass QR code.
              </Td>
            </TableRow>
          ) : (
            visitors.map((v) => {
              const s = v.expired ? { tone: "neutral" as PillTone, text: "EXPIRED" } : STATUS[v.status];
              return (
                <TableRow key={v.id} data-visitor={v.id} data-name={v.name}>
                  <Td>
                    <div className="font-semibold">{v.name}</div>
                    <div className="tabular text-[11px] text-muted">{maskPhone(v.phone)}</div>
                  </Td>
                  <Td>{v.purpose}</Td>
                  <Td>{v.host}</Td>
                  <Td className="tabular">{hm(v.inAt)}</Td>
                  <Td className="tabular">{hm(v.outAt)}</Td>
                  <Td>
                    <Pill tone={s.tone}>{s.text}</Pill>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      {v.status === "awaiting" ? (
                        <>
                          <Button size="sm" variant="primary" aria-label={`Approve ${v.name}`} onClick={() => act(v.id, "approve")}>
                            Approve
                          </Button>
                          <Button size="sm" aria-label={`Decline ${v.name}`} onClick={() => act(v.id, "decline")}>
                            Decline
                          </Button>
                        </>
                      ) : null}
                      {v.status === "approved" && !v.expired ? (
                        <Button size="sm" aria-label={`Check in ${v.name}`} onClick={() => act(v.id, "in")}>
                          Check in
                        </Button>
                      ) : null}
                      {v.status === "on_site" ? (
                        <Button size="sm" aria-label={`Check out ${v.name}`} onClick={() => act(v.id, "out")}>
                          Check out
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </>
  );
}
