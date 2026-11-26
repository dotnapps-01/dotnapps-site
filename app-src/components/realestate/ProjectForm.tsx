"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UploadButton } from "@/components/files/UploadButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { ProjectRecord } from "@/lib/realestate";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

/** Create a project (with N numbered plots) or edit one. */
export function ProjectForm({ project, onDone }: { project: ProjectRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: project?.name ?? "",
    plotCount: "",
    columns: String(project?.columns ?? 10),
    roadAfter: (project?.roadAfter ?? []).join(", "),
    approval: project?.approval ?? "",
    brochureUrl: project?.brochureUrl ?? "",
    whatsapp: project?.whatsapp ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      if (!project && j.id) router.push(`/app/real-estate?project=${j.id}`);
      router.refresh();
      onDone();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted fields.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{project ? `Edit: ${project.name}` : "New project"}</CardTitle>
      </CardHeader>
      <form onSubmit={save} noValidate aria-label={project ? "Edit project" : "New project"} className="flex flex-col gap-3.5 p-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          <Input label="Project name" value={v.name} onChange={set("name")} error={errors.name} placeholder="Green Meadows Phase 2" labelClassName={label} className={control} />
          {project ? null : <Input label="Number of plots" inputMode="numeric" value={v.plotCount} onChange={set("plotCount")} error={errors.plotCount} placeholder="60" hint="Numbered 1 to N. Edit details or import a CSV after." labelClassName={label} className={control} />}
          <Input label="Plots per row on the map" inputMode="numeric" value={v.columns} onChange={set("columns")} error={errors.columns} labelClassName={label} className={control} />
          <Input label="Roads after row(s)" value={v.roadAfter} onChange={set("roadAfter")} error={errors.roadAfter} placeholder="2, 5" labelClassName={label} className={control} />
          <Input label="Approval" value={v.approval} onChange={set("approval")} placeholder="DTCP approved layout" labelClassName={label} className={control} />
          <Input label="Sales WhatsApp number" type="tel" value={v.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp} placeholder="+91" labelClassName={label} className={control} />
          <div className="flex flex-col gap-2">
            <Input label="Brochure link" value={v.brochureUrl} onChange={set("brochureUrl")} error={errors.brochureUrl} placeholder="https://" labelClassName={label} className={control} />
            <UploadButton purpose="document" label="Upload a PDF instead" onUploaded={(f) => setV((x) => ({ ...x, brochureUrl: f.url }))} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : project ? "Save project" : "Create project"}
          </Button>
          <Button onClick={onDone}>Cancel</Button>
          {msg ? (
            <p role="alert" className="m-0 text-sm text-danger-fg">
              {msg}
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
