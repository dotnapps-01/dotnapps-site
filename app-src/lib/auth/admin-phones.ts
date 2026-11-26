import { normalizeIndianMobile } from "@/lib/auth/phone";

/** Skanor staff who may open the admin console: ADMIN_PHONES, comma-separated Indian mobile numbers. Empty means nobody. */
export function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => normalizeIndianMobile(p.trim()))
    .filter((p): p is string => !!p);
}
