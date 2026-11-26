"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadButton } from "@/components/files/UploadButton";
import { formatBytes } from "@/components/files/upload";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";

export type FileRow = { id: string; purpose: string; name: string; mime: string; size: number; createdAt: string; inUse: boolean; url: string };

const KIND: Record<string, string> = { logo: "Logo", document: "PDF", image: "Image" };
const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Logo upload and the list of everything uploaded, with the space used. */
export function BrandCard({ logoId, files, used, quota }: { logoId: string | null; files: FileRow[]; used: number; quota: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const pct = Math.min(100, Math.round((used / quota) * 100));
  const unused = files.filter((f) => !f.inUse).length;

  async function remove(f: FileRow) {
    const note = f.inUse ? " A QR code or page uses it and will stop working." : "";
    if (!window.confirm(`Delete ${f.name}?${note}`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setMsg(`${f.name} deleted.`);
      router.refresh();
    } else setMsg("We couldn't delete that. Please try again.");
  }
  async function cleanup() {
    if (!window.confirm(`Delete ${unused} file${unused === 1 ? "" : "s"} that nothing uses?`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/files/cleanup", { method: "POST" }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg(`${j.removed ?? 0} unused file${j.removed === 1 ? "" : "s"} deleted.`);
      router.refresh();
    } else setMsg("We couldn't clean up. Please try again.");
  }
  async function copy(f: FileRow) {
    try {
      await navigator.clipboard.writeText(new URL(f.url, window.location.origin).href);
      setCopied(f.id);
      setMsg(`Link to ${f.name} copied.`);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setMsg(`Copy this link: ${new URL(f.url, window.location.origin).href}`);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-card border border-line bg-white">
          {logoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/f/${logoId}`} alt="Your logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-1 text-center text-[11px] text-muted">No logo yet</span>
          )}
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <p className="m-0 text-sm leading-[1.55] text-graphite">Shown on your scan pages and, if you choose, in the centre of your QR codes. PNG, JPG or WebP, up to 1 MB, at least 64 pixels wide. A square logo on a plain background works best.</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <UploadButton purpose="logo" label={logoId ? "Replace logo" : "Upload logo"} variant="primary" onUploaded={() => { setMsg("Logo saved."); router.refresh(); }} />
            {logoId ? (
              <Button size="sm" disabled={busy} onClick={() => remove({ id: logoId, purpose: "logo", name: "your logo", mime: "", size: 0, createdAt: "", inUse: false, url: "" })}>
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[13px]">
          <span>File storage</span>
          <span className="tabular">
            {formatBytes(used)} / {formatBytes(quota)}
          </span>
        </div>
        <div role="progressbar" aria-label="File storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
          <div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {files.length ? (
        <div className="overflow-x-auto rounded-card border border-line-soft">
          <Table caption="Uploaded files">
            <TableHead>
              <TableRow>
                <Th>File</Th>
                <Th>Type</Th>
                <Th>Size</Th>
                <Th>Added</Th>
                <Th>Used</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.id}>
                  <Td className="max-w-[240px] truncate">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-medium">
                      {f.name}
                    </a>
                  </Td>
                  <Td>{KIND[f.purpose] ?? f.purpose}</Td>
                  <Td className="tabular">{formatBytes(f.size)}</Td>
                  <Td className="tabular">{when(f.createdAt)}</Td>
                  <Td>{f.inUse ? <Pill tone="success">In use</Pill> : <Pill>Not used</Pill>}</Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => copy(f)} aria-label={`Copy link to ${f.name}`}>
                        {copied === f.id ? "Copied" : "Copy link"}
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => remove(f)} aria-label={`Delete ${f.name}`}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="m-0 text-sm text-muted">No files yet. PDFs and images you upload for QR codes, menus and brochures will be listed here.</p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {unused > 0 ? (
          <Button size="sm" disabled={busy} onClick={cleanup}>
            Delete {unused} unused file{unused === 1 ? "" : "s"}
          </Button>
        ) : null}
        {msg ? (
          <p role="status" className="m-0 text-sm text-graphite">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
