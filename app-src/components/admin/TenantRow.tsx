"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { TableRow, Td } from "@/components/ui/Table";
import type { TenantRecord } from "@/lib/admin";
import { PLAN_LABEL, PLAN_ORDER } from "@/lib/plans";
import type { Plan } from "@/lib/workspace";

const HEALTH = { healthy: ["bg-success-fg", "Healthy"], low: ["bg-warning-fg", "Low use"], risk: ["bg-danger-fg", "At risk"], new: ["bg-track", "New"] } as const;

/** One tenant: change their plan, pause or resume them, or view their workspace as they see it. */
export function TenantRow({ t }: { t: TenantRecord }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(t.plan);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dot, label] = HEALTH[t.health];

  async function call(url: string, method: string, body: unknown, ok: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setMsg(ok);
      router.refresh();
      return true;
    }
    setMsg("That didn't work. Please try again.");
    return false;
  }
  async function viewAs() {
    if (await call("/api/admin/impersonate", "POST", { workspaceId: t.id }, "")) {
      router.push("/app/dashboard");
      router.refresh();
    }
  }

  return (
    <TableRow data-tenant={t.id} data-name={t.name}>
      <Td>
        <div className="font-semibold">{t.name || "(no name)"}</div>
        <div className="tabular text-xs text-muted">{[t.phone, t.industry].filter(Boolean).join(" · ")}</div>
      </Td>
      <Td>
        <div className="flex items-end gap-1.5">
          <Select label={`Plan for ${t.name || t.phone}`} hideLabel value={plan} onChange={(e) => setPlan(e.target.value as Plan)} wrapperClassName="w-[130px]" className="min-h-9 text-[13px]">
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABEL[p]}
              </option>
            ))}
          </Select>
          {plan !== t.plan ? (
            <Button size="sm" variant="primary" disabled={busy} aria-label={`Apply ${PLAN_LABEL[plan]} plan to ${t.name || t.phone}`} onClick={() => call(`/api/admin/tenants/${t.id}`, "PATCH", { plan }, "Plan changed.")}>
              Apply
            </Button>
          ) : null}
        </div>
      </Td>
      <Td className="tabular">{t.locations}</Td>
      <Td className="tabular">{t.scans30.toLocaleString("en-IN")}</Td>
      <Td>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {label}
        </span>
      </Td>
      <Td>
        <Pill tone={t.suspended ? "danger" : t.onboarded ? "success" : "info"}>{t.suspended ? "SUSPENDED" : t.onboarded ? "ACTIVE" : "ONBOARDING"}</Pill>
      </Td>
      <Td>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" aria-label={`Log in as ${t.name || t.phone}`} onClick={viewAs} disabled={busy}>
            Log in as
          </Button>
          <Button size="sm" aria-label={`${t.suspended ? "Resume" : "Suspend"} ${t.name || t.phone}`} disabled={busy} onClick={() => call(`/api/admin/tenants/${t.id}`, "PATCH", { suspended: !t.suspended }, t.suspended ? "Resumed." : "Suspended.")}>
            {t.suspended ? "Resume" : "Suspend"}
          </Button>
          {msg ? (
            <span role="status" className="text-xs text-graphite">
              {msg}
            </span>
          ) : null}
        </div>
      </Td>
    </TableRow>
  );
}
