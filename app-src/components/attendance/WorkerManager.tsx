"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { Toggle } from "@/components/ui/Toggle";
import { hhmm } from "@/lib/ops-input";
import type { WorkerRecord } from "@/lib/attendance";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

function WorkerForm({ worker, kind, onDone }: { worker: WorkerRecord | null; kind: "staff" | "labour"; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: worker?.name ?? "",
    phone: worker?.phone ?? "",
    kind: worker?.kind ?? kind,
    role: worker?.role ?? "",
    shiftStart: hhmm(worker?.shiftStart ?? 540),
    shiftEnd: hhmm(worker?.shiftEnd ?? 1080),
    active: worker?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(worker ? `/api/workers/${worker.id}` : "/api/workers", { method: worker ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.refresh();
      onDone();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted fields.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label={worker ? "Edit worker" : "Add worker"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <Input label="Name" value={v.name} onChange={set("name")} error={errors.name} labelClassName={label} className={control} />
        <Input label="Mobile number" type="tel" value={v.phone} onChange={set("phone")} error={errors.phone} placeholder="+91" hint="The last 4 digits are used to check in." labelClassName={label} className={control} />
        {worker ? null : (
          <Select label="Type" value={v.kind} onChange={set("kind")} labelClassName={label} className={control}>
            <option value="staff">Staff</option>
            <option value="labour">Labour</option>
          </Select>
        )}
        <Input label="Role" value={v.role} onChange={set("role")} placeholder="Mason, Cashier…" labelClassName={label} className={control} />
        <Input label="Shift starts" type="time" value={v.shiftStart} onChange={set("shiftStart")} error={errors.shiftStart} labelClassName={label} className={control} />
        <Input label="Shift ends" type="time" value={v.shiftEnd} onChange={set("shiftEnd")} error={errors.shiftEnd} labelClassName={label} className={control} />
      </div>
      {worker ? <Toggle label="Active (can check in)" checked={v.active} onCheckedChange={(a) => setV((x) => ({ ...x, active: a }))} /> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : worker ? "Save worker" : "Add worker"}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        {msg ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Staff or labour: who can check in, and when their shift runs. */
export function WorkerManager({ workers, kind, startOpen }: { workers: WorkerRecord[]; kind: "staff" | "labour"; startOpen: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(startOpen ? "new" : null);
  const editingWorker = editing && editing !== "new" ? (workers.find((w) => w.id === editing) ?? null) : null;
  const noun = kind === "staff" ? "staff member" : "labour worker";
  return (
    <section aria-labelledby="workers-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="workers-h" className="m-0 font-sans text-[17px] font-semibold">
          {kind === "staff" ? "Staff" : "Labour"}
        </h2>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          {`+ Add ${noun}`}
        </Button>
      </div>
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingWorker ? `Edit: ${editingWorker.name}` : `New ${noun}`}</CardTitle>
          </CardHeader>
          <WorkerForm key={editing} worker={editingWorker} kind={kind} onDone={() => setEditing(null)} />
        </Card>
      ) : null}
      <Card>
        <Table caption={kind === "staff" ? "Staff" : "Labour"}>
          <TableHead>
            <TableRow>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Shift</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <Td colSpan={6} className="text-muted">
                  {`No ${kind === "staff" ? "staff" : "labour"} yet. Add people, then put a check-in code where they arrive.`}
                </Td>
              </TableRow>
            ) : (
              workers.map((w) => (
                <TableRow key={w.id}>
                  <Td className="tabular font-semibold">{w.code}</Td>
                  <Td>
                    <div className="font-semibold">{w.name}</div>
                    <div className="tabular text-[11px] text-muted">{w.phone}</div>
                  </Td>
                  <Td>{w.role || "—"}</Td>
                  <Td className="tabular">{`${hhmm(w.shiftStart)} – ${hhmm(w.shiftEnd)}`}</Td>
                  <Td>
                    <Pill tone={w.active ? "success" : "neutral"}>{w.active ? "ACTIVE" : "OFF"}</Pill>
                  </Td>
                  <Td>
                    <Button size="sm" aria-label={`Edit ${w.name}`} onClick={() => setEditing(w.id)}>
                      Edit
                    </Button>
                  </Td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
