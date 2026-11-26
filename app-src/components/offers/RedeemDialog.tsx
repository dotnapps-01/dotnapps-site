"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import type { CodeLookup } from "@/lib/engage";

/** "Redeem a code": staff type the code a customer shows, check it, and mark it used (works once). */
export function RedeemDialog() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<CodeLookup | null>(null);
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
    const res = await fetch("/api/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, confirm }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setFound(j.lookup);
      if (confirm) {
        setMsg({ tone: "ok", text: "Redeemed. That code can't be used again." });
        router.refresh();
      }
    } else {
      setFound(null);
      setMsg({ tone: "error", text: j.error === "not_found" ? "We can't find that code." : j.error === "expired" ? "That code has expired." : j.error === "redeemed" ? "That code was already used." : "Something went wrong. Please try again." });
    }
  }

  const lookup = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) call(false);
  };

  return (
    <>
      <Button onClick={open}>Redeem a code</Button>
      <dialog ref={ref} aria-labelledby="redeem-h" className="w-[min(92vw,440px)] rounded-card border border-line bg-white p-0 text-ink backdrop:bg-ink/40">
        <form onSubmit={lookup} className="flex flex-col gap-3.5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="redeem-h" className="m-0 font-display text-xl font-semibold tracking-sub">
              Redeem a code
            </h2>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mist">
              ×
            </button>
          </div>
          <p className="m-0 text-sm text-graphite">Enter the code the customer shows: a coupon (like SKN-7K2Q) or a loyalty reward (RWD-…).</p>
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" autoFocus className="tabular min-h-11 text-base tracking-[0.08em]" />
          <Button type="submit" disabled={busy || !code.trim()}>
            Check code
          </Button>
          {found ? (
            <div role="status" className="flex flex-col gap-2 rounded-input border border-line bg-paper p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{found.detail}</span>
                <Pill tone={found.status === "valid" ? "success" : found.status === "expired" ? "warning" : "neutral"}>{found.status.toUpperCase()}</Pill>
              </div>
              <div className="text-[15px] font-semibold">{found.label}</div>
              <div className="tabular text-xs text-muted">
                {found.phone.slice(0, 3)}
                {"x".repeat(Math.max(0, found.phone.length - 6))}
                {found.phone.slice(-3)}
                {found.expiresAt ? ` · valid till ${new Date(found.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
              </div>
              {found.status === "valid" ? (
                <Button variant="primary" onClick={() => call(true)} disabled={busy}>
                  Mark as redeemed
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
