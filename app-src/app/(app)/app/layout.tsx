import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { currentActor } from "@/lib/auth/admin";
import { currentWorkspace } from "@/lib/auth/current";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { navNeeds } from "@/lib/routes";
import type { AppNavKey } from "@/lib/routes";
import { canUse } from "@/lib/plans";
import { newAlertCount } from "@/lib/products";
import { purgeIfDue } from "@/lib/settings";
import { countDynamic } from "@/lib/qr-repo";
import { openFeedbackCount } from "@/lib/reviews";
import { awaitingVisitors } from "@/lib/attendance";
import { pendingBookings } from "@/lib/bookings";
import { newLeadCount } from "@/lib/engage";
import { openTicketCount } from "@/lib/tickets";
import { dynamicLimit } from "@/lib/qr-types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "").slice(0, 2);
  return (letters || "S").toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const actor = await currentActor();

  // switched off by a Skanor admin: the owner sees why, and how to reach us. An admin viewing the tenant still sees the app.
  if (ws.suspended && !actor?.act) {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="m-0 font-display text-3xl font-semibold tracking-display">This account is paused</h1>
        <p className="m-0 text-base text-graphite">Your QR codes are not working right now. Please contact Skanor support to get them switched back on: [sales@skanor.in]</p>
        <Link href="/" className="text-sm font-semibold underline underline-offset-2">
          Back to the website
        </Link>
      </main>
    );
  }
  // scans and leads older than the retention period go, at most once a day, without making this page wait
  void purgeIfDue(ws).catch(() => {});

  const name = ws.businessName || "Your business";
  const locations = ws.locationName ? [{ id: "primary", name: ws.locationName }] : [{ id: "none", name: "No location yet" }];

  const limit = dynamicLimit[ws.plan];
  const upgrade = { free: "Starter", starter: "Growth", growth: "Business", business: "Enterprise", enterprise: null }[ws.plan];
  const plan = {
    name: ws.plan[0].toUpperCase() + ws.plan.slice(1),
    used: await countDynamic(ws.id),
    limit: Number.isFinite(limit) ? limit : null,
    upgradeTo: upgrade,
    canUpgrade: can(ws.role, "owner"),
  };
  const hidden = (Object.entries(navNeeds) as [AppNavKey, NonNullable<(typeof navNeeds)[AppNavKey]>][]).filter(([, need]) => !need.some((p) => can(ws.role, p))).map(([k]) => k);

  const [openFeedback, newLeads, openTickets, visitors, pending, fakes] = await Promise.all([openFeedbackCount(ws.id), newLeadCount(ws.id), openTicketCount(ws.id), awaitingVisitors(ws.id), pendingBookings(ws.id), canUse(ws.plan, "products") ? newAlertCount(ws.id) : Promise.resolve(0)]);
  const badges: Record<string, string> = {};
  if (openFeedback > 0) badges.reviews = String(openFeedback);
  if (newLeads > 0) badges.leads = String(newLeads);
  if (openTickets > 0) badges.tickets = String(openTickets);
  if (visitors > 0) badges.attendance = String(visitors);
  if (pending > 0) badges.bookings = String(pending);
  if (fakes > 0) badges.products = String(fakes);

  return (
    <AppShell user={{ initials: initials(ws.role === "owner" ? name : ws.memberName || name), name: ws.role === "owner" ? name : ws.memberName || name, role: ws.role === "owner" ? "Owner" : `${ROLE_LABEL[ws.role]} · ${name}` }} locations={locations} plan={plan} badges={badges} hidden={hidden} admin={!!actor?.admin} viewingAs={actor?.act ? name : null}>
      {children}
    </AppShell>
  );
}
