"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { canManageMember, MATRIX_ROWS, ROLE_LABEL, ROLES, type Cell, type MemberRole, type Role } from "@/lib/permissions";

export type TeamRow = { id: string; name: string; phone: string; role: Role; status: "owner" | "invited" | "active"; isYou: boolean; joinedAt: string | null; lastLoginAt: string | null };

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
/** "9876512345" or "+91 98765 12345" -> "919876512345" (wa.me wants the country code) */
const waDigits = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };
const prettyPhone = (phone: string) => { const d = waDigits(phone).slice(-10); return `+91 ${d.slice(0, 5)} ${d.slice(5)}`; };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—");
const SYMBOL: Record<Cell, { s: string; bg: string; fg: string; text: string }> = {
  yes: { s: "✓", bg: "#E3F2EA", fg: "#1F6B45", text: "Allowed" },
  no: { s: "–", bg: "#F1F1F3", fg: "#6B6B75", text: "Not allowed" },
  view: { s: "V", bg: "#F3EEFF", fg: "#5B45B8", text: "View only" },
};

/** Team members, invitations and the table of what each role can do. */
export function TeamCard({ team, role, businessName, seats }: { team: TeamRow[]; role: Role; businessName: string; seats: { used: number; limit: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<{ name: string; phone: string; role: MemberRole }>({ name: "", phone: "", role: "staff" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ name: string; phone: string; role: MemberRole } | null>(null);
  const [copied, setCopied] = useState(false);
  const full = seats.used >= seats.limit;

  const shareText = (a: { name: string; role: MemberRole }) => `Hi ${a.name.split(" ")[0]}, I've added you to ${businessName} on Skanor as ${ROLE_LABEL[a.role]}. Sign in with this mobile number to join: ${window.location.origin}/login`;

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg("");
    setAdded(null);
    const res = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.status === 201) {
      setAdded({ ...v });
      setV({ name: "", phone: "", role: "staff" });
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg(j.message ?? "We couldn't add them. Please try again.");
  }
  async function changeRole(m: TeamRow, next: string) {
    setMsg("");
    const res = await fetch(`/api/team/${m.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: next }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      setMsg(`${m.name} is now ${ROLE_LABEL[next as Role]}.`);
      router.refresh();
    } else setMsg(j.message ?? "We couldn't change that role.");
  }
  async function remove(m: TeamRow) {
    const what = m.status === "invited" ? `Cancel the invitation for ${m.name}?` : `Remove ${m.name}? They lose access straight away.`;
    if (!window.confirm(what)) return;
    setMsg("");
    const res = await fetch(`/api/team/${m.id}`, { method: "DELETE" }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      setMsg(m.status === "invited" ? "Invitation cancelled." : `${m.name} removed.`);
      router.refresh();
    } else setMsg(j.message ?? "We couldn't remove them.");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg(`Copy this message: ${text}`);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pt-4">
        <p className="m-0 text-sm text-graphite">
          <span className="tabular">
            {seats.used} of {seats.limit}
          </span>{" "}
          team seats used. {role === "owner" ? "You can add Managers and Staff." : "You can add Staff."}
        </p>
        <Button size="sm" variant="primary" aria-expanded={open} aria-controls="invite-form" disabled={full && !open} onClick={() => { setOpen((o) => !o); setAdded(null); setErrors({}); setMsg(""); }}>
          {open ? "Close" : "Invite member"}
        </Button>
      </div>
      {full && !open ? <p className="m-0 px-[18px] pt-2 text-xs text-muted">All seats are taken. Remove someone, or move to a bigger plan, to add more people.</p> : null}

      {open ? (
        <form id="invite-form" onSubmit={invite} noValidate aria-label="Invite a team member" className="m-[18px] mb-0 flex flex-col gap-3.5 rounded-card border border-line bg-paper p-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5">
            <Input label="Name" value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} error={errors.name} labelClassName={label} className="min-h-10 text-sm" autoComplete="off" />
            <Input label="Mobile number" type="tel" value={v.phone} onChange={(e) => setV((x) => ({ ...x, phone: e.target.value }))} error={errors.phone} placeholder="+91" hint="They sign in with this number." labelClassName={label} className="min-h-10 text-sm" autoComplete="off" />
            <Select label="Role" value={v.role} onChange={(e) => setV((x) => ({ ...x, role: e.target.value as MemberRole }))} error={errors.role} labelClassName={label} className="min-h-10 text-sm">
              <option value="staff">Staff</option>
              {role === "owner" ? <option value="manager">Manager</option> : null}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add to team"}
            </Button>
            {msg && !added ? (
              <p role="alert" className="m-0 text-sm text-danger-fg">
                {msg}
              </p>
            ) : null}
          </div>
          {added ? (
            <div role="status" className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-graphite">
              <p className="m-0">
                <strong className="text-ink">{added.name}</strong> is on the team as {ROLE_LABEL[added.role]}. They join the first time they sign in with {prettyPhone(added.phone)}. We don&rsquo;t send the invitation for you yet, so pass it on:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`https://wa.me/${waDigits(added.phone)}?text=${encodeURIComponent(shareText(added))}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-ink bg-white px-3.5 text-[13px] font-medium text-ink no-underline hover:bg-mist">
                  Send on WhatsApp
                </a>
                <Button size="sm" onClick={() => copy(shareText(added))}>
                  {copied ? "Copied" : "Copy message"}
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}

      {msg && !open ? (
        <p role="status" className="m-0 px-[18px] pt-3 text-sm text-graphite">
          {msg}
        </p>
      ) : null}

      <div className="mt-3.5 overflow-x-auto border-t border-line-soft">
        <Table caption="Team members">
          <TableHead>
            <TableRow>
              <Th>Name</Th>
              <Th>Mobile</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last sign-in</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {team.map((m) => (
              <TableRow key={m.id} data-member={m.id}>
                <Td className="font-semibold">
                  {m.name}
                  {m.isYou && m.status !== "owner" ? <span className="ml-1.5 text-xs font-normal text-muted">(you)</span> : null}
                </Td>
                <Td className="tabular">{m.phone || "—"}</Td>
                <Td>
                  {m.status === "owner" || !(role === "owner") ? (
                    ROLE_LABEL[m.role]
                  ) : (
                    <Select label={`Role for ${m.name}`} hideLabel value={m.role} onChange={(e) => void changeRole(m, e.target.value)} wrapperClassName="w-[130px]" className="min-h-9 text-sm">
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                    </Select>
                  )}
                </Td>
                <Td>{m.status === "owner" ? <Pill>OWNER</Pill> : m.status === "active" ? <Pill tone="success">ACTIVE</Pill> : <Pill tone="warning">INVITED</Pill>}</Td>
                <Td className="tabular">{m.status === "invited" ? "Not yet" : m.status === "owner" ? "—" : when(m.lastLoginAt)}</Td>
                <Td>
                  {m.status !== "owner" && !m.isYou && canManageMember(role, m.role as MemberRole) ? (
                    <Button size="sm" aria-label={`${m.status === "invited" ? "Cancel invitation for" : "Remove"} ${m.name}`} onClick={() => remove(m)}>
                      {m.status === "invited" ? "Cancel invite" : "Remove"}
                    </Button>
                  ) : null}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="overflow-x-auto border-t border-line-soft">
        <Table caption="What each role can do">
          <TableHead>
            <TableRow>
              <Th>Permission</Th>
              {ROLES.map((r) => (
                <Th key={r} className="text-center">
                  {ROLE_LABEL[r]}
                </Th>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {MATRIX_ROWS.map((row) => (
              <TableRow key={row.label}>
                <Td>{row.label}</Td>
                {ROLES.map((r) => {
                  const c = SYMBOL[row.cells[r]];
                  return (
                    <Td key={r} className="text-center">
                      <span role="img" aria-label={`${ROLE_LABEL[r]}: ${c.text}`} className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold" style={{ background: c.bg, color: c.fg }}>
                        {c.s}
                      </span>
                    </Td>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="m-0 px-[18px] pb-4 pt-2 text-xs leading-[1.55] text-muted">
          Managers can add and remove Staff. Only the owner can add Managers or change roles. &ldquo;View only&rdquo; means Staff can look at analytics but can&rsquo;t download data.
        </p>
      </div>
    </div>
  );
}
