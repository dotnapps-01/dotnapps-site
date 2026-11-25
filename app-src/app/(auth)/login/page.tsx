import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LogInPage() {
  if (await getSession()) redirect("/app/dashboard");
  return <AuthScreen mode="login" />;
}
