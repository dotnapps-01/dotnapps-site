/** Shared by the contact form (client) and /api/demo-request (server). */

export const businessTypes = [
  "Retail & shops",
  "Restaurant / café",
  "Clinic / hospital",
  "Real estate",
  "Manufacturer / D2C",
  "Other",
] as const;

export const locationCounts = ["1", "2–5", "6–20", "20+"] as const;

export type DemoRequest = {
  name: string;
  whatsapp: string;
  email: string;
  businessType: string;
  locations: string;
  interests: string[];
  notes: string;
};

export type DemoRequestErrors = Partial<Record<"name" | "whatsapp" | "email", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateDemoRequest(r: Partial<DemoRequest>): DemoRequestErrors {
  const errors: DemoRequestErrors = {};
  if (!r.name?.trim()) errors.name = "Enter your name.";
  const digits = (r.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.whatsapp = "Enter a WhatsApp number with country code, e.g. +91 98765 43210.";
  if (!r.email || !EMAIL.test(r.email.trim())) errors.email = "Enter a valid work email.";
  return errors;
}
