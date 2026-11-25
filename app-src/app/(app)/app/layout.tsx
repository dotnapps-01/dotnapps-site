import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/workspace";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "").slice(0, 2);
  return (letters || "S").toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const ws = await getWorkspace(session.sub);

  const name = ws?.businessName || "Your business";
  const locations = ws?.locationName ? [{ id: "primary", name: ws.locationName }] : [{ id: "none", name: "No location yet" }];

  return (
    <AppShell user={{ initials: initials(name), name, role: "Owner" }} locations={locations}>
      {children}
    </AppShell>
  );
}
