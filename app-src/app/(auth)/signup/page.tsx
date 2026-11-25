import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your free account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/app/dashboard");
  return <AuthScreen mode="signup" />;
}
