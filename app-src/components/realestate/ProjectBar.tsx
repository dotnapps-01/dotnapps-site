"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import type { ProjectRecord } from "@/lib/realestate";
import { ProjectForm } from "./ProjectForm";

/** Project picker with new / edit / delete. */
export function ProjectBar({ projects, current, startOpen, canBuild = true }: { projects: ProjectRecord[]; current: ProjectRecord | null; startOpen: boolean; canBuild?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "edit" | null>(canBuild && (startOpen || projects.length === 0) ? "new" : null);
  const [msg, setMsg] = useState("");
  async function remove() {
    if (!current || !window.confirm(`Delete “${current.name}” and all of its plots?`)) return;
    const res = await fetch(`/api/projects/${current.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/app/real-estate");
      router.refresh();
    } else setMsg(res.status === 409 ? "A QR code still points at one of its plots. Archive those codes first." : "Couldn't delete that project.");
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/app/real-estate?project=${p.id}`} aria-current={current?.id === p.id ? "page" : undefined} className={buttonClasses({ variant: current?.id === p.id ? "primary" : "secondary", size: "sm" })}>
            {`${p.name} · ${p.plots} plots`}
          </Link>
        ))}
        {canBuild ? (
          <Button size="sm" onClick={() => setMode("new")}>
            + New project
          </Button>
        ) : null}
        {current && canBuild ? (
          <>
            <Button size="sm" onClick={() => setMode("edit")}>
              Edit project
            </Button>
            <Button size="sm" onClick={remove}>
              Delete project
            </Button>
          </>
        ) : null}
      </div>
      {msg ? (
        <p role="alert" className="m-0 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {mode ? <ProjectForm key={mode + (current?.id ?? "")} project={mode === "edit" ? current : null} onDone={() => setMode(null)} /> : null}
    </div>
  );
}
