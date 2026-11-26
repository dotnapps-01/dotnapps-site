"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import type { GateLookup } from "@/lib/bookings";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** "Open gate scanner": type or scan-in the code on a ticket or booking, check it, and let the person in (works once). */
export function GateScanner() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<GateLookup | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = () => {
    setCode("");
    setFound(null);
    setMsg(null);
    ref.current?.showModal();
  };

  async function call(confirm: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, confirm }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setFound(j.lookup);
      if (confirm) {
        setMsg({ tone: "ok", text: "Checked in. Let them through." });
        router.refresh();
      }
    } else {
      setFound(j.lookup ?? null);
      setMsg({ tone: "error", text: j.error === "not_found" ? "We can't find that code." : j.error === "cancelled" ? "That booking was cancelled." : j.error === "already" ? "That code was already checked in." : "Something went wrong. Please try again." });
    }
  }

  const lookup = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) call(false);
  };

  return (
    <>
      <Button onClick={open}>Open gate scanner</Button>
      <dialog ref={ref} aria-labelledby="gate-h" className="w-[min(92vw,440px)] rounded-card border border-line bg-white p-0 text-ink backdrop:bg-ink/40">
        <form onSubmit={lookup} className="flex flex-col gap-3.5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="gate-h" className="m-0 font-display text-xl font-semibold tracking-sub">
              Gate scanner
            </h2>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mist">
              ×
            </button>
          </div>
          <p className="m-0 text-sm text-graphite">Enter the code on the customer&rsquo;s ticket or booking (like EV-7K2QXM or BK-…). A handheld QR scanner that types into this box works too.</p>
          <Input label="Ticket code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" autoFocus className="tabular min-h-11 text-base tracking-[0.08em]" />
          <Button type="submit" disabled={busy || !code.trim()}>
            Check code
          </Button>
          {found ? (
            <div role="status" className="flex flex-col gap-2 rounded-input border border-line bg-paper p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{found.item}</span>
                <Pill tone={found.state === "valid" ? "success" : found.state === "already" ? "warning" : "danger"}>{found.state === "valid" ? "VALID" : found.state === "already" ? "ALREADY IN" : "NOT VALID"}</Pill>
              </div>
              <div className="text-[15px] font-semibold">{`${found.name} · ${found.qty} ${found.qty === 1 ? "ticket" : "tickets"}`}</div>
              <div className="tabular text-xs text-muted">{found.checkedInAt ? `Checked in ${when(found.checkedInAt)}` : when(found.startsAt)}</div>
              {found.state === "valid" ? (
                <Button variant="primary" onClick={() => call(true)} disabled={busy}>
                  Check in
                </Button>
              ) : null}
            </div>
          ) : null}
          {msg ? (
            <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "m-0 text-sm text-danger-fg" : "m-0 text-sm text-success-fg"}>
              {msg.text}
            </p>
          ) : null}
        </form>
      </dialog>
    </>
  );
}
