"use client";

import { Download, LayoutGrid, List, Lock, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PathIcon } from "@/components/marketing/parts";
import { QRMark } from "@/components/qr/QRMark";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { fileSafe, framedPng, framedSvgString, logoDataUrl, logoFor, saveBlob } from "@/lib/qr-export";
import type { FolderRecord, QrRecord } from "@/lib/qr-repo";
import { qrValue, typeLabel, type EffectiveStatus } from "@/lib/qr-types";

type Props = {
  codes: QrRecord[];
  folders: FolderRecord[];
  locations: { id: string; name: string }[];
  shortBase: string;
  shortLabel: string;
  bulkLocked: boolean;
  logoId: string | null;
};

const statusTone: Record<EffectiveStatus, { tone: PillTone; text: string }> = {
  active: { tone: "success", text: "ACTIVE" },
  paused: { tone: "warning", text: "PAUSED" },
  expired: { tone: "neutral", text: "EXPIRED" },
  draft: { tone: "neutral", text: "DRAFT" },
  scheduled: { tone: "info", text: "SCHEDULED" },
  archived: { tone: "neutral", text: "ARCHIVED" },
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const bulkBtn = "tabular min-h-[34px] border border-[#4A4A52] bg-transparent px-3 text-[11px] text-white enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

export function LibraryView({ codes, folders, locations, shortBase, shortLabel, bulkLocked, logoId }: Props) {
  const router = useRouter();
  const [folder, setFolder] = useState<string>("all"); // "all" | "archived" | folder id
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loc, setLoc] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");

  const live = codes.filter((c) => c.status !== "archived");
  const archived = codes.filter((c) => c.status === "archived");
  const types = [...new Set(live.map((c) => c.type))];

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return codes.filter((c) => {
      if (folder === "archived" ? c.status !== "archived" : c.status === "archived") return false;
      if (folder !== "all" && folder !== "archived" && c.folderId !== folder) return false;
      if (type && c.type !== type) return false;
      if (loc === "none" ? c.locationId : loc && c.locationId !== loc) return false;
      if (status && c.effective !== status) return false;
      if (needle && !`${c.name} ${c.shortCode ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [codes, folder, q, type, loc, status]);

  const chosen = visible.filter((c) => selected.has(c.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const valueOf = (c: QrRecord) => qrValue(c, shortBase);
  const linkOf = (c: QrRecord) => (c.dynamic ? `${shortLabel}/${c.shortCode}` : "static");

  async function act(action: "pause" | "resume" | "archive" | "restore" | "move", folderId?: string | null, verb = action) {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/qr/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: chosen.map((c) => c.id), action, folderId: folderId ?? null }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setNote(`${j.changed} ${j.changed === 1 ? "code" : "codes"} ${verb === "move" ? "moved" : verb === "archive" ? "archived" : verb === "restore" ? "restored (paused)" : verb === "pause" ? "paused" : "resumed"}.`);
        setSelected(new Set());
        setMoving(false);
        setConfirming(false);
        router.refresh();
      } else if (res.status === 403) setNote("Your plan's dynamic-code limit would be exceeded.");
      else setNote("That didn't work. Please try again.");
    } catch {
      setNote("We couldn't reach the server. Please try again.");
    }
    setBusy(false);
  }

  async function downloadOne(c: QrRecord) {
    const src = logoFor(c.design, logoId);
    saveBlob(await framedPng(valueOf(c), c.design, 2000, src ? await logoDataUrl(src) : undefined), `${fileSafe(c.name)}.png`);
  }

  async function downloadZip() {
    setBusy(true);
    setNote("Preparing ZIP…");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const logo = logoId ? await logoDataUrl(`/f/${logoId}`) : undefined;
      for (const c of chosen) {
        const base = `${fileSafe(c.name)}-${c.shortCode ?? c.id.slice(0, 6)}`;
        const href = c.design.logo ? logo : undefined;
        zip.file(`${base}.png`, await framedPng(valueOf(c), c.design, 1000, href));
        zip.file(`${base}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${framedSvgString(valueOf(c), c.design, href)}`);
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), "skanor-qr-codes.zip");
      setNote(`ZIP with ${chosen.length} ${chosen.length === 1 ? "code" : "codes"} downloaded.`);
    } catch {
      setNote("We couldn't build the ZIP. Please try again.");
    }
    setBusy(false);
  }

  async function addFolder(e: FormEvent) {
    e.preventDefault();
    setFolderError("");
    const res = await fetch("/api/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: folderName }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setFolderName("");
      setAddingFolder(false);
      setFolder(j.id);
      router.refresh();
    } else setFolderError(j.fields?.name ?? "Couldn't create that folder.");
  }

  const folderBtn = (id: string, text: string, count: number) => (
    <li key={id}>
      <button
        type="button"
        aria-current={folder === id ? "true" : undefined}
        onClick={() => {
          setFolder(id);
          setSelected(new Set());
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-[18px] py-2.5 text-left text-[13.5px]",
          folder === id ? "bg-info-bg font-semibold text-ink" : "text-graphite hover:bg-paper",
        )}
      >
        <span className="truncate">{text}</span>
        <span className="tabular text-[11px] text-muted">{count}</span>
      </button>
    </li>
  );

  const inArchive = folder === "archived";
  const csvTemplate = "data:text/csv;charset=utf-8," + encodeURIComponent("name,type,location,url / page,serial\nTable 13,url,Anna Nagar,https://example.com/menu,\n");

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-[clamp(16px,2.4vw,32px)] py-3.5">
        <div>
          <div className="k">QR codes</div>
          <h1 className="mb-0 mt-0.5 font-display text-2xl font-semibold tracking-display">
            QR Library{" "}
            <span className="tabular text-sm font-normal tracking-normal text-muted">
              {live.length} {live.length === 1 ? "code" : "codes"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#bulk" className={buttonClasses()}>
            <Upload size={14} strokeWidth={2} aria-hidden="true" />
            Bulk from CSV
          </a>
          <Link href="/app/studio" className={buttonClasses({ variant: "primary" })}>
            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
            Create QR
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2.4vw,28px)]">
        <Card className="max-w-full flex-[1_1_200px]">
          <CardHeader>
            <CardTitle>Folders</CardTitle>
            <button
              type="button"
              aria-label="New folder"
              aria-expanded={addingFolder}
              onClick={() => setAddingFolder((v) => !v)}
              className="inline-flex min-h-8 items-center rounded-full border border-ink px-2.5 text-sm hover:bg-mist"
            >
              +
            </button>
          </CardHeader>
          {addingFolder ? (
            <form onSubmit={addFolder} className="flex flex-col gap-2 border-b border-line-soft p-3">
              <Input label="Folder name" hideLabel value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Folder name" error={folderError} maxLength={40} autoFocus className="min-h-10 text-sm" />
              <Button type="submit" size="sm" variant="primary">
                Add folder
              </Button>
            </form>
          ) : null}
          <nav aria-label="Folders">
            <ul className="m-0 list-none p-0 py-1.5">
              {folderBtn("all", "All codes", live.length)}
              {folders.map((f) => folderBtn(f.id, f.name, f.count))}
              {folderBtn("archived", "Archived", archived.length)}
            </ul>
          </nav>
        </Card>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <Input label="Search QR codes" hideLabel type="search" placeholder="Search by name or short link" value={q} onChange={(e) => setQ(e.target.value)} wrapperClassName="flex-[1_1_220px]" className="min-h-10 text-sm" />
            <Select label="Type" hideLabel value={type} onChange={(e) => setType(e.target.value)} wrapperClassName="w-auto" className="min-h-10 text-sm">
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </Select>
            <Select label="Location" hideLabel value={loc} onChange={(e) => setLoc(e.target.value)} wrapperClassName="w-auto" className="min-h-10 text-sm">
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="none">Unassigned</option>
            </Select>
            <Select label="Status" hideLabel value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="w-auto" className="min-h-10 text-sm">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </Select>
            <div role="group" aria-label="View" className="flex overflow-hidden border border-ink">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn("tabular inline-flex min-h-[38px] items-center gap-1.5 px-3 text-[11px]", view === v ? "bg-ink text-white" : "bg-white text-ink hover:bg-mist")}
                >
                  {v === "grid" ? <LayoutGrid size={12} aria-hidden="true" /> : <List size={12} aria-hidden="true" />}
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </Card>

          <div aria-live="polite" className="empty:hidden">
            {note ? <p className="m-0 rounded-input bg-mist px-3.5 py-2.5 text-sm text-graphite">{note}</p> : null}
          </div>

          {chosen.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-ink px-3.5 py-2.5 text-white">
              <span className="tabular text-xs">{chosen.length} SELECTED</span>
              {moving ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="sr-only" htmlFor="move-to">
                    Move to folder
                  </label>
                  <select id="move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="min-h-[34px] bg-white px-2 text-xs text-ink">
                    <option value="">No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={bulkBtn} disabled={busy} onClick={() => act("move", moveTo || null)}>
                    APPLY
                  </button>
                  <button type="button" className={bulkBtn} onClick={() => setMoving(false)}>
                    CANCEL
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {inArchive ? (
                    <button type="button" className={bulkBtn} disabled={busy} onClick={() => act("restore")}>
                      RESTORE
                    </button>
                  ) : (
                    <>
                      <button type="button" className={bulkBtn} onClick={() => setMoving(true)}>
                        MOVE
                      </button>
                      <button type="button" className={bulkBtn} disabled={busy} onClick={downloadZip}>
                        DOWNLOAD ZIP
                      </button>
                      <button type="button" className={bulkBtn} disabled title="Print sheets arrive with the print shop">
                        PRINT SHEET · SOON
                      </button>
                      {chosen.some((c) => c.status === "active") ? (
                        <button type="button" className={bulkBtn} disabled={busy} onClick={() => act("pause")}>
                          PAUSE
                        </button>
                      ) : null}
                      {chosen.some((c) => c.status === "paused") ? (
                        <button type="button" className={bulkBtn} disabled={busy} onClick={() => act("resume")}>
                          RESUME
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={cn(bulkBtn, confirming && "border-danger-bg bg-danger-fg")}
                        disabled={busy}
                        onClick={() => (confirming ? act("archive") : setConfirming(true))}
                        onBlur={() => setConfirming(false)}
                      >
                        {confirming ? `CONFIRM: ARCHIVE ${chosen.length}` : "DELETE"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {visible.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <h2 className="m-0 font-display text-xl font-semibold tracking-sub">{codes.length === 0 ? "No QR codes yet" : inArchive ? "Nothing archived" : "No codes match"}</h2>
              <p className="m-0 max-w-sm text-sm text-graphite">
                {codes.length === 0 ? "Create your first QR code. It takes about a minute." : "Try a different search or filter."}
              </p>
              {codes.length === 0 ? (
                <Link href="/app/studio" className={buttonClasses({ variant: "primary" })}>
                  Create QR
                </Link>
              ) : null}
            </Card>
          ) : view === "grid" ? (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3 p-0">
              {visible.map((c) => {
                const st = statusTone[c.effective];
                return (
                  <li key={c.id}>
                    <Card className="flex h-full flex-col">
                      <div className="flex items-start justify-between border-b border-line-soft bg-thead p-4">
                        <div className="border border-line-soft bg-white p-2">
                          <QRMark value={valueOf(c) || "Skanor"} variant={c.design.variant} color={c.design.color} size={96} quiet={false} label={`QR code for ${c.name}`} />
                        </div>
                        <label className="flex p-1">
                          <span className="sr-only">Select {c.name}</span>
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-[18px] w-[18px] accent-ink" />
                        </label>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone="info">{typeLabel(c.type).toUpperCase()}</Pill>
                          <Pill tone={st.tone}>{st.text}</Pill>
                        </div>
                        <h3 className="m-0 text-[14.5px] font-semibold">{c.name}</h3>
                        <div className="tabular break-all text-[11px] text-muted">
                          {linkOf(c)} · {c.locationName ?? "All"}
                        </div>
                        <div className="mt-auto flex items-end justify-between pt-1.5">
                          <div>
                            <div className="disp text-[22px] font-medium">{c.dynamic ? fmt(c.scans30) : "—"}</div>
                            <div className="tabular text-[10px] text-muted">{c.dynamic ? "SCANS · 30D" : "NOT TRACKED"}</div>
                          </div>
                          <div className="flex gap-1">
                            <Link href={`/app/studio?edit=${c.id}`} aria-label={`Edit ${c.name}`} className={buttonClasses({ size: "sm" })}>
                              Edit
                            </Link>
                            <button
                              type="button"
                              aria-label={`Download ${c.name}`}
                              onClick={() => downloadOne(c)}
                              className={buttonClasses({ size: "sm", className: "px-2.5" })}
                            >
                              <Download size={14} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card>
              <Table caption="QR codes">
                <TableHead>
                  <TableRow>
                    <Th className="w-10">
                      <span className="sr-only">Select</span>
                    </Th>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Link</Th>
                    <Th>Location</Th>
                    <Th>Scans · 30D</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((c) => {
                    const st = statusTone[c.effective];
                    return (
                      <TableRow key={c.id}>
                        <Td>
                          <label className="flex">
                            <span className="sr-only">Select {c.name}</span>
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-[18px] w-[18px] accent-ink" />
                          </label>
                        </Td>
                        <Td className="font-semibold">{c.name}</Td>
                        <Td>
                          <Pill tone="info">{typeLabel(c.type).toUpperCase()}</Pill>
                        </Td>
                        <Td>
                          <Pill tone={st.tone}>{st.text}</Pill>
                        </Td>
                        <Td className="tabular text-muted">{linkOf(c)}</Td>
                        <Td className="text-graphite">{c.locationName ?? "All"}</Td>
                        <Td className="tabular">{c.dynamic ? fmt(c.scans30) : "—"}</Td>
                        <Td>
                          <div className="flex gap-1">
                            <Link href={`/app/studio?edit=${c.id}`} aria-label={`Edit ${c.name}`} className={buttonClasses({ size: "sm" })}>
                              Edit
                            </Link>
                            <button type="button" aria-label={`Download ${c.name}`} onClick={() => downloadOne(c)} className={buttonClasses({ size: "sm", className: "px-2.5" })}>
                              <Download size={14} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          <div id="bulk" className="flex scroll-mt-4 flex-wrap items-start gap-5">
            <Card className="flex-[2_1_480px]">
              <CardHeader>
                <CardTitle>Bulk generate from CSV</CardTitle>
                <a href={csvTemplate} download="skanor-bulk-template.csv" className="tabular text-[11px] text-ink underline underline-offset-2">
                  DOWNLOAD TEMPLATE
                </a>
              </CardHeader>
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col items-center gap-2 border-2 border-dashed border-track bg-thead p-7 text-center">
                  {bulkLocked ? <Lock size={28} strokeWidth={1.6} aria-hidden="true" /> : <Upload size={28} strokeWidth={1.6} aria-hidden="true" />}
                  <div className="text-sm font-semibold">{bulkLocked ? "Bulk generation is included from the Growth plan" : "Drop a CSV or Excel file"}</div>
                  <div className="text-xs text-muted">One row per QR · up to 10,000 rows</div>
                  <Button disabled className="mt-1.5">
                    Choose file{bulkLocked ? "" : " (soon)"}
                  </Button>
                </div>
                <Table caption="How CSV columns map to QR fields">
                  <TableHead>
                    <TableRow>
                      <Th>Column in file</Th>
                      <Th>Maps to</Th>
                      <Th>Example</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      ["name", "QR name", "Table 13"],
                      ["type", "QR type", "url"],
                      ["location", "Location", "Anna Nagar"],
                      ["url / page", "Destination", "menu-dinner"],
                      ["serial", "Serial (product QR)", "AQ-24-000123"],
                    ].map(([a, b, c]) => (
                      <TableRow key={a}>
                        <Td className="tabular">{a}</Td>
                        <Td>{b}</Td>
                        <Td className="text-muted">{c}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <Card className="flex-[1_1_300px]">
              <CardHeader>
                <CardTitle>Print orders</CardTitle>
              </CardHeader>
              <div className="flex flex-col items-start gap-2 p-[18px]">
                <PathIcon d="M6 9V3h12v6M6 18H3v-8h18v8h-3M6 14h12v7H6z" size={22} className="text-graphite" />
                <div className="text-sm font-semibold">No print orders yet</div>
                <p className="m-0 text-xs leading-[1.5] text-muted">Stickers, table tents and standees from the print shop are coming soon.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
