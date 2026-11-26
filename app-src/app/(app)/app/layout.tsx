import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { currentWorkspace } from "@/lib/auth/current";
import { countDynamic } from "@/lib/qr-repo";
import { openFeedbackCount } from "@/lib/reviews";
import { newLeadCount } from "@/lib/engage";
import { dynamicLimit } from "@/lib/qr-types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "").slice(0, 2);
  return (letters || "S").toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");

  const name = ws.businessName || "Your business";
  const locations = ws.locationName ? [{ id: "primary", name: ws.locationName }] : [{ id: "none", name: "No location yet" }];

  const limit = dynamicLimit[ws.plan];
  const upgrade = { free: "Starter", starter: "Growth", growth: "Business", business: "Enterprise", enterprise: null }[ws.plan];
  const plan = {
    name: ws.plan[0].toUpperCase() + ws.plan.slice(1),
    used: await countDynamic(ws.id),
    limit: Number.isFinite(limit) ? limit : null,
    upgradeTo: upgrade,
  };

  const [openFeedback, newLeads] = await Promise.all([openFeedbackCount(ws.id), newLeadCount(ws.id)]);
  const badges: Record<string, string> = {};
  if (openFeedback > 0) badges.reviews = String(openFeedback);
  if (newLeads > 0) badges.leads = String(newLeads);

  return (
    <AppShell user={{ initials: initials(name), name, role: "Owner" }} locations={locations} plan={plan} badges={badges}>
      {children}
    </AppShell>
  );
}
