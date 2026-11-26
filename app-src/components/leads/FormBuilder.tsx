"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FORM_FIELDS, type FormFieldKey } from "@/lib/engage-input";
import type { FormRecord } from "@/lib/engage";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

function FormEditor({ form, onDone }: { form: FormRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(form?.title ?? "");
  const [intro, setIntro] = useState(form?.intro ?? "");
  const [fields, setFields] = useState<FormFieldKey[]>(form?.fields ?? ["email", "message"]);
  const [interests, setInterests] = useState((form?.interests ?? []).join(", "));
  const [submitLabel, setSubmitLabel] = useState(form?.submitLabel ?? "Request a callback");
  const [notifyPhone, setNotifyPhone] = useState(form?.notifyPhone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(form ? `/api/lead-forms/${form.id}` : "/api/lead-forms", {
      method: form ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, intro, fields, interests, submitLabel, notifyPhone }),
    }).catch(() => null);
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
    <form onSubmit={save} noValidate aria-label={form ? "Edit form" : "New form"} className="flex flex-col gap-3.5 border-t border-line p-4">
      <Input label="Form title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="Free dental check-up" labelClassName={label} className={control} />
      <Textarea label="Intro (optional)" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={200} labelClassName={label} className="min-h-16 text-sm" />
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={`${label} mb-1.5 p-0`}>Fields (name and WhatsApp number are always asked)</legend>
        <div className="flex flex-wrap gap-2">
          {FORM_FIELDS.map((f) => (
            <label key={f.key} className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-line px-3 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-mist">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={fields.includes(f.key)} onChange={() => setFields((cur) => (cur.includes(f.key) ? cur.filter((k) => k !== f.key) : [...cur, f.key]))} />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      {fields.includes("interest") ? <Input label="Choices for “I am interested in”" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Check-up, Braces, Implants" error={errors.interests} hint="Separated by commas (2 to 8)." labelClassName={label} className={control} /> : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Button text" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} labelClassName={label} className={control} />
        <Input label="Notify (WhatsApp number)" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} placeholder="+91" error={errors.notifyPhone} hint="Saved for WhatsApp alerts. New leads show up in the pipeline." labelClassName={label} className={control} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : form ? "Save form" : "Create form"}
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

/** Lead forms: list, create, edit, delete, and "Create QR". */
export function FormBuilder({ forms }: { forms: FormRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState("");

  async function remove(f: FormRecord) {
    if (!window.confirm(`Delete the form “${f.title}”? Leads already collected stay in your pipeline.`)) return;
    const res = await fetch(`/api/lead-forms/${f.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg(res.status === 409 ? "A QR code still uses this form. Archive it first." : "Couldn't delete that form.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forms</CardTitle>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          + New form
        </Button>
      </CardHeader>
      {msg ? (
        <p role="alert" className="m-0 border-b border-line px-[18px] py-2.5 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {editing === "new" ? <FormEditor form={null} onDone={() => setEditing(null)} /> : null}
      {forms.length === 0 && editing !== "new" ? <p className="m-0 p-[18px] text-sm text-graphite">No forms yet. Create one, then link it to a QR code to collect leads.</p> : null}
      <ul className="m-0 list-none p-0">
        {forms.map((f) => (
          <li key={f.id} className="border-b border-line-soft last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5">
              <div>
                <div className="text-[13.5px] font-semibold">{f.title}</div>
                <div className="tabular mt-0.5 text-[10.5px] text-muted">
                  {f.fields.length + 2} fields · {f.inUse} {f.inUse === 1 ? "QR code" : "QR codes"} · {f.leads} {f.leads === 1 ? "lead" : "leads"}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/app/studio?type=lead&ref=${f.id}`} className={buttonClasses({ size: "sm" })}>
                  Create QR
                </Link>
                <Button size="sm" onClick={() => setEditing(editing === f.id ? null : f.id)} aria-expanded={editing === f.id}>
                  Edit
                </Button>
                <Button size="sm" onClick={() => remove(f)} aria-label={`Delete ${f.title}`}>
                  Delete
                </Button>
              </div>
            </div>
            {editing === f.id ? <FormEditor form={f} onDone={() => setEditing(null)} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
