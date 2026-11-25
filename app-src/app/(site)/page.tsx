import type { Metadata } from "next";
import {
  AdvancedDark,
  Hero,
  HomeCta,
  HomeFaq,
  HowItWorks,
  IndustriesTeaser,
  IntegrationsStrip,
  Levels,
  LogoStrip,
  PricingTeaser,
  ReviewSpotlight,
  Stats,
} from "@/components/marketing/home-sections";

export const metadata: Metadata = {
  title: { absolute: "Skanor — Every scan, working for your business" },
  description:
    "Skanor turns one QR code into reviews, leads, loyalty, service tickets, attendance and product warranty, all run from one dashboard.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogoStrip />
      <Levels />
      <HowItWorks />
      <ReviewSpotlight />
      <Stats />
      <IndustriesTeaser />
      <AdvancedDark />
      <IntegrationsStrip />
      <PricingTeaser />
      <HomeFaq />
      <HomeCta />
    </>
  );
}
