"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/engage-input";

const TEMPLATE = "data:text/csv;charset=utf-8," + encodeURIComponent("name,phone,email,tags\nAnanya R.,98765 43210,ananya@example.com,VIP;Loyalty\n");

/** CSV import: parsed in the browser, then sent as rows. Needs a phone column; name, email and tags are optional. */
export function ContactImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setMsg(null);
    setRows(null);
    if (!file) return;
    if (file.size > 1_000_000) return setMsg({ tone: "error", text: "That file is over 1 MB. Split it into smaller files." });
    const parsed = parseCsv(await file.text());
    setFileName(file.name);
    if (parsed.length === 0) return setMsg({ tone: "error", text: "No rows found. The first row must be a header with at least a “phone” column." });
    if (!("phone" in parsed[0])) return setMsg({ tone: "error", text: "There's no “phone” column in the header row." });
    setRows(parsed);
  }

  async function upload() {
    if (!rows) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/contacts/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: rows.map((r) => ({ name: r.name, phone: r.phone, email: r.email, tags: r.tags })) }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ tone: "ok", text: `${j.added} added, ${j.updated} already existed${j.skipped?.length ? `, ${j.skipped.length} skipped (e.g. line ${j.skipped[0].line}: ${j.skipped[0].reason})` : ""}.` });
        setRows(null);
        if (input.current) input.current.value = "";
        router.refresh();
      } else setMsg({ tone: "error", text: j.message ?? "The import failed. Please try again." });
    } catch {
      setMsg({ tone: "error", text: "We couldn't reach the server. Please try again." });
    }
    setBusy(false);
  }

  return (
    <section id="import" aria-labelledby="import-h" className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3.5">
      <h3 id="import-h" className="m-0 font-sans text-[13px] font-semibold">
        Import contacts
      </h3>
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-ink px-3.5 text-[13px] font-medium hover:bg-mist focus-within:outline focus-within:outline-2 focus-within:outline-offset-2">
        <Upload size={14} aria-hidden="true" />
        Choose CSV
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <a href={TEMPLATE} download="skanor-contacts-template.csv" className="tabular text-[11px] text-ink underline underline-offset-2">
        DOWNLOAD TEMPLATE
      </a>
      {rows ? (
        <>
          <span className="text-[13px] text-graphite">
            {fileName}: {rows.length} rows
          </span>
          <Button size="sm" variant="primary" onClick={upload} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </>
      ) : null}
      {msg ? (
        <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "m-0 w-full text-sm text-danger-fg" : "m-0 w-full text-sm text-success-fg"}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
