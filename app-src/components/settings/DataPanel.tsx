"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EXPORTS, RETENTION } from "@/lib/settings-input";

/** Keep-for period, CSV exports and deleting the workspace. */
export function DataPanel({ keep, businessName, canRetain, canDelete }: { keep: string; businessName: string; canRetain: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(keep);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [delError, setDelError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    const cur = RETENTION.find((r) => r.value === value);
    if (cur && cur.value !== "forever" && cur.value !== keep && !window.confirm(`Scans and leads older than ${cur.label} will be deleted now. Continue?`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings/retention", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ keep: value }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg(j.removed && j.removed.scans + j.removed.leads > 0 ? `Saved. Removed ${j.removed.scans} scans and ${j.removed.leads} leads.` : "Saved.");
      router.refresh();
    } else setMsg("We couldn't save that. Please try again.");
  }

  async function del(e: FormEvent) {
    e.preventDefault();
    setDelError("");
    const res = await fetch("/api/settings/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else setDelError(j.fields?.confirm ?? "We couldn't delete the workspace.");
  }

  return (
    <div className="flex flex-col gap-4 p-[18px]">
      <p className="m-0 text-[13px] leading-[1.6] text-graphite">Customer data collected through your QR pages belongs to you. Export it any time, or set how long scans and leads are kept.</p>
      {canRetain ? (
      <form onSubmit={save} aria-label="Data retention" className="flex flex-col gap-2.5">
        <Select label="Keep scan and lead data for" value={value} onChange={(e) => setValue(e.target.value)} labelClassName="text-[11px] font-medium uppercase tracking-[0.05em] text-graphite" className="min-h-10 text-sm">
          {RETENTION.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2.5">
          <Button type="submit" size="sm" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          {msg ? (
            <span role="status" className="text-sm text-graphite">
              {msg}
            </span>
          ) : null}
        </div>
      </form>
      ) : null}
      <div>
        <div className="k mb-2">Export (CSV)</div>
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map((x) => (
            <a key={x.key} href={`/api/export/${x.key}`} download className={buttonClasses({ size: "sm" })}>
              {`Export ${x.label.toLowerCase()}`}
            </a>
          ))}
        </div>
      </div>
      {canDelete ? (
        <div className="border-t border-line-soft pt-4">
          <Button onClick={() => { setTyped(""); setDelError(""); dlg.current?.showModal(); }} className="border-[#F2C7C0] text-danger-fg">
            Delete workspace
          </Button>
          <dialog ref={dlg} aria-labelledby="del-h" className="w-[min(92vw,440px)] rounded-card border border-line bg-white p-0 text-ink backdrop:bg-ink/40">
            <form onSubmit={del} className="flex flex-col gap-3.5 p-5">
              <h2 id="del-h" className="m-0 font-display text-xl font-semibold tracking-sub">
                Delete this workspace?
              </h2>
              <p className="m-0 text-sm text-graphite">This removes your QR codes, scans, leads, tickets, bookings, products and every other record. It can&rsquo;t be undone. Export anything you want to keep first.</p>
              <Input label={`Type “${businessName}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} error={delError} autoComplete="off" className="min-h-10 text-sm" />
              <div className="flex gap-2">
                <Button type="submit" className="border-danger-fg bg-danger-fg text-white hover:bg-danger-fg hover:text-white" disabled={!typed.trim()}>
                  Delete everything
                </Button>
                <Button onClick={() => dlg.current?.close()}>Cancel</Button>
              </div>
            </form>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
