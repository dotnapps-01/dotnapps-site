import { normPhone, type Result } from "@/lib/engage-input";
import { addDays, istDay, validDay } from "@/lib/ops-input";

/** Validation for products, batches, warranty registrations and the buyer's other actions on a product page. Pure, shared by forms and APIs. */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = <T,>(fields: Record<string, string>): Result<T> => ({ ok: false, fields });
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isInteger(n) ? n : null;
};
const httpUrl = (v: string) => {
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return (u.protocol === "https:" || u.protocol === "http:") && (u.hostname.includes(".") || (process.env.NODE_ENV !== "production" && u.hostname === "localhost")) ? u.toString() : null; // localhost only while developing, so an uploaded file's address works on a dev machine
  } catch {
    return null;
  }
};

export const BATCH_FORMATS = [
  { key: "csv", label: "CSV for the packaging line printer" },
  { key: "a4", label: "A4 sheets" },
  { key: "label", label: "Label roll · 30×30 mm" },
] as const;
export type BatchFormat = (typeof BATCH_FORMATS)[number]["key"];
export const MAX_BATCH = 20_000;

export type ProductInput = { name: string; model: string; madeIn: string; warrantyMonths: number; manualUrl: string; videosUrl: string; buyUrl: string; serviceEnabled: boolean };
export function parseProduct(raw: unknown): Result<ProductInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Give the product a name (2+ characters).";
  const warrantyMonths = r.warrantyMonths === undefined || r.warrantyMonths === "" ? 12 : int(r.warrantyMonths);
  if (warrantyMonths === null || warrantyMonths < 0 || warrantyMonths > 120) f.warrantyMonths = "Enter whole months between 0 and 120.";
  const urls: Record<string, string> = {};
  for (const k of ["manualUrl", "videosUrl", "buyUrl"] as const) {
    const v = str(r[k], 300);
    const ok = v ? httpUrl(v) : "";
    if (v && !ok) f[k] = "Enter a valid web address.";
    urls[k] = ok ?? "";
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, model: str(r.model, 60), madeIn: str(r.madeIn, 60), warrantyMonths: warrantyMonths!, manualUrl: urls.manualUrl, videosUrl: urls.videosUrl, buyUrl: urls.buyUrl, serviceEnabled: r.serviceEnabled !== false } };
}

export type BatchInput = { productId: string; quantity: number; prefix: string; warrantyMonths: number | null; format: BatchFormat };
export function parseBatch(raw: unknown): Result<BatchInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const productId = str(r.productId, 40);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) f.productId = "Choose a product.";
  const quantity = int(r.quantity);
  if (quantity === null || quantity < 1 || quantity > MAX_BATCH) f.quantity = `Enter a whole number from 1 to ${MAX_BATCH.toLocaleString("en-IN")}.`;
  const prefix = str(r.prefix, 14).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,13}$/.test(prefix)) f.prefix = "Use 2 to 14 letters, numbers or dashes, like AQ-26-.";
  let warrantyMonths: number | null = null;
  if (r.warrantyMonths !== undefined && r.warrantyMonths !== null && r.warrantyMonths !== "") {
    warrantyMonths = int(r.warrantyMonths);
    if (warrantyMonths === null || warrantyMonths < 0 || warrantyMonths > 120) f.warrantyMonths = "Enter whole months between 0 and 120.";
  }
  const format = (str(r.format, 8) || "csv") as BatchFormat;
  if (!BATCH_FORMATS.some((x) => x.key === format)) f.format = "Choose a print format.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { productId, quantity: quantity!, prefix, warrantyMonths, format } };
}

export const serialOf = (prefix: string, n: number) => `${prefix}${String(n).padStart(6, "0")}`;

export type WarrantyInput = { name: string; phone: string; purchasedOn: string; boughtFrom: string; invoiceNo: string };
export function parseWarranty(raw: unknown): Result<WarrantyInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number.";
  const purchasedOn = validDay(r.purchasedOn);
  if (!purchasedOn) f.purchasedOn = "Choose the date you bought it.";
  else if (purchasedOn > istDay()) f.purchasedOn = "That date is in the future.";
  else if (purchasedOn < addDays(istDay(), -365 * 3)) f.purchasedOn = "That date is too long ago.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, phone: phone!, purchasedOn: purchasedOn!, boughtFrom: str(r.boughtFrom, 80), invoiceNo: str(r.invoiceNo, 40) } };
}

export type ServiceRequestInput = { name: string; phone: string; problem: string };
export function parseServiceRequest(raw: unknown): Result<ServiceRequestInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid mobile number.";
  const problem = str(r.problem, 600);
  if (problem.length < 3) f.problem = "Tell us what's wrong in a few words.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, phone: phone!, problem } };
}

export function parseReport(raw: unknown): Result<{ note: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const note = str(r.note, 400);
  return note.length < 3 ? fail({ note: "Tell the brand where you bought it, in a few words." }) : { ok: true, value: { note } };
}
