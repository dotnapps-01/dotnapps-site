import type { Metadata } from "next";
import { DemoForm } from "@/components/marketing/DemoForm";
import { Frame, Mono, PathIcon, Section } from "@/components/marketing/parts";
import { Eyebrow } from "@/components/ui/NewBadge";
import { contactWays } from "@/lib/content/contact";

export const metadata: Metadata = {
  title: "Contact & book a demo",
  description: "A 20-minute call. We'll set up your first QR flows live and show you what your customers will see.",
};

export default function ContactPage() {
  return (
    <Section>
      <Frame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <div className="flex flex-col gap-6 border-r border-line px-gutter py-[clamp(48px,6vw,88px)] max-md:border-r-0">
          <Eyebrow>Contact &amp; demo</Eyebrow>
          <h1 className="m-0 font-display text-[clamp(40px,5.4vw,72px)] font-semibold leading-none tracking-display">
            See Skanor working on your business.
          </h1>
          <p className="m-0 max-w-[480px] text-[17px] leading-[1.6] text-graphite">
            A 20-minute call. We&rsquo;ll set up your first QR flows live and show you what your customers will see.
          </p>
          <ul className="mx-0 mb-0 mt-2 flex list-none flex-col border-t border-line p-0">
            {contactWays.map((w) => (
              <li key={w.k} className="flex items-center gap-4 border-b border-line py-[18px]">
                <div className="flex h-10 w-10 flex-none items-center justify-center border border-line bg-white text-ink">
                  <PathIcon d={w.ic} size={18} strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <Mono className="block text-[11px] text-muted">{w.k}</Mono>
                  <div className="mt-0.5 break-words text-[15px] font-semibold">{w.v}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <DemoForm />
      </Frame>
    </Section>
  );
}
