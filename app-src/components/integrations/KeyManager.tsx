"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { KEY_SCOPES, type KeyRecord } from "@/lib/api-keys-shared";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/** Create and revoke API keys. A new key is shown once, in this panel, and never again. */
export function KeyManager({ keys }: { keys: KeyRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("read");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg("");
    const res = await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, scope }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setFresh({ name, key: j.key });
      setOpen(false);
      setName("");
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg(res?.status === 409 ? "You've reached the limit of active keys. Revoke one first." : "We couldn't create that key. Please try again.");
  }
  async function revoke(k: KeyRecord) {
    if (!window.confirm(`Revoke “${k.name}”? Anything still using it will stop working at once.`)) return;
    const res = await fetch(`/api/keys/${k.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg("Couldn't revoke that key.");
  }
  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.key);
      setCopied(true);
    } catch {
      setMsg("Couldn't copy. Select the key and copy it by hand.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <Button size="sm" variant="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Create API key
        </Button>
      </CardHeader>
      {fresh ? (
        <div role="status" className="m-[18px] flex flex-col gap-2 rounded-input border border-ink bg-paper p-3.5">
          <div className="text-sm font-semibold">{`Key “${fresh.name}” created. Copy it now: this is the only time it is shown.`}</div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="tabular break-all rounded-lg bg-white px-2.5 py-1.5 text-[13px]">{fresh.key}</code>
            <Button size="sm" onClick={copy} aria-label="Copy the new API key">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => setFresh(null)}>
              I&rsquo;ve saved it
            </Button>
          </div>
        </div>
      ) : null}
      {open ? (
        <form onSubmit={create} noValidate aria-label="New API key" className="flex flex-col gap-3 border-b border-line-soft p-[18px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Packaging line" className="min-h-10 text-sm" />
            <Select label="What it may do" value={scope} onChange={(e) => setScope(e.target.value)} error={errors.scope} hint={KEY_SCOPES.find((s) => s.key === scope)?.blurb} className="min-h-10 text-sm">
              {KEY_SCOPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Creating…" : "Create key"}
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {msg ? (
        <p role="alert" className="m-0 px-[18px] pt-3 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      <Table caption="API keys">
        <TableHead>
          <TableRow>
            <Th>Name</Th>
            <Th>Key</Th>
            <Th>Scope</Th>
            <Th>Last used</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <Td colSpan={5} className="text-muted">
                No keys yet.
              </Td>
            </TableRow>
          ) : (
            keys.map((k) => (
              <TableRow key={k.id}>
                <Td className="font-semibold">{k.name}</Td>
                <Td className="tabular text-xs">{`sk_live_••••••${k.last4}`}</Td>
                <Td>{KEY_SCOPES.find((s) => s.key === k.scope)?.label ?? k.scope}</Td>
                <Td className="tabular text-xs">{k.revokedAt ? "revoked" : ago(k.lastUsedAt)}</Td>
                <Td>
                  {k.revokedAt ? <Pill>REVOKED</Pill> : (
                    <Button size="sm" aria-label={`Revoke ${k.name}`} onClick={() => revoke(k)}>
                      Revoke
                    </Button>
                  )}
                </Td>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
