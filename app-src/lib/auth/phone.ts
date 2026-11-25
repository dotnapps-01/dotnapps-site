/** Indian mobile numbers only for now (the design fixes the +91 prefix). */

/** Returns "+91XXXXXXXXXX" or null if the input isn't a valid Indian mobile number. */
export function normalizeIndianMobile(input: string): string | null {
  let d = input.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

/** "+919876543210" -> "+91 98xxx xx210" */
export function maskPhone(e164: string): string {
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 2)}xxx xx${d.slice(-3)}`;
}
