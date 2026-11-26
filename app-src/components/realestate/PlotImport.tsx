"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/engage-input";

const TEMPLATE = "data:text/csv;charset=utf-8," + encodeURIComponent("number,size,dims,facing,price,approval,corner,status\n14,1200,30x40 ft,East,42.5,DTCP,no,available\n");

/** Plots from a CSV: number, size (sq ft), dims, facing, price (lakh), approval, corner, status. Existing plot numbers are updated. */
export function PlotImport({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setMsg(null);
    setRows(null);
    if (!file) return;
    if (file.size > 500_000) return setMsg({ tone: "error", text: "That file is over 500 KB. Split it into smaller files." });
    const parsed = parseCsv(await file.text());
    setFileName(file.name);
    if (parsed.length === 0) return setMsg({ tone: "error", text: "No rows found. The first row must be a header with at least a “number” column." });
    if (!("number" in parsed[0] || "plot" in parsed[0])) return setMsg({ tone: "error", text: "There's no “number” column in the header row." });
    setRows(parsed);
  }

  async function upload() {
    if (!rows) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/projects/${projectId}/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: `${j.added} added, ${j.updated} updated${j.skippedCount ? `, ${j.skippedCount} skipped (e.g. line ${j.skipped[0].line}: ${j.skipped[0].reason})` : ""}.` });
      setRows(null);
      router.refresh();
    } else setMsg({ tone: "error", text: j.fields?.rows ?? "The import failed. Please try again." });
  }

  return (
    <section id="import" aria-label="Import plots" className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white px-[18px] py-3.5">
      <label className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-ink bg-white px-4 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
        Choose plots CSV
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      <a href={TEMPLATE} download="skanor-plots-template.csv" className="tabular text-[11px] text-ink underline underline-offset-2">
        DOWNLOAD TEMPLATE
      </a>
      {rows ? (
        <>
          <span className="text-[13px] text-graphite">{`${fileName}: ${rows.length} rows`}</span>
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
