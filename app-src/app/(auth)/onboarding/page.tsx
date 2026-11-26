import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/auth/OnboardingWizard";
import { maskPhone } from "@/lib/auth/phone";
import { getChallenge, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const scanUrl = `${proto}://${host}/r/demo`;

  const session = await getSession();
  if (session) {
    const ws = await getWorkspace(session.sub);
    if (ws?.onboarded) redirect("/app/dashboard");
    return (
      <OnboardingWizard
        initial={{
          step: Math.max(1, ws?.step ?? 1),
          verified: true,
          mode: "signup",
          phoneMasked: maskPhone(session.sub),
          industry: ws?.industry ?? "",
          goals: ws?.goals ?? [],
          locationName: ws?.locationName ?? "",
          address: ws?.address ?? "",
          logoId: ws?.logoFileId ?? null,
          scanUrl,
        }}
      />
    );
  }

  const challenge = await getChallenge();
  if (!challenge) redirect("/signup");
  return (
    <OnboardingWizard
      initial={{
        step: 0,
        verified: false,
        mode: challenge.m,
        phoneMasked: maskPhone(challenge.p),
        industry: "",
        goals: [],
        locationName: "",
        address: "",
        logoId: null,
        scanUrl,
      }}
    />
  );
}
