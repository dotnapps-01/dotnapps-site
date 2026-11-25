import type { Metadata } from "next";
import { SitePlaceholder } from "@/components/site/SitePlaceholder";

export const metadata: Metadata = { title: "Sign up & log in" };

export default function Page() {
  return (
    <main id="main">
      <SitePlaceholder title="Sign up & log in" phase={3} designFile="SignUp.dc.html" />
    </main>
  );
}
